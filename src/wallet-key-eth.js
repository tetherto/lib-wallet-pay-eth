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
  * @desc Derives a bitcoin address from a BIP32 path
  */
  addrFromPath (path) {
    const wallet = this.hdkey.derivePath(path).getWallet()
    return {
      addr: {
        address: wallet.getAddressString(),
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
