const { Web3 } = require('web3')
const { WebSocket } = require('ws')
const { EventEmitter } = require('events')

class Provider extends EventEmitter {
  constructor (config) {
    super()
    this.web3 = new Web3(config.web3)
    this.indexerUri = config.indexer
    this.indexerws = config.indexerWs
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
    // TODO: check if everything is ok
    await this._startWs()
  }

  async stop () {
    this._ws.terminate()
  }

  async _startWs () {
    const ws = new WebSocket(this.indexerws)
    return new Promise((resolve, reject) => {
      ws.once('error', (err) => {
        reject(new Error('failed to connected to indexer websocket: ' + err.message))
      })

      ws.once('close', () => {
        this.emit('close')
      })

      ws.once('open', () => {
        resolve()
      })

      ws.on('message', (data) => {
        let res
        try {
          res = JSON.parse(data.toString())
        } catch (err) {
          console.log('bad event from server, ignored', err)
        }
        const evname = res?.event
        if (!evname) console.log('event has no name ignored ', res)
        this.emit(evname, res.data)
      })

      this._ws = ws
    })
  }

  async getTransactionsByAddress (query) {
    const data = await this._callServer('getTransactionsByAddress', [query])
    if (data.error) throw new Error(data.error)
    return data.result
  }

  async subscribeToAccount (addr) {
    this._ws.send(JSON.stringify({
      method: 'subscribeAccount',
      params: [addr]
    }))
  }
}

module.exports = Provider
