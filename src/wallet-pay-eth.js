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
const { EvmPay } = require('lib-wallet-pay-evm')

class WalletPayEthereum extends EvmPay {
  constructor (config) {
    super(config)
  }

  /**
  * @description Send a transaction
  * @param {object} opts options
  * @param {object} outgoing outgoing options
  * @param {number} outgoing.amount Number of units being sent
  * @param {string} outgoing.unit unit of amount. main or base
  * @param {string} outgoing.address address of reciever
  * @param {string?} outgoing.data data to be passed
  * @param {string=} outgoing.sender address of sender
  * @param {number=} outgoing.gasLimit ETH gas limit
  * @param {number=} outgoing.gasPrice ETH gas price
  * @return {function} promise.broadcasted function called when
  * @return {Promise} Promise - when tx is confirmed
  */
  sendTransactionToFlashbotRpc (opts, outgoing) {
    // TODO: implement @flashbots/mev-share-client
  }
}

module.exports = WalletPayEthereum
