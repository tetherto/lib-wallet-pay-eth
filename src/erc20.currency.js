const { Currency } = require('lib-wallet')

const BN = Currency._BN

module.exports = function currencyFactory (opts) {

  const contract = {
    ABI: [{ inputs: [], stateMutability: 'nonpayable', type: 'constructor' }, { anonymous: false, inputs: [{ indexed: true, internalType: 'address', name: '_from', type: 'address' }, { indexed: true, internalType: 'address', name: '_to', type: 'address' }, { indexed: false, internalType: 'uint256', name: '_value', type: 'uint256' }], name: 'Transfer', type: 'event' }, { inputs: [{ internalType: 'address', name: 'account', type: 'address' }], name: 'balanceOf', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' }, { inputs: [], name: 'name', outputs: [{ internalType: 'string', name: '', type: 'string' }], stateMutability: 'view', type: 'function' }, { inputs: [], name: 'owner', outputs: [{ internalType: 'address', name: '', type: 'address' }], stateMutability: 'view', type: 'function' }, { inputs: [], name: 'symbol', outputs: [{ internalType: 'string', name: '', type: 'string' }], stateMutability: 'view', type: 'function' }, { inputs: [], name: 'totalSupply', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' }, { inputs: [{ internalType: 'address', name: 'to', type: 'address' }, { internalType: 'uint256', name: 'amount', type: 'uint256' }], name: 'transfer', outputs: [], stateMutability: 'nonpayable', type: 'function' }],
    address: opts.contractAddress
  }

  class ERC20 extends Currency {
    static name = opts.name
    static token_type = 'ERC20'
    constructor () {
      super(...arguments)
      this._parseConstArg(arguments)
      this.name = opts.name
      this.base_name = opts.base_name
      this.decimal_places = opts.decimal_places
      if (!Number.isInteger(this.decimal_places)) throw new Error('decimal places must be an Integer')
    }

    static getContract () {
      return contract
    }

    toBaseUnit () {
      if (this.type === 'base') return this.amount.toString()
      return ERC20.toBaseUnit(this.amount, this.decimal_places)
    }

    toMainUnit () {
      if (this.type === 'main') return this.amount.toString()
      return ERC20.toMainUnit(this.amount, this.decimal_places)
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

    isToken (v) {
      if (!(v instanceof ERC20)) throw new Error('must be an instance of ERC20')
      return true
    }

    isUnitOf (amount) {
      return this.isToken(amount)
    }

    bn (unit) {
      if (unit === 'base') return new BN(this.toBaseUnit())
      return new BN(this.toMainUnit())
    }
  }

  return ERC20
}
