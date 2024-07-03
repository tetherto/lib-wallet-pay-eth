const { Web3 } = require('web3')

class Provider {
  constructor (config) {
    this.web3 = new Web3(config.web3)
    this.indexerUri = config.indexer
  }

  async _callServer (method, param, path) {
    const response = await fetch(this.indexerUri + (path || 'jsonrpc'), {
      method: 'post',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method,
        param,
        id: (Math.random() * 10e10).toFixed(0)
      })
    })
    return response.json()
  }

  async init () {
    const ethChainId = await this.web3.eth.getChainId()

  }

  async getTransactionsByAddress (query) {
    const data = await this._callServer('getTransactionsByAddress', [query])
    if(data.error) throw new Error(data.error)
    return data.result
  }
}

module.exports = Provider
