<p align="center" width="100">
<a href="https://github.com/tetherto/lib-wallet">
<img src="https://github.com/tetherto/lib-wallet/blob/main/docs/logo.svg" width="200"/>
</a>
</p>


# 🏦 lib-wallet-pay-eth

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
This module requires an indexer server. See [lib-wallet-indexer](https://github.com/tetherto/lib-wallet-indexer)

## 🚀 Usage

```javascript
// Start with a storage engine
const storeEngine = new WalletStoreHyperbee({
  store_path: './db'
})
await storeEngine.init()

// Generate a seed or use a mnemonic phrase
const seed = await BIP39Seed.generate(/** Can enter mnemonic phrase here too */)

// Setting up ERC20 tokens 
const USDT = currencyFac({
  name: 'USDT',
  base_name: 'USDT',
  contractAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  decimal_places: 6
})

// Connect to a provider 
const provider = await Provider({ 
    web3: 'localhost:8888',          // URI to Web3 provider
    indexer: 'localhost:8000/rpc',   // URI to lib-wallet-indexer-eth rpc
    indexerWs: 'localhost:8000/ws',  // URI to lib-wallet-indexer-eth ws
})
// Start provider
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

// Listen to each path that has transactions 
ethPay.on('synced-path', (path) => {
 // syncing hd path
})

// Parse blockchain for transactions to your wallet 
const pay = await  ethPay.syncTransactions({ 
    reset: false,  // Passing true will resync from scratch 
    token: "USDT"  // Passing token name will sync token transaction
})

// Pause the sync process
await ethPay.pauseSync()

// Get a new address
const { address } = await ethPay.getNewAddress()

// Get token balance   
const addrBalance = await ethPay.getBalance({
    token: "USDT"  // send token name to get balance of token
}, address)

// Get total balance across all addresses 
const walletBalance = await ethPay.getBalance({})

// Send ETH to an address 
const result = await ethPay.sendTransaction({
    address: '0xaaa...',  // ETH address of the recipient
    amount: '1',       // Value of amount 
    unit: 'main',         // unit of amount: main = ETH and base = wei unit
})

// Get a list of transactions 
const txs = await ethPay.getTransactions({
    token : "USDT",
})

// Is address a valid Ethereum address? 
const isvalid = await ethPay.isValidAddress('0xaaa...')

// Destroy instance of the wallet 
await ethPay.destroy()
```

## 📚 Methods

#### 🚀 `initialize(ctx)`
* **Description**: Initializes the wallet, setting up the key manager, HD wallet, and state database.
* **Return Value**: A Promise that resolves when initialization is complete.
* **Parameters**:
  + `ctx`: Context object for initialization (optional).

Example usage:
```javascript
await wallet.initialize();
```

#### 🏠 `getNewAddress()`
* **Description**: Generates a new Ethereum address for the wallet.
* **Return Value**: A Promise that resolves to an object containing the new address details.

Example usage:
```javascript
const newAddress = await wallet.getNewAddress();
console.log(newAddress); // Output: { address: '0x...', path: 'm/44'/60'/0'/0/0', ... }
```

#### 📜 `getTransactions(opts, fn)`
* **Description**: Retrieves the transaction history for the wallet or a specific token.
* **Return Value**: A list of transaction objects.
* **Parameters**:
  + `opts` (optional): An object containing options.
    - `token` (optional): Name of the token for token transaction history.

Example usage:
```javascript
const txs = await wallet.getTransactions({});
```

#### 💰 `getBalance(opts, addr)`
* **Description**: Retrieves the balance of an address or the entire wallet.
* **Return Value**: A Promise that resolves to a Balance object.
* **Parameters**:
  + `opts` (optional): An object containing options.
    - `token` (optional): Name of the token to get balance for.
  + `addr` (optional): Specific address to get balance for.

Example usage:
```javascript
const totalBalance = await wallet.getBalance({});
console.log(totalBalance); // Output: Balance object for the entire wallet

const addressBalance = await wallet.getBalance({}, '0x1234...');
console.log(addressBalance); // Output: Balance object for the specific address

const tokenBalance = await wallet.getBalance({ token: 'USDT' });
console.log(tokenBalance); // Output: Balance object for the specified token
```

#### 📊 `syncTransactions(opts)`
* **Description**: Synchronizes transactions for the wallet, updating balances and transaction history.
* **Return Value**: A Promise that resolves when synchronization is complete.
* **Parameters**:
  + `opts` (optional): An object containing options.
    - `reset` (optional): If true, resets all state and resyncs.
    - `token` (optional): Name of the token to sync transactions for.

Example usage:
```javascript
await wallet.syncTransactions({ reset: true });
```

#### 📤 `sendTransaction(opts, outgoing)`
* **Description**: Sends a transaction from the wallet.
* **Return Value**: A Promise that resolves when the transaction is confirmed.
* **Parameters**:
  + `opts` (optional): An object containing options.
    - `token` (optional): Name of the token to send.
  + `outgoing`: An object containing transaction details.
    - `amount`: Number of units being sent.
    - `unit`: Unit of amount ('main' or 'base').
    - `address`: Address of the receiver.
    - `sender` (optional): Address of the sender.
    - `gasLimit` (optional): ETH gas limit.
    - `gasPrice` (optional): ETH gas price.

Example usage:
```javascript
const txPromise = wallet.sendTransaction({}, {
  amount: 1,
  unit: 'main',
  address: '0x5678...'
});

txPromise.broadcasted((tx) => {
  console.log('Transaction broadcasted:', tx);
});

const confirmedTx = await txPromise;
console.log('Transaction confirmed:', confirmedTx);
```

#### ✅ `isValidAddress(address)`
* **Description**: Checks if the given address is a valid Ethereum address.
* **Return Value**: A boolean indicating whether the address is valid.
* **Parameters**:
  + `address`: The Ethereum address to validate.

Example usage:
```javascript
const isValid = wallet.isValidAddress('0x1234...');
console.log(isValid); // Output: true or false
```
#### ✅ `getFundedTokenAddresses(opts)`
* **Description**: returns addresses that have a balance
* **Return Value**: A Map of addresses and balances
* **Parameters**:
  + `token`: A string for the token name

Example usage:
```javascript
const addrBal = wallet.getFundedTokenAddresses({ token : 'USDT'});
console.log(addBal); // Map(<addr> : { ETH balance, USDT Balance }
```

#### ⏸️ `pauseSync()`
* **Description**: Pauses the synchronization process.
* **Return Value**: A Promise that resolves when synchronization is paused.

Example usage:
```javascript
await wallet.pauseSync();
```

#### ▶️ `resumeSync()`
* **Description**: Resumes the synchronization process.
* **Return Value**: A Promise that resolves when synchronization is resumed.

Example usage:
```javascript
await wallet.resumeSync();
```

## 🔔 Events

The `EthereumPay` instance emits the following events:

### 1. 🟢 `'ready'`

* **Description**: Emitted when the wallet is fully initialized and ready for use.
* **Callback Parameters**: None

Example usage:
```javascript
ethPay.on('ready', () => {
  console.log('Eth wallet is ready for use');
});
```

### 2. 🔄 `'synced-path'`

* **Description**: Emitted for each HD path that has been synced during the transaction synchronization process.
* **Callback Parameters**: 
  - `pathType` (String): Type of the path (e.g., 'external', 'internal')
  - `path` (String): The HD path that was synced
  - `hasTx` (Boolean): Whether the path has any transactions
  - `progress` (Object): Sync progress information

Example usage:
```javascript
ethPay.on('synced-path', (pathType, path, hasTx, progress) => {
  console.log(`Synced path: ${pathType} ${path}, Has transactions: ${hasTx}`);
  console.log('Sync progress:', progress);
});
```

### 3. 💸 `'new-tx'`

* **Description**: Emitted when a new transaction is detected for the wallet.
* **Callback Parameters**: 
  - `transaction` (Object): The new transaction object

Example usage:
```javascript
ethPay.on('new-tx', (transaction) => {
  console.log('New transaction detected:', transaction);
});
```



## 🛠️ Setup

1. Initialize storage engine
2. Generate or use existing seed
3. Set up ERC20 tokens (if needed)
4. Connect to provider
5. Create and initialize EthereumPay instance

## 🛠️ Development

1. [Setup local Ethereum Hardhat enviroment](https://github.com/tetherto/wallet-lib-test-tools/blob/main/src/eth/README.md)
2. Clone the repository:
3. Install dependencies:
   ```
   npm install
   ```
4. Run various tests:
   ```
   npm run test:pay
   ```

### 🧪 Testing

- This package includes extensive integration tests.
- We use [Brittle](https://github.com/holepunchto/brittle) for testing.
- Integration tests require an Ethereum node connected to a testnet or local network.
- To set up the testing environment, see: [Test tools repo](https://github.com/tetherto/wallet-lib-test-tools/blob/main/src/eth/README.md)

To run tests, check `package.json` for the various test scripts. You can run them using:

```
npm run test:*
```

