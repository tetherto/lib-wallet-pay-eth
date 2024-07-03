const { Currency } = require('lib-wallet')

const BN = Currency._BN

const contract = {
  ABI:[{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"_from","type":"address"},{"indexed":true,"internalType":"address","name":"_to","type":"address"},{"indexed":false,"internalType":"uint256","name":"_value","type":"uint256"}],"name":"Transfer","type":"event"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transfer","outputs":[],"stateMutability":"nonpayable","type":"function"}],
  address: '0xb719422a0a484025c1a22a8deeafc67e81f43cfd'
}

class UsdtEth extends Currency {

  static name='USDT'
  constructor () {
    super(...arguments)
    this._parseConstArg(arguments)
    this.name = 'USDT'
    this.base_name = 'usdt'
    this.decimal_places = 6
  }

  static getContract () {
    return contract
  }

  toBaseUnit () {
    if (this.type === 'base') return this.amount.toString()
    return UsdtEth.toBaseUnit(this.amount, this.decimal_places)
  }

  toMainUnit () {
    if (this.type === 'main') return this.amount.toString()
    return UsdtEth.toMainUnit(this.amount, this.decimal_places)
  }

  static toBaseUnit (amount, decimal) {
    return BN(amount).shiftedBy(decimal).toString()
  }

  static toMainUnit (amount, decimal) {
    return BN(amount).shiftedBy(decimal * -1).dp(decimal).toString()
  }

  toString () {
    return this.amount.toString()
  }

  toNumber () {
    return +this.amount
  }

  isUsdEth (v) {
    if (!(v instanceof UsdtEth)) throw new Error('Amount must be an instance of UsdtEth')
  }

  isUnitOf (amount) {
    this.isUsdtEth(amount)
  }

  bn (unit) {
    if (unit === 'base') return new BN(this.toBaseUnit())
    return new BN(this.toMainUnit())
  }

}

module.exports = UsdtEth
