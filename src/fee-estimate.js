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
//

'use strict'
const https = require('https')

class Blocknative {
  constructor (config = {}) {
    this.hostname = config.hostname || 'api.blocknative.com'
    this.path = config.path || '/gasprices/blockprices'
    this._latest = null
    this._latest_t = Infinity
    this._http = config.http || https
  }

  getFeeEstimate () {
    return new Promise((resolve, reject) => {
      const { hostname, path } = this

      const options = {
        hostname,
        path,
        port: 443,
        method: 'GET',
        rejectUnauthorized: false,
        requestCert: true,
        agent: false
      }

      const req = this._http.request(options, (res) => {
        let data = ''

        res.on('data', (chunk) => {
          data += chunk
        })

        res.on('end', () => {
          try {
            data = JSON.parse(data)
          } catch (e) {
            return reject(new Error('failed to get estimate'))
          }
          if (!data.blockPrices || !data.maxPrice) return reject(new Error('failed to get estimate'))
          return resolve({
            fast: data.blockPrices[0].estimatedPrices[0].maxPriorityFeePerGas,
            slow: data.blockPrices[0].estimatedPrices[4].maxPriorityFeePerGas
          })
        })
      })
      req.end()
    })
  }
}

module.exports = Blocknative