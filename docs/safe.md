# Setting up safe with pimlico

A brief guide on how to use lib-wallet-pay-eth with safe and pimlico.

## Index

1. [Requirements](#requirements)
2. [Configuration](#configuration)
    - [Ethereum mainnet](#ethereum-mainnet)
    - [Ethereum sepolia](#ethereum-sepolia)
3. [Safe methods](#safe-methods)
    - [`getSafeAddress(address)`](#getsafeaddressaddress)
    - [`sendUserOperation(address, tx)`](#senduseroperationaddress-tx)
    - [`estimateUserOperationGasCost(address, tx)`](#estimateuseroperationgascostaddress-tx)
    - [`getUserOperationReceipt(hash)`](#getuseroperationreceipthash)

## Requirements

You'll need a pimlico api-key to use their bundler and paymaster; you can get one by creating an account on https://dashboard.pimlico.io/. Note that api-keys created with a free account will only work on testnets (check out all the available pricing plans [here](https://docs.pimlico.io/infra/platform/pricing)).

## Configuration

The safe methods require additional configuration.

### Ethereum mainnet

```javascript
const { WalletPayEthereum } = require("lib-wallet-pay-eth");

const eth = new WalletPayEthereum({
    [...],
    safe: {
        bundlerUrl: "https://api.pimlico.io/v2/1/rpc?apikey=<your api-key>",
        paymasterAddress: "0x0000000000000039cd5e8ae05257ce51c473ddd1",
        paymasterTokenAddress: "0xdAC17F958D2ee523a2206206994597C13D831ec7"
    }
})
```

### Ethereum sepolia

Note that pimlico doesn't yet support usdt on testnets. 

Currently, the ethereum sepolia testnet only supports the following usdc token: [0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238](https://sepolia.etherscan.io/address/0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238).

```javascript
const eth = new WalletPayEthereum({
    [...],
    safe: {
        bundlerUrl: "https://api.pimlico.io/v2/11155111/rpc?apikey=<your api-key>",
        paymasterAddress: "0x0000000000000039cd5e8ae05257ce51c473ddd1",
        paymasterTokenAddress: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"
    }
})
```

## Safe methods

### `getSafeAddress(address)`

Returns the address of a wallet account's safe.

The user can start to receive funds on this address even if it has not been deployed yet.

#### Arguments

| Name      | Type        | Description
| --------- | ----------- | -------------
| address   | string      | The address of the safe's owner

#### Return value

| Type               | Description
| ------------------ | -------------
| Promise\<string\>  | The address of the safe

#### Example

```javascript
const safeAddress = await eth.getSafeAddress("0xabc...");
```

### `sendUserOperation(address, tx)`

Executes a transaction on a wallet account's safe and returns the hash of the user operation.

The safe account must have enough usdt tokens to repay the paymaster that sponsored the transaction; otherwise, a `PaymasterError` exception is thrown.

#### Arguments

| Name      | Type                                                                                                                        | Description
| --------- | --------------------------------------------------------------------------------------------------------------------------- | -------------
| address   | string                                                                                                                      | The address of the safe's owner
| tx        | [MetaTransactionData](https://github.com/safe-global/safe-core-sdk/blob/main/packages/types-kit/src/types.ts#L20C18-L20C38) | The transaction to execute on the safe account

#### Return value

| Type               | Description
| ------------------ | -------------
| Promise\<string\>  | The hash of the user operation

#### Example

Transfer 100 usdt from the safe account to another address:

```javascript
const Contract = require("web3-eth-contract");

const abi = [...];

const usdtAddress = "0xdAC17F958D2ee523a2206206994597C13D831ec7";

const usdt = new Contract(abi, usdtAddress);

const hash = await eth.sendUserOperation("0xabc...", {
    to: usdtAddress,
    value: 0,
    data: usdt.methods.transfer("0x123...", 100_000_000).encodeABI()
});
```

### `estimateUserOperationGasCost(address, tx)`

Returns an estimation of a user operation's gas cost (in wei).

It's possible to calculate how many usdt the transaction will cost to the user with the following formula:
```
<current usdt/eth exchange rate> * [gasCost + (gasCost * 10.0%)]
```

**Pimlico's paymaster holds 10.0% of the gas cost as a reward for sponsoring the tx.**

#### Note

This method runs a simulation of the user operation, which also checks the ability of the safe account to repay the paymaster. Thus, the safe account must already have enough funds to cover the gas cost of the transaction; otherwise, a `PaymasterError` exception is thrown.

#### Arguments

| Name      | Type                                                                                                                        | Description
| --------- | --------------------------------------------------------------------------------------------------------------------------- | -------------
| address   | string                                                                                                                      | The address of the safe's owner
| tx        | [MetaTransactionData](https://github.com/safe-global/safe-core-sdk/blob/main/packages/types-kit/src/types.ts#L20C18-L20C38) | The transaction for which to estimate the gas cost

#### Return value

| Type               | Description
| ------------------ | -------------
| Promise\<bignumber\>  | The user operation's gas cost

#### Example

Estimate the gas cost of a transfer of 100 usdt from the safe account to another address:

```javascript
const gasCost = await eth.estimateUserOperationGasCost("0xabc...", {
    to: usdtAddress,
    value: 0,
    data: usdt.methods.transfer("0x123...", 100_000_000).encodeABI()
});
```

### `getUserOperationReceipt(hash)`

Returns the receipt of a user operation.

Returns null if the user operation is not yet included in a block.

#### Arguments

| Name      | Type       | Description
| --------- | ---------- | -------------
| hash      | string     | The hash of the user operation

#### Return value

| Type                                                                                                                                                    | Description  
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------
| Promise\<[UserOperationReceipt](https://github.com/safe-global/safe-core-sdk/blob/main/packages/relay-kit/src/packs/safe-4337/types.ts#L117) \| null\>  | The user operation's receipt

#### Example

```javascript
const receipt = await eth.getUserOperationReceipt(hash);

if (!receipt)
    console.log("The user operation has not yet been included in a block.")
```
