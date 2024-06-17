const { WalletPay } = require('lib-wallet')
const { EventEmitter, once } = require('events')
const HdWallet = require('./hdwallet.js')
const Eth = require('./currency')


class WalletPayEthereum extends WalletPay {

  constructor (config) {
    super(config)
  }
  
  async initialize (args) {
  }

  async destroy(){

  }

  async getNewAddress() {
    
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
