const { WalletPay, HdWallet } = require('lib-wallet')
const { EventEmitter, once } = require('events')
const Eth = require('./eth.currency')


class StateDb {
  constructor (config) {
    this.store = config.store
  }

  async init () {
    await this.store.init()
  }
}

class WalletPayEthereum extends WalletPay {

  constructor (config) {
    super(config)
    this.ready = false
  }
  
  async initialize (args) {
    this.ready = true
    this._hdWallet = new HdWallet({ 
      store: this.store.newInstance({ name: 'hdwallet-eth' }),
      coinType: "60'",
      purpose: "44'",
    })
    this.state = new StateDb({
      store: this.store.newInstance({ name: 'state-btc' })
    })

    await this.state.init()
    await this._hdWallet.init()
  }

  async destroy(){
    this.ready = false

  }

  async getNewAddress() {
    let path = await this._hdWallet.getLastExtPath()
    const addr = this.keyManager.addrFromPath(path)
    console.log(addr)
    path = HdWallet.bumpIndex(addr.path)
    await this._hdWallet.updateLastPath(addr.path)
    // watch address?
    await this._hdWallet.addAddress(addr)
    return addr
  }

  async getTransactions() {

  }

  async getBalance() {
    
  }

  async syncTransactions() {
    
  }

  sendTransaction() {
    
  }

  isValidAddress() {

  }
}


module.exports = WalletPayEthereum
