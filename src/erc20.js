const { HdWallet } = require('lib-wallet')
const { EventEmitter } = require('events')
const StateDb = require('./state')
const { sign } = require('crypto')

class ERC20 extends EventEmitter {
  constructor(config){
    super()
    this.Currency = config.currency
    this.name = this.Currency.name 
    if(!this.name) throw new Error('ERC20: name is missing')
  }


  async init(baseChain) {
    this.provider = baseChain.provider
    this._toBalance = baseChain.constructor.createBalance(this.Currency)
    this._hdWallet = new HdWallet({
      store: baseChain.store.newInstance({ name: 'hdwallet-eth-'+this.name }),
      coinType: "60'",
      purpose: "44'"
    })
    this.state = new StateDb({
      store: baseChain.store.newInstance({ name: 'state-eth-'+this.name }),
      hdWallet: this._hdWallet,
      Currency: this.Currency
    })

    await this.state.init()
    await this._hdWallet.init()

    this._setupContract()
  }

  destroy() {
  }

  _setupContract() {
    const web3 = this.provider.web3
    const { ABI, address } = this.Currency.getContract()
    this._contract = new web3.eth.Contract(ABI, address)
  }

  getTokenInfo(){
    return {
      contractAddress: this._contract._address
    }
  }

  async getBalance(opts, addr){
    //todo: get state balance or get single address balance
    const bal = await this._contract.methods.balanceOf(addr).call()

    return new this._toBalance(new this.Currency(bal,'main'))
  }

  async _getPastEvents(filter) {
    const res = await this._contract.getPastEvents('Transfer',{ filter,  fromBlock: 0, toBlock: 'latest' })  
    return res.map((data) => {
      return {
        txid: data.transactionHash,
        height: data.blockNumber.toString(),
        from: data.returnValues._from,
        to: data.returnValues._to,
        value: new this.Currency(data.returnValues._value.toString(), 'main')
      }
    })

  }

  async syncPath(addr, signal) {
    const from = await this._getPastEvents({_to: addr.address   })
    const to = await this._getPastEvents({ _from: addr.address   })
    const total = from.concat(to)
    
    if(total.length === 0) return signal.noTx

    for(const tx of total) {
      await this.state.storeTxHistory(tx)
    }
    const balances = await this.state.getBalances()
    const bal = await this.getBalance({}, addr.address)
    await balances.setBal(addr.address, bal.confirmed)
    await this._hdWallet.addAddress(addr)
    return signal.hasTx 
  }

  async sendTransactions(opts, outgoing){
    const { web3 } = this.provider
    let notify
    const amount = new this.Currency(outgoing.amount, outgoing.unit)
    let sender
    if(!outgoing.sender) {
      throw new Error('sender is not passed')
    } else { 
      sender = await this._hdWallet.getAddress(outgoing.sender)
    }
    const abi = this._contract.methods.transfer(outgoing.address, amount.toMainUnit()).encodeABI()
    const tx = {
      from: sender.address,
      to: this._contract._address,
      gas: 50000,
      data: abi,
      gas: outgoing.gasLimit ||  (await web3.eth.getBlock()).gasLimit,
      gasPrice: outgoing.gasPrice || await this._getGasPrice(),
    };

    const signedTx = await web3.eth.accounts.signTransaction(tx, sender.privateKey)

    const p = new Promise(async (resolve, reject) => {
      web3.eth.sendSignedTransaction(signedTx.rawTransaction)
        .on('receipt', (d) => {
          resolve(d)
        }).on('error', reject )
    })
    p.broadcasted = (fn) => notify = fn
    return p

  }

  getState() {
    return this.state
  }

  async _getGasPrice() {
    return 346409989
  }
}


module.exports = ERC20
