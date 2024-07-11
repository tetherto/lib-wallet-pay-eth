const { WalletPay, HdWallet } = require('lib-wallet')
const Ethereum = require('./eth.currency')
const StateDb = require('./state')


class WalletPayEthereum extends WalletPay {
  constructor (config) {
    super(config)
    this.ready = false
    this._halt = false
    this.web3 = config.provider.web3
    this._setCurrency(Ethereum)
  }
  
  async initialize () {
    this.ready = true
    // cointype and purpose : https://github.com/satoshilabs/slips/blob/master/slip-0044.md
    this._hdWallet = new HdWallet({
      store: this.store.newInstance({ name: 'hdwallet-eth' }),
      coinType: "60'",
      purpose: "44'"
    })
    this.state = new StateDb({
      store: this.store.newInstance({ name: 'state-eth' }),
      hdWallet: this._hdWallet,
      Currency: Ethereum
    })

    await this.state.init()
    await this._hdWallet.init()
    await this._initTokens(this)
  }

  async destroy () {
    this.ready = false
    await this.callToken('destroy', null, [])
    await this.provider.stop()
  }

  async pauseSync () {
    //TODO: test for this
    this._halt = true
  }

  async resumeSync () {
    this._halt = false
  }


  /**
   * @description get a new ETH account address
   * return {Promise<object>} Address object
  */
  async getNewAddress () {
    const res  = await this._hdWallet.getNewAddress((path) => {
      return this.keyManager.addrFromPath(path)
    })
    return res.addr
  }

  
  async getTransactions (opts, fn) {
    const state = await this._getState(opts)

    const txIndex = await state.getTxIndex()

    if(!txIndex || !txIndex.earliest) return 
    if(!txIndex.latest) txIndex.latest = txIndex.earliest


    for(let x = txIndex.earliest; x <= txIndex.latest; x++) {
      const block = await state.getTxHistory(x)
      await fn(block)
    }
  }

  /**
  * @desc Get balance of entire wallet or 1 address
  * @param {object} opts options
  * @param {string} addr Pass address to get balance of specific address
  * @returns {Promise<Balance>}
  */
  async getBalance (opts, addr) {
    if(opts.token) return this.callToken('getBalance',opts.token, [opts ,addr])
    if (!addr) {
      const balances = await this.state.getBalances()
      return new this._Balance(balances.getTotal())
    }
    const bal = await this.web3.eth.getBalance(addr)
    return new this._Balance(new Ethereum(bal, 'base'))
  }

  async _getState(opts={}) {
    let state = this.state
    if(opts.token) {
      state  = await this.callToken('getState', opts.token, [])
    } 
    return state

  }

  async getActiveAddresses(opts) {
    const state = await this._getState(opts)
    const bal = await state.getBalances()
    return bal.getAll()
  }

  async getFundedTokenAddresses(opts){
    const token = await this.getActiveAddresses(opts)
    const eth = await this.getActiveAddresses()
    const accounts = new Map()
    for(const [addr, bal] of token) {
      const ethBal = eth.get(addr)
      if(!ethBal || ethBal.toNumber() <= 0) continue
      accounts.set(addr, [bal, ethBal])
    }
    return accounts
  }

  async _syncEthPath(addr, signal) {
    const provider = this.provider
    const path = addr.path
    const balances = await this.state.getBalances()
    const tx = await provider.getTransactionsByAddress({ address: addr.address })
    if (tx.length === 0 ) {
      this.emit('synced-path', path)
      return signal.noTx
    }
    const bal = await this.getBalance({}, addr.address)
    await balances.add(addr.address, bal.confirmed)
    this._hdWallet.addAddress(addr)
    for (const t of tx ) {
      await this.state.storeTxHistory({
        from: tx.from,
        to: tx.to,
        value: new Ethereum(t.value, 'base'),
        height: t.blockNumber,
        txid: t.hash,
        gas: t.gas,
        gasPrice: t.gasPrice
      })
    }
    return tx.length > 0 ? signal.hasTx : signal.noTx
  }

  /**
  * @desc Crawl HD wallet path and collect transactions and calculate
  * balance of all addresses.
  * @param {object} opts 
  * @param {object.restart} opts.restart Reset all state and resync
  * @fires sync-path when a hd path is synced
  * @fires sync-end when entire HD path has been traversed, or when syncing is halted
  * @return {Promise}
  */
  async syncTransactions (opts = {}) {
    let { keyManager, state } = this

    if(opts.token) {
      state  = await this.callToken('getState', opts.token, [])
    } 

    if (opts?.restart) {
      await state._hdWallet.resetSyncState()
      await state.reset()
    }

    await state._hdWallet.eachAccount(async (syncState, signal) => {
      if (this._halt) return signal.stop
      const { addr } = keyManager.addrFromPath(syncState.path)
      if(opts.token) return this.callToken('syncPath', opts.token, [addr, signal])
      const res = await this._syncEthPath(addr, signal)
      this.emit('synced-path', syncState.path)
      return res 
    })

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

    if(!sender) throw new Error('insufficient balance or invalid sender')

    const tx =  {
      from: sender.address,
      to: outgoing.address,
      value: amount.toBaseUnit(),
      gas: outgoing.gasLimit ||  (await web3.eth.getBlock()).gasLimit,
      gasPrice: outgoing.gasPrice || await this._getGasPrice(),
    }
    const signed = await web3.eth.accounts.signTransaction(tx, sender.privateKey)

    return { signed, sender,tx }
  }

  /**
  * @description Send ETH to address 
  * @param {object} opts options 
  * @param {object} outgoing outgoing options 
  * @param {number} outgoing.amount Number of units being sent
  * @param {string} outgoing.unit unit of amount. main or base 
  * @param {string} outgoing.address address of reciever
  * @param {string=} outgoing.sender address of sender
  * @param {number=} outgoing.gasLimit ETH gas limit
  * @param {number=} outgoing.gasPrice ETH gas price
  * @return {Promise} Promise - when tx is confirmed
  */
  sendTransaction (opts, outgoing) {
    const { web3 } = this.provider
    if(opts.token) return this.callToken('sendTransactions', opts.token, [opts, outgoing])
    let notify

    const p = new Promise((resolve, reject)=>{
      this._getSignedTx(outgoing).then(({ signed }) => {
        web3.eth.sendSignedTransaction(signed.rawTransaction)
          .on('receipt', (tx)=> {
            if(notify) return notify(tx)
          }).once('confirmation', (tx)=>{
            resolve(tx)
          }).on('error', (err) => reject(err))
      })
    })
    p.broadcasted = (fn) => notify = fn
    return p
  }

  async _getGasPrice() {

    //TODO: Get gas price
    return 100533
  }

  isValidAddress (address) {
    return this.web3.utils.isAddress(address)
  }
}

module.exports = WalletPayEthereum
