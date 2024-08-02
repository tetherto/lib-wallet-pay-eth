# lib-wallet-pay-eth

Ethereum and ERC20  payment method for the wallet library. Using lib-wallet-indexer-eth and Web3 backend.

## Usage

```javascript
// Start with a storage engine
// 
const storeEngine = new WalletStoreMemory()
await storeEngine.init()

// Generate a seed or use a mnemonic phrase
const seed = await BIP39Seed.generate(/** Can enter mnemonic phrase here to **/)

// Setting up ERC20 tokens
const USDT = currencyFac({
  name: 'USDT',
  base_name: 'USDT',
  contractAddress: '0x0165878A594ca255338adfa4d48449f69242Eb8F',
  decimal_places: 6
})


// Connect to an electrum server.
// This class needs a storage engine for cacheing.
// host and port are the electrum server details.
// Additional options can be passed to the Electrum class with regards to caching.
const provider = await Provider({ 
    // URI to Web3 provider
    web3: 'localhost:8888', 
    // URI to lib-wallet-indexer-eth rpc
    indexer: 'localhost:8000',
    // URI to lib-wallet-indexer-eth websocket
    indexerws: 'localhost:1211'
})
// Start function
await provider.init()

// Start new eth  wallet
const ethPay = new EthereumPay({
    // Asset name is a unique key for the assets
    // allow multiple assets of same type per wallet
    asset_name: 'eth',
    // Electrum provider.
    provider,
    // Key manager: Handlles address generation library from seed.
    key_manager: new KeyManager({
        seed
    }),
    // Wallet store: Storage engine for the wallet
    store: storeEngine
    // List of tokens that the wallet will support
    tokens : [
        new ERC20({
            currency: USDT
        })
    ]

})
// Start wallet.
await ethPay.initialize({})

// Listen to each path that has transactions.
// This wallet follow BIP84 standard for address generation and 
// the gap limit by default is 20.
ethPay.on('synced-path', (path) => {
 // syncing hd path
})

// Parse blockchain for transactions to your wallet.
// This needs to be run when recreating a wallet. 
// This can take long depending on the number of addresses a wallet has created.
const pay = ethPay.syncTransactions({ 
    reset : false,// Passing true will resync from scratch 
    token: "USDT" // Passing token name will sync token transaction
})

// Pause the sync process. 
// If the application needs to sleep and come back to resume syncing.
await ethPay.pauseSync()


// Get a new address. This will add the address to watch list for incoming payments. You should limit address generation to prevent spam.
// This will return address, HD PATH, pubkey and WIF private key of the address. 
// when generating a new address, it will automatically start listening to new tx
const { address } = await ethPay.getNewAddress()

// Get balance of an address
// Balance is returned in format of:
// Confirmed: Confirmed balance. This is transactions that have more than min number of confirmations 
// Pending: Pending balance. Transactions that have less than min number of confirmations
//Mempool: Mempool balance. Transactions that are in the mempool and have no confirmations.
// If you pass an address, it will return balance of that address in your wallet
// If you don't pass an address, it will return total balance of all addresses in your wallet.
const addrBalance = await ethPay.getBalance({
    token: "USDT" // send token name to get balance of token
}, address)

// Get total balance accress all addresses
const walletBalance = await ethPAy.getBalance({})

// Send bitcoin to an address
// Result will contain:
// - txid: Transaction ID
// - feeRate: Fee rate in sat/vByte
// - fee: Fee in satoshis
// - vSize: Virtual size of the transaction
// - hex: Raw transaction hex
// - utxo: UTXO used in the transaction
// - vout: Vout bytes of the transaction
// - changeAddress: Change address of the transaction. which contains, address, WIF, path, pub key.
const result = await btcPay.sendTransaction({}, {
  to: 'bcr111...', // bitcoin address of the recipient
  
  // Amounts of bitcoin to send 
  amount: 0.0001, // Value of amount 
  unit: 'main', // unit of amount: main = Bitcoin and base = satoshi unit

  fee: 10, // Fees in sats per vbyte. 10 = 10 sat/vByte
}))

// Get a transaction by txid
const tx = await btcPay.getTransaction(result.txid)

// Get a list of transactions
const txs = await btcPay.getTransactions(query)

// is address a valid bitcoin address
const isvalid = await btcPay.isValidAddress('bcrt1qxeyapzy3ylv67qnxjtwx8npd8ypjkuy8xstu0m')

// Destroy instance of the wallet. This stops all wallet activity.
// You need to recreate btcPay instance to use the wallet again.
await btcPay.destroy()


```
