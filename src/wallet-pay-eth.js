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
const { JsonRpcProvider, Wallet } = require('ethers')
const MevShareClient = require('@flashbots/mev-share-client')

class WalletPayEthereum extends EvmPay {
  constructor (config) {
    super(config)
    const authSigner = new Wallet(config.auth_signer_private_key).connect(config.provider)
    this.mevShareClient = MevShareClient.default.useEthereumMainnet(authSigner)
  }

  /**
  * @description Send a transaction
  * @param {object} outgoing outgoing options
  * @param {number} outgoing.amount Number of units being sent
  * @param {string} outgoing.unit unit of amount. main or base
  * @param {string} outgoing.address address of reciever
  * @param {string?} outgoing.data data to be passed
  * @param {string=} outgoing.sender address of sender
  * @param {number=} outgoing.gasLimit ETH gas limit
  * @param {number=} outgoing.gasPrice ETH gas price
  * @param {object} hints hints flashbots options
  * @param {bool} hints.calldata Pass calldata
  * @param {bool} hints.logs Pass logs
  * @param {bool} hints.contractAddress Pass contractAddress
  * @param {bool} hints.functionSelector Pass functionSelector
  * @param {number=} maxBlockNumber Max block number
  * @return {Promise} Promise - tx hash when sent
  */
  async sendTransactionToFlashbotRpc (outgoing, hints, maxBlockNumber) {
    const hints = {
        calldata: true,
        logs: true,
        contractAddress: true,
        functionSelector: true,
    }

    this._getSignedTx(outgoing).then(async ({ signed }) => {
      return await this.mevShareClient.sendTransaction(signed, {hints, maxBlockNumber})
    });
  }
}

module.exports = WalletPayEthereum
