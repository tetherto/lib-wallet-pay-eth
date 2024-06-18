
const { solo, test } = require('brittle')
const EthPay = require('../src/wallet-pay-eth.js')
const KeyManager = require('../src/wallet-key-eth.js')
const { WalletStoreHyperbee } = require('lib-wallet-store')
const BIP39Seed = require('wallet-seed-bip39')
const provider = require('../src/provider.js')

async function activeWallet() {
  const eth = new EthPay({
    asset_name: 'eth',
    provider: await provider('http://127.0.0.1:8545/'),
    key_manager: new KeyManager({
      seed: await BIP39Seed.generate()
    }),
    store: new WalletStoreHyperbee(),
    network: 'regtest'
  })
  await eth.initialize({})
  return eth
}

test('Create an instances of WalletPayEth', async function (t) {
  const eth = new EthPay({
    asset_name: 'eth',
    provider: await provider('http://127.0.0.1:8545/'),
    key_manager: new KeyManager({
      seed: await BIP39Seed.generate()
    }),
    store: new WalletStoreHyperbee(),
    network: 'regtest'
  })
  await eth.initialize({})
  
  t.ok(eth.ready, 'instance is ready')
  t.comment('destoying instance')
  await eth.destroy()
})

test('getNewAddress no duplicate addresses, after recreation', async function (t) {
  const eth = await activeWallet()
  const addr = await eth.getNewAddress()
  t.ok(addr.address, 'address exists')
  t.ok(addr.publicKey, 'public key exists')
  t.ok(addr.privateKey, 'private key exists')
  t.ok(addr.path === "m/44'/60'/0'/0/0", 'private key exists')
  await eth.destroy()
})
