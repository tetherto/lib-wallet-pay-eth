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
const { GasCurrency } = require('lib-wallet-util-evm')
const { Wallet } = require('ethers')
const MevShareClient = require('@flashbots/mev-share-client')

class WalletPayEthereum extends EvmPay {
  constructor (config) {
    super(config)

    this.web3 = config?.provider?.web3

    this.startSyncTxFromBlock = 0

    const authSigner = new Wallet(config.auth_signer_private_key).connect(config.provider)

    this.mevShareClient = MevShareClient.default.useEthereumMainnet(authSigner)
  }

  async initialize (ctx) {
    return await this._initialize(ctx, {
      defaultKeyManager: new (require('./wallet-key-eth.js'))({ network: this.network }),
      providerConfig: {
        web3: this.config.web3,
        indexer: this.config.indexer_rpc,
        indexerWs: this.config.indexer_ws
      },
      walletConfig: {
        name: 'hdwallet-eth',
        coinType: "60'",
        purpose: "44'"
      },
      stateConfig: {
        name: "state-eth"
      },
      newTxCallback: async (res, token) => {
        const tx = await token.updateTxEvent(res)
        
        return {
          token: token.name,
          address: res.address,
          value: tx.value,
          from: tx.from,
          to: tx.to,
          height: res.height,
          txid: tx.txid
        }
      }
    })
  }

  async _syncPath (addr, signal, startFrom) {
    const provider = this.provider
    const path = addr.path
    const tx = await provider.getTransactionsByAddress({ address: addr.address, fromBlock: startFrom })
    if (tx.length === 0) {
      this.emit('synced-path', path)
      return signal.noTx
    }

    for (const t of tx) {
      await this._storeTx(t)
    }
    return tx.length > 0 ? signal.hasTx : signal.noTx
  }

  async _storeTx (tx) {
    const data = {
      from: tx.from.toLowerCase(),
      to: tx.to.toLowerCase(),
      value: new GasCurrency(tx.value, 'base', this.gas_token),
      height: tx.blockNumber,
      txid: tx.hash,
      gas: Number(tx.gas),
      maxPriorityFeePerGas: Number(tx.maxPriorityFeePerGas),
      maxFeePerGas: Number(tx.maxFeePerGas)
    }
    await this.state.storeTxHistory(data)
    return data
  }

  async syncTransactions (opts = {}) {
    let { keyManager, state } = this

    if (opts.token) {
      state = await this.callToken('getState', opts.token, [])
    }

    if (opts.reset) {
      await state._hdWallet.resetSyncState()
      await state.reset()
    }

    const latestBlock = Number(await this.web3.eth.getBlockNumber())

    await state._hdWallet.eachAccount(async (syncState, signal) => {
      if (this._halt) return signal.stop
      const { addr } = keyManager.addrFromPath(syncState.path)
      if (opts.token) return await this.callToken('syncPath', opts.token, [addr, signal, this.startSyncTxFromBlock])
      const res = await this._syncPath(addr, signal, this.startSyncTxFromBlock)
      this.emit('synced-path', syncState._addrType, syncState.path, res === signal.hasTx, syncState.toJSON())
      return res
    })

    this.startSyncTxFromBlock = latestBlock

    if (this._halt) {
      this.emit('sync-end')
      this.resumeSync()
      return
    }

    this.resumeSync()
    this.emit('sync-end')
  }

  async _getGasPrice () {
    return this.provider.web3.eth.getGasPrice()
  }

  async _getMaxPriorityFeePerGas () {
    return this.provider.web3.eth.getMaxPriorityFeePerGas()
  }

  async _getSignedTx (outgoing) {
    const { web3 } = this.provider
    const amount = new GasCurrency(outgoing.amount, outgoing.unit)
    let sender

    if (!outgoing.sender) {
      const bal = await this.state.getBalances()
      sender = await bal.getAddrByBalance(amount)
    } else {
      sender = await this._hdWallet.getAddress(outgoing.sender)
    }

    if (!sender) throw new Error('insufficient balance or invalid sender')

    let gasLimit = outgoing.gasLimit;

    if (!gasLimit) {
      gasLimit = await web3.eth.estimateGas({
        from: sender.address,
        to: outgoing.address,
        value: amount.toBaseUnit(),
        data: outgoing.data
      })
    }

    const tx = {
      from: sender.address,
      to: outgoing.address,
      value: amount.toBaseUnit(),
      gas: gasLimit,
      maxFeePerGas: outgoing.maxFeePerGas || await this._getGasPrice(),
      maxPriorityFeePerGas: outgoing.maxPriorityFeePerGas || await this._getMaxPriorityFeePerGas(),
      data: outgoing.data
    }

    const signed = await web3.eth.accounts.signTransaction(tx, sender.privateKey)

    return { signed, sender, tx }
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
  * @param {number=} outgoing.maxFeePerGas ETH gas price
  * @param {number=} outgoing.maxPriorityFeePerGas ETH priority gas price
  * @return {function} promise.broadcasted function called when
  * @return {Promise} Promise - when tx is confirmed
  */
  sendTransaction (opts, outgoing) {
    const _getSignedTxWrapper = (outgoing) => this.callToken('_getSignedTx', opts.token, [outgoing]) 

    const getSignedTx = opts.token ? _getSignedTxWrapper : this._getSignedTx

    let notify

    const p = new Promise((resolve, reject) => {
      (
        outgoing.sender ?
          this.updateBalance(opts, outgoing.sender) :
          this.updateBalances(opts)
      )
        .then(() => 
          getSignedTx.apply(this, [outgoing]).then(({ signed }) => {
            this.provider.web3.eth.sendSignedTransaction(signed.rawTransaction)
              .on('receipt', (tx) => { if (notify) return notify(tx) })
              .once('confirmation', (tx) => { resolve(tx)})
              .on('error', (err) => reject(err))
          }))
    })
    p.broadcasted = (fn) => { notify = fn }
    return p
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
  * @param {number=} outgoing.maxFeePerGas ETH gas price
  * @param {number=} outgoing.maxPriorityFeePerGas ETH gas price
  * @param {object} hints hints flashbots options
  * @param {bool} hints.calldata Pass calldata
  * @param {bool} hints.logs Pass logs
  * @param {bool} hints.contractAddress Pass contractAddress
  * @param {bool} hints.functionSelector Pass functionSelector
  * @param {number=} maxBlockNumber Max block number
  * @return {Promise} Promise - tx hash when sent
  */
  async sendTransactionToFlashbotRpc (outgoing, hints, maxBlockNumber) {
    this._getSignedTx(outgoing).then(async ({ signed }) => {
      return await this.mevShareClient.sendTransaction(signed, {hints, maxBlockNumber})
    });
  }

  async getBalanceFromProvider (addr) {
    return await this.web3.eth.getBalance(addr)
  }

  isValidAddress (address) {
    return this.web3.utils.isAddress(address)
  }
}

module.exports = WalletPayEthereum
