const { solo, test } = require('brittle')
const EthPay = require('../src/wallet-pay-eth.js')
const KeyManager = require('../src/wallet-key-eth.js')
const { WalletStoreHyperbee } = require('lib-wallet-store')
const BIP39Seed = require('wallet-seed-bip39')
const Provider = require('../src/provider.js')
const TestNode = require('../../wallet-test-tools/src/eth/index.js')
const Ethereum = require('../src/eth.currency.js')
const currencyFac = require('../src/erc20.currency.js')
const ERC20 = require('../src/erc20.js')

async function activeWallet (opts = {}) {
  const provider = new Provider({
    web3: 'ws://127.0.0.1:8545/',
    indexer: 'http://127.0.0.1:8008/',
    indexerWs: 'http://127.0.0.1:8181/'
  })
  await provider.init()
  const eth = new EthPay({
    asset_name: 'eth',
    provider,
    key_manager: new KeyManager({
      seed: opts.newWallet ? await BIP39Seed.generate() : await BIP39Seed.generate('taxi carbon sister jeans notice combine once carpet know dice oil solar')
    }),
    store: new WalletStoreHyperbee(),
    network: 'regtest',
    token: [
      new ERC20({
        currency: USDT
      })
    ]
  })
  await eth.initialize({})
  return eth
}

async function getTestnode () {
  const eth = new TestNode()
  await eth.init()
  return eth
}

const USDT = currencyFac({
  name: 'USDT',
  base_name: 'USDT',
  contractAddress: '0x0165878A594ca255338adfa4d48449f69242Eb8F',
  decimal_places: 6
})

test('Create an instances of WalletPayEth', async function (t) {
  const provider = new Provider({
    web3: 'ws://127.0.0.1:8545/',
    indexer: 'http://127.0.0.1:8008/',
    indexerWs: 'http://127.0.0.1:8181/'
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

solo('getNewAddress', async function (t) {
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

async function syncTest (t, sync) {
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

  if (sync) {
    t.comment('sync addresses')
    await eth.syncTransactions()
  } else {
    t.comment('waiting for event')
    await new Promise((res) => {
      eth.on('new-tx', () => {
        res()
      })
    })
  }

  const bal = await eth.getBalance({}, addr.address)
  t.ok(+bal.confirmed.toMainUnit() === amt1, 'sent balance matches')
  const totalBal = await eth.getBalance({})
  t.ok(totalBal.confirmed.toMainUnit() === '0.00007', 'total balance matches')

  const t0 = t.test('getTransactions')

  const amts = [amt1, amt2]
  let lastBlock
  await eth.getTransactions({}, (block) => {
    t0.ok(block.length === 1, 'Get block tx length 1')
    const tx = block.pop()
    if (lastBlock) {
      t.ok(tx.height > lastBlock, 'block number increasing')
    }
    lastBlock = tx.height
    const amt = amts.shift()
    t0.ok(new Ethereum(tx.value).toBaseUnit() === new Ethereum(amt, 'main').toBaseUnit(), 'amount matches')
  })
  t.ok(amts.length === 0, 'all expected  transactions found')
  t0.end()
  await eth.destroy()
}

test('new wallet syncTransactions', async (t) => {
  await syncTest(t, true)
})

solo('new wallet, websocket tx detection', async (t) => {
  await syncTest(t, false)
})

test('sendTransaction', async (t) => {
  const node = await getTestnode()
  const eth = await activeWallet({ newWallet: false })
  const nodeAddr = await node.getNewAddress()
  const testAddr = await eth.getNewAddress()
  await node.mine(1)
  t.comment(`sending eth to ${testAddr.address}`)
  await node.sendToAddress({ amount: 1.1, address: testAddr.address })
  await eth.syncTransactions()
  const res = eth.sendTransaction({}, {
    address: nodeAddr,
    amount: 0.0001,
    unit: 'main'
  })

  let bcast = false
  res.broadcasted((tx) => {
    t.ok(tx.to.toString().toLowerCase() === nodeAddr.toLowerCase(), 'recipient is correct')
    // TODO: Fetch tx from servers and compare values with sent values
    bcast = true
  })

  const tx = await res
  t.ok(tx.confirmations === 1n, 'transaction is confirmed')
  t.ok(tx.latestBlockHash, 'tx has block hash')
  if (!bcast) throw new Error('broadcast call back not called')
  await eth.destroy()
})

test('getActiveAddresses', async (t) => {
  const eth = await activeWallet({ newWallet: true })
  const node = await getTestnode()
  const sends = [
    [await eth.getNewAddress(), 1.1],
    [await eth.getNewAddress(), 1.5]
  ]
  for (const s in sends) {
    const [addr, amount] = sends[s]
    await node.sendToAddress({ amount, address: addr.address })
  }
  await eth.syncTransactions()
  const addrs = await eth.getActiveAddresses()
  let x = 0
  for (const [addr, bal] of addrs) {
    const [sendAddr, amt] = sends[x]
    t.ok(addr === sendAddr.address, `Address index ${x} matches`)
    t.ok(bal.toMainUnit() === amt.toString(), `Amount index ${x} matches`)
    x++
  }
  t.ok(x == sends.length, 'all addresses found')
});

(() => {
  const tkopts = { token: USDT.name }

  const skip = false
  test('ERC20: getBalance', { skip }, async (t) => {
    const eth = await activeWallet({ newWallet: true })
    const node = await getTestnode()
    const sendAmount = BigInt(Math.floor(Math.random() * (20 - 2 + 1) + 2))
    const addr = await eth.getNewAddress()
    t.ok(addr.address, 'can generate address')

    let balance = await eth.getBalance(tkopts, addr.address)
    t.ok(balance.confirmed.toMainUnit() === '0', 'token balance is zero')
    t.comment(`Sending: ${sendAmount} tokens  to ${addr.address}`)
    await node.sendToken({
      address: addr.address,
      amount: sendAmount
    })

    await eth.syncTransactions(tkopts)
    balance = await eth.getBalance(tkopts, addr.address)
    t.ok(balance.confirmed.toMainUnit() === sendAmount.toString(), 'balance matches send amount')
    await eth.destroy()
  })

  test('ERC20: syncTransactions', { skip }, async (t) => {
    const eth = await activeWallet({ newWallet: true })
    const node = await getTestnode()
    const sendAmount = BigInt(Math.floor(Math.random() * (20 - 2 + 1) + 2))
    const amt2 = 123
    const addr = await eth.getNewAddress()
    t.comment(`Sending: ${sendAmount} tokens  to ${addr.address}`)
    await node.sendToken({
      address: addr.address,
      amount: sendAmount
    })

    t.comment(`Sending: ${amt2} tokens  to ${addr.address}`)
    await node.sendToken({
      address: addr.address,
      amount: amt2
    })

    await eth.syncTransactions(tkopts)
    const t0 = t.test('getTransactions')

    const amts = [sendAmount, amt2]
    let lastBlock
    await eth.getTransactions(tkopts, (block) => {
      t0.ok(block.length === 1, 'block tx length 1')
      const tx = block.pop()
      if (lastBlock) {
        t.ok(tx.height > lastBlock, 'block number increasing')
      }
      lastBlock = tx.height
      const amt = amts.shift()
      t0.ok(new USDT(tx.value).toBaseUnit() === new USDT(amt, 'main').toBaseUnit(), 'amount matches')
    })
    t.ok(amts.length === 0, 'all expected  transactions found')
    t0.end()
    await eth.destroy()
  })

  test('ERC20: getActiveAddresses', { skip }, async (t) => {
    const eth = await activeWallet({ newWallet: true })
    const node = await getTestnode()
    const sends = [
      [await eth.getNewAddress(), 10],
      [await eth.getNewAddress(), 12]
    ]
    for (const s in sends) {
      const [addr, amount] = sends[s]
      await node.sendToken({ amount, address: addr.address })
    }
    await eth.syncTransactions(tkopts)
    const addrs = await eth.getActiveAddresses(tkopts)
    let x = 0
    for (const [addr, bal] of addrs) {
      const [sendAddr, amt] = sends[x]
      t.ok(addr === sendAddr.address, `Address index ${x} matches`)
      t.ok(bal.toMainUnit() === amt.toString(), `Amount index ${x} matches`)
      x++
    }
    t.ok(x == sends.length, 'all addresses found')
  })

  test('ERC20: sendTransactions', { skip }, async (t) => {
    const eth = await activeWallet({ newWallet: true })
    const node = await getTestnode()
    const nodeAddr = await node.getNewAddress()
    const sends = [
      [await eth.getNewAddress(), 10],
      [await eth.getNewAddress(), 12]
    ]
    for (const s in sends) {
      const [addr, amount] = sends[s]
      await node.sendToAddress({ amount: 1, address: addr.address })
      await node.sendToken({ amount, address: addr.address })
    }
    await eth.syncTransactions()
    await eth.syncTransactions(tkopts)
    const addrs = await eth.getFundedTokenAddresses(tkopts)
    let x = 0
    for (const [addr, bal] of addrs) {
      const [tbal] = bal
      await eth.sendTransaction(tkopts, {
        sender: addr,
        amount: tbal.toMainUnit(),
        unit: 'main',
        address: nodeAddr
      })
      const newBal = await eth.getBalance(tkopts, addr)
      t.ok(newBal.confirmed.toBaseUnit() === '0', `token account #${x} balance is zero after sending all`)
      x++
    }
    t.ok(x == sends.length, 'all addresses found')
    await eth.destroy()
  })
})()
