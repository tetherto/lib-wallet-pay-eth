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
