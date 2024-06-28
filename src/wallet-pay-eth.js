const { WalletPay, HdWallet } = require('lib-wallet')
const SyncManager = require('./sync-manager.js')
const Ethereum = require('./eth.currency')

class Balance {
  constructor (confirmed, pending, mempool) {
    this.confirmed = confirmed || new Ethereum(0, 'main')
    this.pending = pending || new Ethereum(0, 'main')
    this.mempool = mempool || new Ethereum(0, 'main')
  }
}

class Balances {
  constructor (val, state) {
    this.state = state
    this.value = new Map()
    for(let addr in val) {
      const d  = val[addr]
      this.value.set(addr, new Ethereum(d))
    }
  }

  async add (addr, balance) {
    const bal = this.value.get(addr)
    if (!bal) {
      this.value.set(addr, balance)
    } else {
      const newbal = bal.add(balance)
      this.value.set(addr, newbal)
    }
    await this.state.storeBalances(this)
    return balance
  }

  toJSON () {
    return Object.fromEntries(this.value)
  }

  async getTotal () {
    let total = new Ethereum(0, 'base')
    const val = this.value
    for (const addr of val) {
      total = total.add(new Ethereum(addr))
    }
    return total
  }

  async getAddrByBalance(amount){
    for(const [addr, bal] of this.value) {
      if(bal.gte(amount)) {
        const addrObj  = await this.state.getAddress(addr)
        if(!addrObj) throw new Error('Address missing from addr list')
        return addrObj
      } 
    }
    return null

  }
}

class StateDb {
  constructor (config) {
    this.store = config.store
    this._balances = null
  }

  async init () {
    await this.store.init()
  }

  storeBalances (balance) {
    this._balances = balance 
    return this.store.put('current_balance', balance.toJSON())
  }

  async getBalances () {
    if(this._balances) return this._balances
    const bal = await this.store.get('current_balance')
    return new Balances(bal, this)
  }

  async getAddresses(addr) {
    const res = await this.store.get('addresses')
    if(!res)  return []
    return res
  }

  async getAddress(address) {
    const list = await this.getAddresses()
    return list.find((addr) =>{
      return addr.address === address
    })
  }

  storeAddresses(addr) {
    return this.store.put('addresses', addr)
  }

  getTxIndex(i) {
    return this._txIndex || this.store.get('tx_index')
  }

  async updateTxIndex(i) {
    let index = await this.getTxIndex()
    if(!index) index = { earliest : null, latest: null}
    let change = false   
    if(i < index.earliest || !index.earliest ) {
      change = true
      index.earliest = i 
    } else if ( i > index.latest ) {
      change = true
      index.latest = i 
    }
    this._txIndex = index
    if(change) return this.store.put('tx_index')
  }

  async storeTxHistory(i, data) {
    await this.updateTxIndex(i)
    return this.store.put('height:'+i, data)
  }

  async getTxHistory(i) {
    const res = await this.store.get('height:'+i)
    if(!res) return []
    return res
  }

  reset() {
    return this.store.clear()
  }
}

// TODO:
// 3. send tx
// 5. fee estimator

class WalletPayEthereum extends WalletPay {
  constructor (config) {
    super(config)
    this.ready = false
    this._halt = false
    this.web3 = config.provider.web3
  }

  async initialize (args) {
    this.ready = true
    // cointype and purpose : https://github.com/satoshilabs/slips/blob/master/slip-0044.md
    this._hdWallet = new HdWallet({
      store: this.store.newInstance({ name: 'hdwallet-eth' }),
      coinType: "60'",
      purpose: "44'"
    })
    this.state = new StateDb({
      store: this.store.newInstance({ name: 'state-eth' })
    })

    this._syncManager = new SyncManager({
      state: this.state
    })

    await this.state.init()
    await this._hdWallet.init()
  }

  async destroy () {
    this.ready = false
  }

  async pauseSync () {
    this._halt = true
  }

  async resumeSync () {
    this._halt = true
  }

  async getNewAddress () {
    let path = await this._hdWallet.getLastExtPath()
    const addr = this.keyManager.addrFromPath(path)
    path = HdWallet.bumpIndex(addr.path)
    await this._hdWallet.updateLastPath(path)
    await this._hdWallet.addAddress(addr)
    return addr
  }

  async getTransactions (fn) {
    const txIndex = await this.state.getTxIndex()

    if(!txIndex || !txIndex.earliest) return 
    if(!txIndex.latest) txIndex.latest = txIndex.earliest+1

    for(let x = txIndex.earliest; x <= txIndex.latest; x++) {
      const block = await this.state.getTxHistory(x)
      await fn(block)
    }
  }

  async getBalance (opts, addr) {
    if (!addr) {
      const balances = await this.state.getBalances()
      return new Balance(balances.getTotal())
    }
    const bal = await this.web3.eth.getBalance(addr)
    return new Balance(new Ethereum(bal, 'base'))
  }


  async _processHistory(txs) {
    const syncCache = this._syncCache
    for (const tx of txs ) {
      const cache = syncCache.get(tx.blockNumber) || []
      cache.push(tx)
      await this.state.storeTxHistory(tx.blockNumber, cache)
    }
  }

  async syncTransactions (opts) {
    if (opts?.restart) {
      await this._hdWallet.resetSyncState()
      await this.state.reset()
    }
    const { provider, keyManager, state, _hdWallet } = this
    const balances = await state.getBalances()
    const addrs = await state.getAddresses()
    this._syncCache = new Map()
    await _hdWallet.eachAccount(async (syncState, signal) => {
      if (this._halt) return signal.stop
      const path = syncState.path
      const addr = keyManager.addrFromPath(path)
      const tx = await provider.getTransactionsByAddress({ address: addr.address })
      if (tx.length === 0 ) {
        this.emit('synced-path', path)
        return signal.noTx
      }
      const bal = await this.getBalance({}, addr.address)
      await balances.add(addr.address, bal.confirmed)
      addrs.push(addr)
      await state.storeAddresses(addrs)
      this.emit('synced-path', path)
      await this._processHistory(tx)
      return tx.length > 0 ? signal.hasTx : signal.noTx
    })

    this._syncCache = null

    if (this._halt) {
      this._isSyncing = false
      this.emit('sync-end')
      this.resumeSync()
      return
    }
    this._isSyncing = false
    this.resumeSync()
    this.emit('sync-end')
  }

  async _getSignedTx(outgoing) {
    const { web3 } = this.provider
    const amount = new Ethereum(outgoing.amount, outgoing.unit)
    let sender 

    if(!outgoing.sender) {
      const bal = await this.state.getBalances()
      sender = await bal.getAddrByBalance(amount)
    } else { 
      sender = this.state.getAddress(outgoing.sender)
    }

    const tx =  {
      from: sender.address,
      to: outgoing.address,
      value: amount.toBaseUnit(),
      gas: outgoing.gasLimit ||  (await web3.eth.getBlock()).gasLimit,
      gasPrice: outgoing.gasPrice || await this._getGasPrice()
    }
    const signed = await web3.eth.accounts.signTransaction(tx, sender.privateKey)

    return { signed, sender,tx }
  }

  sendTransaction (opts, outgoing) {
    const { web3 } = this.provider
    let notify
    const p = new Promise((resolve, reject)=>{
      this._getSignedTx(outgoing).then(({ signed }) => {
        web3.eth.sendSignedTransaction(signed.rawTransaction)
          .on('receipt', (tx)=> {
            if(notify) return notify(tx)
          }).on('confirmation', (tx)=>{
            resolve(tx)
          }).on('error', (err) => reject(err))
      })
    })
    p.broadcasted = (fn) => notify = fn
    return p
  }

  async _getGasPrice() {

    return 20
  }

  isValidAddress (address) {
    return this.web3.utils.isAddress(address)
  }
}

module.exports = WalletPayEthereum
