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

  async initialize (ctx) {
    // @desc use default key manager
    if (!this.keyManager) {
      this.keyManager = new (require('./wallet-key-eth.js'))({ network: this.network })
    }

    await super.initialize(ctx)
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
    this._listenToEvents()

    this.ready = true
  }

  async _destroy () {
    this.ready = false
    await this.callToken('_destroy', null, [])
    await this.provider.stop()
    await this.store.close()
  }

  async pauseSync () {
    this._halt = true
  }

  async resumeSync () {
    this._halt = false
  }

  _getTokenFromContract(addr){
    const tokens = this.getTokens()
  }

  _listenToEvents () {
    this.provider.on('subscribeAccount', async (res) => {
      if(res.token) {
        this._eachToken(async (token) => {
          if(token.tokenContract.toLowerCase() !== res?.token.toLowerCase()) return 
          const tx = await token.updateTxEvent(res)
          this.emit('new-tx', { tx, token: token.name })
        })

        return 
      }
      const tx  = await this._storeTx(res.tx)
      await this._setAddrBalance(res.addr)
      this.emit('new-tx',{ tx })
    })
  }

  _onNewTx(){
    return new Promise((resolve) => {
      this.on('new-tx', resolve)
    })
  }

  /**
   * @description get a new ETH account address
   * return {Promise<object>} Address object
  */
  async getNewAddress () {
    const res = await this._hdWallet.getNewAddress((path) => {
      return this.keyManager.addrFromPath(path)
    })
    const tokenContracts = Array.from(this.getTokens()).map((t) => {
      return t[1].tokenContract
    })
    this.provider.subscribeToAccount(res.addr.address,tokenContracts)
    return res.addr
  }

  /**
   * @description Get wallet tx history
   * @param {string?} opts.token name of token for token tx history
   * @param {function} fn callback function for transactions
   * @returns {Promise}
   */
  async getTransactions (opts, fn) {
    const state = await this._getState(opts)

    const txIndex = await state.getTxIndex()

    if (!txIndex || !txIndex.earliest) return
    if (!txIndex.latest) txIndex.latest = txIndex.earliest

    for (let x = txIndex.earliest; x <= txIndex.latest; x++) {
      const block = await state.getTxHistory(x)
      if (!block || block.length === 0) continue
      await fn(block)
    }
  }

  /**
  * @desc Get balance of entire wallet or 1 address
  * @param {object} opts options
  * @param {string} opts.token token name, for getting balance of token
  * @param {string} addr Pass address to get balance of specific address
  * @returns {Promise<Balance>}
  */
  async getBalance (opts, addr) {
    if (opts.token) return this.callToken('getBalance', opts.token, [opts, addr])
    if (!addr) {
      const balances = await this.state.getBalances()
      return new this._Balance(balances.getTotal())
    }
    const bal = await this.web3.eth.getBalance(addr)
    return new this._Balance(new Ethereum(bal, 'base'))
  }

  async _getState (opts = {}) {
    let state = this.state
    if (opts.token) {
      state = await this.callToken('getState', opts.token, [])
    }
    return state
  }

  async getActiveAddresses (opts) {
    const state = await this._getState(opts)
    const bal = await state.getBalances()
    return bal.getAll()
  }

  async getFundedTokenAddresses (opts) {
    if (!opts.token) {
      return this.getActiveAddresses()
    }
    const token = await this.getActiveAddresses(opts)
    const eth = await this.getActiveAddresses()
    const accounts = new Map()
    for (const [addr, bal] of token) {
      const ethBal = eth.get(addr)
      const data = [bal]
      if (ethBal && ethBal.toNumber() > 0) data.push(ethBal)
      accounts.set(addr, data)
    }
    return accounts
  }

  async _syncEthPath (addr, signal) {
    const provider = this.provider
    const path = addr.path
    const tx = await provider.getTransactionsByAddress({ address: addr.address })
    if (tx.length === 0) {
      this.emit('synced-path', path)
      return signal.noTx
    }

    this._hdWallet.addAddress(addr)
    for (const t of tx) {
      await this._storeTx(t)
    }
    await this._setAddrBalance(addr.address)
    return tx.length > 0 ? signal.hasTx : signal.noTx
  }

  async _setAddrBalance (addr) {
    const balances = await this.state.getBalances()
    const bal = await this.getBalance({}, addr)
    await balances.setBal(addr, bal.confirmed)
  }

  _storeTx (tx) {
    const data = {
      from: tx.from,
      to: tx.to,
      value: new Ethereum(tx.value, 'base'),
      height: tx.blockNumber,
      txid: tx.hash,
      gas: Number(tx.gas),
      gasPrice: Number(tx.gasPrice)
    }
    this.state.storeTxHistory(data)
    return data
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

    if (opts.token) {
      state = await this.callToken('getState', opts.token, [])
    }

    if (opts?.reset) {
      await state._hdWallet.resetSyncState()
      await state.reset()
    }

    await state._hdWallet.eachAccount(async (syncState, signal) => {
      if (this._halt) return signal.stop
      const { addr } = keyManager.addrFromPath(syncState.path)
      if (opts.token) return this.callToken('syncPath', opts.token, [addr, signal])
      const res = await this._syncEthPath(addr, signal)
      this.emit('synced-path', syncState._addrType, syncState.path, res === signal.hasTx, syncState.toJSON())
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

  /**
   * @description generate a signed tx for a payment
   * @param {number} outgoing.amount amount of payment
   * @param {string} outgoing.unit main or base
   * @param {string} outgoing.address address of recipient
   * @param {string?} outgoing.sender address you are sending from
   * @param {number?} outgoing.gasLimit gas limit
   * @param {gasPrice?} outgoing.gasPrice gas price
   * @returns {object} signed, sender address, transaction object
   */
  async _getSignedTx (outgoing) {
    const { web3 } = this.provider
    const amount = new Ethereum(outgoing.amount, outgoing.unit)
    let sender

    if (!outgoing.sender) {
      const bal = await this.state.getBalances()
      sender = await bal.getAddrByBalance(amount)
    } else {
      sender = this.state.getAddress(outgoing.sender)
    }

    if (!sender) throw new Error('insufficient balance or invalid sender')

    const tx = {
      from: sender.address,
      to: outgoing.address,
      value: amount.toBaseUnit(),
      gas: outgoing.gasLimit || (await web3.eth.getBlock()).gasLimit,
      gasPrice: outgoing.gasPrice || await this._getGasPrice()
    }
    const signed = await web3.eth.accounts.signTransaction(tx, sender.privateKey)

    return { signed, sender, tx }
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
  * @return {function} promise.broadcasted function called when
  * @return {Promise} Promise - when tx is confirmed
  */
  sendTransaction (opts, outgoing) {
    const { web3 } = this.provider
    if (opts.token) return this.callToken('sendTransactions', opts.token, [opts, outgoing])
    let notify

    const p = new Promise((resolve, reject) => {
      this._getSignedTx(outgoing).then(({ signed }) => {
        web3.eth.sendSignedTransaction(signed.rawTransaction)
          .on('receipt', (tx) => {
            if (notify) return notify(tx)
          }).once('confirmation', (tx) => {
            resolve(tx)
          }).on('error', (err) => reject(err))
      })
    })
    p.broadcasted = (fn) => { notify = fn }
    return p
  }

  async _getGasPrice () {
    // TODO: Get gas price
    return 46773859
  }

  isValidAddress (address) {
    return this.web3.utils.isAddress(address)
  }
}

module.exports = WalletPayEthereum
