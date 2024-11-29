const { WalletStoreHyperbee } = require('lib-wallet-store')
const BIP39Seed = require('../wallet-seed-bip39')
const KeyManager = require('./src/wallet-key-eth')
const { Provider, erc20CurrencyFac, EthPay, Erc20 } = require('./index')
const myAddr = '0x695beade482b3cea23497ae7fc23cc187b1f67f4'
const genAddr = '0xcace56f3bd6c7ba9696f45dbd2e6f3a72f4af3ee'

;(async () => {
  try {
    // const seed = await BIP39Seed.generate()
    const storeEngine = new WalletStoreHyperbee({
      store_path: './db'
    })
    await storeEngine.init()

    const USDT = erc20CurrencyFac({
      name: 'USDT',
      base_name: 'USDT',
      contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
      decimal_places: 6
    })

    const provider = new Provider({
      web3: 'ws://34.65.144.199/eth/hardhat/indexer/web3',
      indexer: 'http://34.65.144.199/eth/hardhat/indexer/rpc',
      indexerWs: 'http://34.65.144.199/eth/hardhat/indexer/ws'
    })

    await provider.init()

    const ethPay = new EthPay({
      asset_name: 'eth',
      provider,
      key_manager: new KeyManager({
        seed: await BIP39Seed.generate()
      }),
      network: 'mainnet',
      store: storeEngine,
      token: [
        new Erc20({ currency: USDT, name: 'USDT' })
      ]
    })

    await ethPay.initialize({})

    const myAddrBalance = await ethPay.getBalance({
      token: 'USDT'
    }, myAddr)
    console.log('myAddrBalance :> ', myAddrBalance)

    const genAddrBalance = await ethPay.getBalance({
      token: 'USDT'
    }, genAddr)
    console.log('genAddrBalance :> ', genAddrBalance)

    ethPay.on('synced-path', (path) => {
      console.log('synced-path :> path :> ', path)
    })

    const addrs = await ethPay.getActiveAddresses({ token: 'USDT' })
    console.log('addrs :> ', addrs)

    await ethPay.syncTransactions({
      reset: true,
      token: 'USDT'
    })

    await ethPay.getTransactions({ token: 'USDT' }, (res) => {
      console.log('ethPay.getTransactions :> res :> ', res)
    })
  } catch (err) {
    console.error('oops :> ', err)
    process.exit(1)
  }
})()
