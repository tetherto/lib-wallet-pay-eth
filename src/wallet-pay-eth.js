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
const { GasCurrencyBase } = require('lib-wallet-util-evm')
const KM = require('./wallet-key-eth.js')

class Ethereum extends GasCurrencyBase {
  constructor () {
    const opts = arguments[2] || {}
    opts.name = opts.name ||  'ETH'
    opts.base_name = opts.base_name || 'WEI'
    opts.decimal_places = opts.decimal_places || 18
    super(...arguments)
    this.name = opts.name
    this.base_name = opts.base_name
    this.decimal_places = opts.decimal_places
  }
}

class WalletPayEthereum extends EvmPay {
  constructor (config) {
    config.GasCurrency = Ethereum
    super(config)

    this.web3 = config?.provider?.web

    this.startSyncTxFromBlock = 6810041
  }

  async initialize (ctx) {
    const km = new KM({ network: this.network })
    return await this._initialize(ctx, {
      defaultKeyManager: km,
      providerConfig: {
        web3: this.config.web3,
        indexer: this.config.indexer_rpc,
        indexerWs: this.config.indexer_ws
      },
      walletConfig: {
        name: 'hdwallet-eth',
        coinType: "60'",
        purpose: "44'",
        gapLimit: 5
      },
      stateConfig: {
        name: 'state-eth'
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
      value: new Ethereum(tx.value, 'base'), 
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

    await state._hdWallet.eachExtAccount(async (syncState, signal) => {
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
    const amount = new Ethereum(outgoing.amount, outgoing.unit)
    let sender

    if (!outgoing.sender) {
      const bal = await this.state.getBalances()
      sender = await bal.getAddrByBalance(amount)
    } else {
      sender = await this._hdWallet.getAddress(outgoing.sender)
    }

    if (!sender) throw new Error('insufficient balance or invalid sender')

    let gasLimit = outgoing.gasLimit

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
        outgoing.sender
          ? this.updateBalance(opts, outgoing.sender)
          : this.updateBalances(opts)
      )
        .then(() =>
          getSignedTx.apply(this, [outgoing]).then(({ signed }) => {
            this.provider.web3.eth.sendSignedTransaction(signed.rawTransaction)
              .on('receipt', (tx) => { if (notify) return notify(tx) })
              .once('confirmation', (tx) => { resolve(tx) })
              .on('error', (err) => reject(err))
          }))
    })
    p.broadcasted = (fn) => { notify = fn }
    return p
  }

  async getBalanceFromProvider (addr) {
    return await this.web3.eth.getBalance(addr)
  }

  isValidAddress (address) {
    return this.web3.utils.isAddress(address)
  }
}

module.exports = WalletPayEthereum
