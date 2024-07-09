const { Currency } = require('lib-wallet')
const { Web3 } = require('web3')
const util = Web3.utils

const BN = Currency._BN

class Ethereum extends Currency {
  constructor () {
    super(...arguments)
    this.name = 'ETH'
    this.base_name = 'WEI'
    this.decimal_places = 18
  }

  toBaseUnit () {
    if (this.type === 'base') return this.amount.toString()
    return Ethereum.toBaseUnit(this.amount, this.decimal_places)
  }

  toMainUnit () {
    if (this.type === 'main') return this.amount.toString()
    return Ethereum.toMainUnit(this.amount, this.decimal_places)
  }

  static toBaseUnit (amount, decimals) {
    return util.toWei(amount, 'ether')
  }

  static toMainUnit (amount) {
    return util.fromWei(amount, 'ether')
  }

  toString () {
    return this.amount.toString()
  }

  toNumber () {
    return BN(this.amount).toNumber()
  }

  static isEthereum (v) {
    if (!(v instanceof Ethereum)) throw new Error('Amount must be an instance of Ethereum')
    return true
  }

  isUnitOf (amount) {
    Ethereum.isEthereum(amount)
  }

  bn (unit) {
    if (unit === 'base') return new BN(this.toBaseUnit())
    return new BN(this.toMainUnit())
  }
}

module.exports = Ethereum
