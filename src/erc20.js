const { EventEmitter } = require('events')
const StateDb = require('./state')

class ERC20 extends EventEmitter {
  constructor(config){
    super()
    this.Currency = config.currency
    this.name = this.Currency.name 
    if(!this.name) throw new Error('ERC20: name is missing')
  }


  init(baseChain) {
    this.provider = baseChain.provider
    this._toBalance = baseChain.constructor.createBalance(this.Currency)
    this.state = new StateDb({
      store: baseChain.store.newInstance({ name: 'state-eth-'+this.name }),
      hdWallet: baseChain._hdWallet,
      Currency: this.Currency
    })

    this._setupContract()
  }

  destroy() {
  }

  _setupContract() {
    const web3 = this.provider.web3
    const { ABI, address } = this.Currency.getContract()
    this._contract = new web3.eth.Contract(ABI, address)
  }

  async getBalance(opts, addr){
    //todo: get state balance or get single address balance
    return this._contract.methods.balanceOf(addr).call()
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

  async syncPath(addr, syncState, signal) {
    const from = await this._getPastEvents({_to: addr.address   })
    const to = await this._getPastEvents({ _from: addr.address   })
    const total = from.concat(to)
    for(const tx of total) {
      await this.state.storeTxHistory(tx)
    }
    return total.length > 0 ? signal.hasTx : signal.noTx
  }


  getState() {
    return this.state
  }
}


module.exports = ERC20
