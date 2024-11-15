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
const { HdWallet } = require('lib-wallet')
const { EventEmitter } = require('events')
const StateDb = require('./state')

class ERC20 extends EventEmitter {
  constructor (config) {
    super()
    this.Currency = config.currency
    this.name = this.Currency.name
    if (!this.name) throw new Error('ERC20: name is missing')
  }

  async init (baseChain) {
    this.provider = baseChain.provider
    this._getGasPrice = baseChain._getGasPrice
    this._ToBalance = baseChain.constructor.createBalance(this.Currency)
    this._hdWallet = new HdWallet({
      store: baseChain.store.newInstance({ name: 'hdwallet-eth-' + this.name }),
      coinType: "60'",
      purpose: "44'"
    })
    this.state = new StateDb({
      store: baseChain.store.newInstance({ name: 'state-eth-' + this.name }),
      hdWallet: this._hdWallet,
      Currency: this.Currency
    })

    await this.state.init()
    await this._hdWallet.init()

    this._setupContract()
  }

  async _destroy () {
    await this.state.close()
    await this._hdWallet.close()
  }

  getTokenInfo () {
    const token = this.Currency.getContract()
    return {
      contractAddress: token.address
    }
  }

  _setupContract () {
    const web3 = this.provider.web3
    const { ABI, address } = this.Currency.getContract()
    this._contract = new web3.eth.Contract(ABI, address)
  }

  /**
  * @description Detected a new token transaction
  * */
  async updateTxEvent (res) {
    if (!res?.tx?.height) return
    const { addr, tx } = res
    tx.value = new this.Currency(tx.value, 'base')
    await this.state.storeTxHistory(tx)
    const balances = await this.state.getBalances()
    const bal = await this.getBalance({}, res.addr)
    await balances.setBal(res.addr, bal.confirmed)
    await this._hdWallet.addAddress(addr)
    return tx
  }

  get tokenContract () {
    return this._contract._address
  }

  async getBalance (opts, addr) {
    if (!addr) {
      const bal = await this.state.getBalances()
      return new this._ToBalance(bal.getTotal())
    }

    let bal
    try {
      bal = await this._contract.methods.balanceOf(addr).call()
    } catch (err) {
      console.log('failed to get balance', addr, err)
      throw err
    }

    return new this._ToBalance(new this.Currency(bal, 'base'))
  }

  async _getPastEvents (filter) {
    const res = await this._contract.getPastEvents('Transfer', { filter, fromBlock: 0, toBlock: 'latest' })
    return res.map((data) => {
      return {
        txid: data.transactionHash,
        height: data.blockNumber.toString(),
        from: data.returnValues._from.toLowerCase(),
        to: data.returnValues._to.toLowerCase(),
        value: new this.Currency(data.returnValues._value.toString(), 'base')
      }
    })
  }

  /**
  * @description fetch tx history of an address and update balance
  **/
  async syncPath (addr, signal) {
    const from = await this._getPastEvents({ _to: addr.address })
    const to = await this._getPastEvents({ _from: addr.address })
    const total = from.concat(to)

    if (total.length === 0) return signal.noTx

    for (const tx of total) {
      await this.state.storeTxHistory(tx)
    }
    const balances = await this.state.getBalances()
    const bal = await this.getBalance({}, addr.address)
    await balances.setBal(addr.address, bal.confirmed)
    await this._hdWallet.addAddress(addr)
    return signal.hasTx
  }

  async sendTransactions (opts, outgoing) {
    const { web3 } = this.provider
    const amount = new this.Currency(outgoing.amount, outgoing.unit)
    let sender
    if (!outgoing.sender) {
      throw new Error('sender is not passed')
    } else {
      sender = await this._hdWallet.getAddress(outgoing.sender)
    }
    const abi = this._contract.methods.transfer(outgoing.address, amount.toMainUnit()).encodeABI()
    const tx = {
      from: sender.address,
      to: this._contract._address,
      data: abi,
      gas: outgoing.gasLimit || (await web3.eth.getBlock()).gasLimit,
      gasPrice: outgoing.gasPrice || await this._getGasPrice()
    }

    const signedTx = await web3.eth.accounts.signTransaction(tx, sender.privateKey)

    const p = new Promise((resolve, reject) => {
      web3.eth.sendSignedTransaction(signedTx.rawTransaction)
        .on('receipt', (d) => {
          resolve(d)
        }).on('error', reject)
    })
    p.broadcasted = () => {}
    return p
  }

  getState () {
    return this.state
  }
}

module.exports = ERC20
