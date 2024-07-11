
class Balances {
  constructor (val, state) {
    this.state = state
    this.value = new Map()
    for(let addr in val) {
      const d  = val[addr]
      this.value.set(addr, this._newCurrency(d))
    }
  }
  
  _newCurrency() {
    return new this.state.Currency(...arguments)
  }

  async add (addr, balance) {
    const bal = this.value.get(addr)
    if (!bal) {
      this.value.set(addr, balance)
    } else {
      const newbal = bal.add(balance)
      this.value.set(addr, newbal)
    }
    await this.state.storeBalances(this)
    return balance
  }

  toJSON () {
    return Object.fromEntries(this.value)
  }

  getTotal () {
    let total = this._newCurrency(0, 'base')
    for (const value of this.value) {
      total = total.add(this._newCurrency(value[1]))
    }
    return total
  }

  async getAddrByBalance(amount){
    for(const [addr, bal] of this.value) {
      if(bal.gte(amount)) {
        const addrObj  = await this.state._hdWallet.getAddress(addr)
        if(!addrObj) throw new Error('Address missing from addr list')
        return addrObj
      } 
    }
    return null
  }

  async getAll(){
    return this.value
  }
}


class StateDb {
  constructor (config) {
    this.store = config.store
    this._hdWallet = config.hdWallet
    this.Currency = config.Currency
    this._balances = null
    this._txIndex = null
  }

  async init () {
    await this.store.init()
  }

  storeBalances (balance) {
    this._balances = balance 
    return this.store.put('current_balance', balance.toJSON())
  }

  async getBalances () {
    if(this._balances) return this._balances
    const bal = await this.store.get('current_balance')
    return new Balances(bal, this)
  }

  async getAddress(address) {
    const list = await this._hdWallet.getAllAddress()
    console.log(list)
    return list.find((addr) =>{
      console.log(addr)
      return addr.address === address
    })
  }

  getTxIndex() {
    return this._txIndex || this.store.get('tx_index')
  }

  async updateTxIndex(i) {
    let index = await this.getTxIndex()
    if(!index) index = { earliest : i, latest: i}
    else if(i < index.earliest) {
      index.earliest = i 
    } else if ( i > index.latest ) {
      index.latest = i 
    }
    this._txIndex = index
    return this.store.put('tx_index')
  }

  async storeTxHistory(data) {
    const i = data.height
    await this.updateTxIndex(i)
    const blockTx = await this.getTxHistory(i)
    blockTx.push(data)
    return this.store.put('height:'+i, blockTx)
  }

  async getTxHistory(i) {
    const res = await this.store.get('height:'+i)
    if(!res) return []
    return res 
  }

  reset() {
    return this.store.clear()
  }

}

module.exports = StateDb
