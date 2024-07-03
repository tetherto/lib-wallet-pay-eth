const { EventEmitter } = require('events')

class ERC20 extends EventEmitter {
  constructor(config){
    super()
    this.Currency = config.currency
    this.name = this.Currency.name 
    if(!this.name) throw new Error('ERC20: name is missing')
  }


  init(baseChain) {
    this.provider = baseChain.provider

    this._setupContract()
  }

  _setupContract() {
    const web3 = this.provider.web3
    const { ABI, address } = this.Currency.getContract()
    // TODO: address matches 
    this._contract = new web3.eth.Contract(ABI, address)
  }

  async getBalance(opts, addr){
    return this._contract.methods.balanceOf(addr).call()
  }
}


module.exports = ERC20
