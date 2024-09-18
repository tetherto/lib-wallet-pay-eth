# lib-wallet-pay-eth 💰🔗

Ethereum and ERC20 payment method for the wallet library. Using lib-wallet-indexer-eth and Web3 backend.

## 💼 Wallet SDK
This library is part of the [Wallet SDK](https://github.com/tetherto/lib-wallet)
See the module in action [here](https://github.com/tetherto/lib-wallet/tree/main/example)


## 📚 Key Features
- 🔐 Secure wallet management for Ethereum and ERC20 tokens
- 🔄 Transaction syncing and balance tracking
- 🏠 Address generation and validation
- 💸 Send and receive transactions
- ⏸️ Pausable sync process
- 🔍 Transaction history retrieval

## 🗄️ Indexer
This module requires a indexer server. See [lib-wallet-indexer](https://github.com/tetherto/lib-wallet-indexer)

## 🚀 Usage

```javascript
// Start with a storage engine
const storeEngine = new WalletStoreMemory()
await storeEngine.init()

// Generate a seed or use a mnemonic phrase
const seed = await BIP39Seed.generate(/** Can enter mnemonic phrase here too */)

// Setting up ERC20 tokens 
const USDT = currencyFac({
  name: 'USDT',
  base_name: 'USDT',
  contractAddress: '0x0165878A594ca255338adfa4d48449f69242Eb8F',
  decimal_places: 6
})

// Connect to a provider 
const provider = await Provider({ 
    web3: 'localhost:8888',         // URI to Web3 provider
    indexer: 'localhost:8000',      // URI to lib-wallet-indexer-eth rpc
    indexerws: 'localhost:1211'     // URI to lib-wallet-indexer-eth websocket
})
// Start asset
await provider.init()

// Start new eth wallet 
const ethPay = new EthereumPay({
    asset_name: 'eth',              // Unique key for the assets
    provider,                       // Ethereum provider
    key_manager: ,                  // Handles address generation library from seed
    store: storeEngine,             // Storage engine for the wallet
    tokens: [                       // List of tokens that the wallet will support
        new ERC20({
            currency: USDT
        })
    ]
})
// Start wallet
await ethPay.initialize({})

// Listen to each path that has transactions 👂
ethPay.on('synced-path', (path) => {
 // syncing hd path
})

// Parse blockchain for transactions to your wallet 🔍
const pay = ethPay.syncTransactions({ 
    reset: false,  // Passing true will resync from scratch 
    token: "USDT"  // Passing token name will sync token transaction
})

// Pause the sync process ⏸️
await ethPay.pauseSync()

// Get a new address 🏠
const { address } = await ethPay.getNewAddress()

// Get balance of an address 💵
const addrBalance = await ethPay.getBalance({
    token: "USDT"  // send token name to get balance of token
}, address)

// Get total balance across all addresses 💰
const walletBalance = await ethPay.getBalance({})

// Send ETH to an address 📤
const result = await ethPay.sendTransaction({
    token: "USDT"  // pass token's key to send token instead of ETH
}, {
    address: '0xaaa...',  // ETH address of the recipient
    amount: 0.0001,       // Value of amount 
    unit: 'main',         // unit of amount: main = ETH and base = wei unit
    gasPrice: ,           // optional
    gasLimit:             // optional
})

// Get a list of transactions 📜
const txs = await ethPay.getTransactions(query)

// Is address a valid Ethereum address? ✅
const isvalid = await ethPay.isValidAddress('0xaaa...')

// Destroy instance of the wallet 💣
await ethPay.destroy()
```


## 🛠️ Setup

1. Initialize storage engine
2. Generate or use existing seed
3. Set up ERC20 tokens (if needed)
4. Connect to provider
5. Create and initialize EthereumPay instance

## 🚦 Usage Flow

1. Listen for synced paths
2. Sync transactions
3. Generate new addresses as needed
4. Check balances
5. Send transactions
6. Retrieve transaction history

Remember to destroy the wallet instance when no longer needed!
