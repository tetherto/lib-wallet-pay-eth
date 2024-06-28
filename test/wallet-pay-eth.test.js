const { solo, test } = require('brittle')
const EthPay = require('../src/wallet-pay-eth.js')
const KeyManager = require('../src/wallet-key-eth.js')
const { WalletStoreHyperbee } = require('lib-wallet-store')
const BIP39Seed = require('wallet-seed-bip39')
const Provider = require('../src/provider.js')
const TestNode = require('../../wallet-test-tools/src/eth/index.js')
const Ethereum = require('../src/eth.currency.js')

async function activeWallet (opts = {}) {
  const provider = new Provider({
    web3: 'http://127.0.0.1:8545/',
    indexer: 'http://127.0.0.1:8008/'
  })
  await provider.init()
  const eth = new EthPay({
    asset_name: 'eth',
    provider,
    key_manager: new KeyManager({
      seed: opts.newWallet ? await BIP39Seed.generate() : await BIP39Seed.generate('taxi carbon sister jeans notice combine once carpet know dice oil solar')
    }),
    store: new WalletStoreHyperbee(),
    network: 'regtest'
  })
  await eth.initialize({})
  return eth
}

async function getTestnode () {
  const eth = new TestNode()
  await eth.init()
  return eth
}

test('Create an instances of WalletPayEth', async function (t) {
  const provider = new Provider({
    web3: 'http://127.0.0.1:8545/',
    indexer: 'http://127.0.0.1:8008/'
  })
  await provider.init()
  const eth = new EthPay({
    asset_name: 'eth',
    provider,
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

test('getNewAddress', async function (t) {
  const expect = {
    address: '0xb89c31da0a0d796240dc99e551287f16145ce7a3',
    publicKey: '0xe835543d53422a1289b494439760bc529f9baa34032b4b24530f5299fd1401dd93519953291a65838b2e8b69b22b28c0c56c76870ce72545f79a8042436ae033',
    privateKey: '0xe595bf345fbb7ab56636bc4777b1b4e53b0de7de2ee7be635b2638ee4a90c1ee',
    path: "m/44'/60'/0'/0/0"
  }
  const eth = await activeWallet()
  const addr = await eth.getNewAddress()
  for (const key in expect) {
    t.ok(addr[key] === expect[key], `address.${key} matches mnemonic`)
  }
  const add = await eth.getNewAddress()
  t.ok(add.path === "m/44'/60'/0'/0/1", 'address path is incremented')
  await eth.destroy()
})

test('syncTransactions new wallet', async function (t) {
  const eth = await activeWallet({ newWallet: true })
  const node = await getTestnode()
  const addr = await eth.getNewAddress()
  const addr2 = await eth.getNewAddress()
  const amt1 = 0.00002
  const amt2 = 0.00005
  t.comment('send eth to address ', addr.address)
  await node.sendToAddress({ address: addr.address, amount: amt1 })
  t.comment('send eth to address ', addr2.address)
  await node.sendToAddress({ address: addr2.address, amount: amt2 })
  t.comment('mining')
  await node.mine()
  t.comment('sync addresses')
  await eth.syncTransactions()
  const bal = await eth.getBalance({}, addr.address)
  t.ok(+bal.confirmed.toMainUnit() === amt1, 'sent balance matches')
  const totalBal = await eth.getBalance({})
  t.ok(totalBal.confirmed.toMainUnit() === '0.00007', 'total balance matches')


  const t0 = t.test('getTransactions')

  let amts  = [amt1,amt2]
  let lastBlock
  await eth.getTransactions((block)=>{
    t0.ok(block.length === 1, `Get block tx length 1`)
    const tx = block.pop()
    if(lastBlock) {
      t.ok(tx.blockNumber > lastBlock, 'block number increasing')
    }
    lastBlock = tx.blockNumber
    const amt = amts.shift()
    t0.ok(tx.value.toString() === new Ethereum(amt, 'main').toBaseUnit(), 'amount matches')
  })
  t.ok(amts.length === 0, 'all expected  transactions found')
  t0.end()
  await eth.destroy()
})


solo('sendTransaction',async  (t) => {
  const node = await getTestnode()
  const eth = await activeWallet({ newWallet: false })
  const nodeAddr = await node.getNewAddress()
  await eth.syncTransactions()
  await node.mine(1)
  t.comment(`sending eth to ${nodeAddr}`)
  const res =  eth.sendTransaction({}, {
    address: nodeAddr,
    amount: 0.0001,
    unit: 'main',
  })

  let bcast = false
res.broadcasted((tx) => {
    t.ok(true, 'tx broadcasted')
    t.ok(tx.to === 'nodeAddr', 'recipient is correct')
    bcast = true
  })

  const tx = await res
  t.ok(tx.confirmations === 1n, 'transaction is confirmed')
  t.ok(tx.latestBlockHash, 'tx has block hash')
  if(!bcast) throw new Error('broadcast call back not called')
  await eth.destroy()
})
