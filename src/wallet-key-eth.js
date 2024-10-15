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
const { hdkey: { EthereumHDKey: ethhd } } = require('@ethereumjs/wallet')

class WalletKeyEth {
  constructor (config = {}) {
    if (config.seed) {
      this.seed = config.seed
      this.hdkey = ethhd.fromMnemonic(config.seed.mnemonic)
      this.ready = true
    } else {
      this.ready = false
    }

    if (config.network) {
      this.setNetwork(config.network)
    }
  }

  setNetwork (network) {
    this.network = network
  }

  setSeed (seed) {
    if (this.seed) throw new Error('Seed already set')
    if (!this.network) throw new Error('Network not set')
    if (!seed) throw new Error('Seed is required')
    this.seed = seed
    this.hdkey = ethhd.fromMnemonic(seed.mnemonic)
    this.ready = true
  }

  /**
  * @param {string} path - BIP32 path
  * @param {string} addrType - Address type. example: p2wkh
  * @returns {Object}
  * @desc Derives a eth address from a BIP32 path
  */
  addrFromPath (path) {
    const wallet = this.hdkey.derivePath(path).getWallet()
    return {
      addr: {
        address: wallet.getAddressString().toLowerCase(),
        publicKey: wallet.getPublicKeyString(),
        privateKey: wallet.getPrivateKeyString(),
        path
      }
    }
  }

  close () {

  }
}

module.exports = WalletKeyEth
