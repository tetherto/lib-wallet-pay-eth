// Copyright 2024 Tether Operations Limited
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
'use strict'
const { Currency } = require('lib-wallet')
const Erc20Abi = require('./erc20.abi.json')
const BN = Currency._BN

module.exports = function currencyFactory (opts) {
  const contract = {
    ABI: Erc20Abi,
    address: opts.contractAddress || opts.contract_address
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

    static exportConfig() {
      return {
        tokenType: ERC20.token_type,
        contract_address : contract.address,
        decimal_places: opts.decimal_places,
        name: opts.name,
        base_name: opts.base_name
      }
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
