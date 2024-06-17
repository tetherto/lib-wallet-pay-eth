
const { Currency } = require('lib-wallet')

const BN = Currency._BN

class Ethereum extends Currency {

  constructor(){ 
    super(...arguments)
    const { amount, type, config } = this._parseConstArg(arguments)
    this.name = 'ETH'
    this.base_name = 'WEI'
    this.decimal_places = 18
  }

  toBaseUnit() {
    if(this.type === "base") return this.amount.toString()
    return Ethereum.toBaseUnit(this.amount, this.decimal_places)
  }

  toMainUnit() {
    if(this.type === "main") return this.amount.toString()
    return Ethereum.toMainUnit(this.amount, this.decimal_places)
  }

  static toBaseUnit(amount, decimal) {
    return BN(amount).shiftedBy(decimal).toString()
  }

  static toMainUnit(amount, decimal) {
    return BN(amount).shiftedBy(decimal * -1).dp(decimal).toString()
  }

  toString() {
    return this.amount.toString()
  }

  toNumber() {
    return +this.amount
  }

  isEthereum(v) {
    if(!(v instanceof Ethereum)) throw new Error("Amount must be an instance of Ethereum")
  }

  isUnitOf(amount) {
    this.isEthereum(amount)
  }
  
  bn(unit) {
    if(unit === 'base') return new BN(this.toBaseUnit())
    return new BN(this.toMainUnit())
  }
}

module.exports = Ethereum
