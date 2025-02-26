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
"use strict";

const { test } = require("brittle");
const EthPay = require("../../src/wallet-pay-eth.js");
const KeyManager = require("../../src/wallet-key-eth.js");
const { WalletStoreHyperbee } = require("lib-wallet-store");
const BIP39Seed = require("wallet-seed-bip39");
const Provider = require("lib-wallet-pay-evm/src/provider.js");
const opts = require("./safe.opts.json");

const TMP_STORE = "./tmp";

const ABI = [
  {
    "constant": false,
    "inputs": [
      {"name": "_to", "type": "address"},
      {"name": "_value", "type": "uint256"}
    ],
    "name": "transfer",
    "outputs": [],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      { "name": "who", "type": "address" }
    ],
    "name": "balanceOf",
    "outputs": [
      { "name": "", "type": "uint256" }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  }
];

async function activeWallet(param = {}) {
  let provider = param.provider;
  if (!param.provider) {
    provider = new Provider({
      web3: opts.web3,
      indexer: opts.indexer,
      indexerWs: opts.indexerWs,
    });
    await provider.connect();
  }

  const store = new WalletStoreHyperbee({
    store_path: param.store ? TMP_STORE : null,
  });

  await store.init();

  const eth = new EthPay({
    asset_name: "eth",
    provider,
    key_manager: new KeyManager({
      seed: param.newWallet
        ? await BIP39Seed.generate()
        : await BIP39Seed.generate(
            param.seed ||
              "taxi carbon sister jeans notice combine once carpet know dice oil solar"
          ),
    }),
    store,
    network: "regtest",
    token: [

    ],
    gas_token: {
      name: "ETH",
      base_name: "wei",
      decimals: 18,
    },
    auth_signer_private_key: "a70a71add3092e3c63f11545a62024d1ff3ff55a202eca094a2d5832c470bd29",
    safe: opts.safe
  });
  await eth.initialize({});
  return eth;
}

test("transfer 1 token from a safe account to another address", async (t) => {
  async function getBalance(address, toAddress) {
    return {
      address: await token.methods.balanceOf(address).call(),
      toAddress: await token.methods.balanceOf(toAddress).call()
    }
  }

  const eth = await activeWallet({ newWallet: false });
  const addr = await eth.getNewAddress();
  const address = addr.address;

  const toAddress = "0x636e9c21f27d9401ac180666bf8DC0D3FcEb0D24";
  const amount = 1_000_000;

  const web3 = eth.web3;

  const safeAddress = await eth.getSafeAddress(address);

  t.comment("Safe address:", safeAddress);

  t.comment("Make sure that the safe address has enough token funds to repay the paymaster!");

  const { paymasterTokenAddress } = opts.safe;
  const token = new web3.eth.Contract(ABI, paymasterTokenAddress);

  const initialBalance = await getBalance(address, toAddress);

  const hash = await eth.sendUserOperation(address, {
    to: paymasterTokenAddress,
    value: 0,
    data: token.methods.transfer(toAddress, amount).encodeABI()
  });

  t.comment("User operation hash:", hash);

  t.comment("Waiting for the user operation to be included in a block...");

  while (true) {
    const receipt = await eth.getUserOperationReceipt(hash);

    if (receipt)
      break;

    // Try again in 1 second
    await new Promise(r => setTimeout(r, 1_000));
  }

  const balance = await getBalance(address, toAddress);

  t.comment("User operation receipt found!")

  const fee =  initialBalance.address - balance.address - amount;
   
  t.comment(`The user operation cost ${fee} tokens to the user.`);

  t.ok(initialBalance.address - balance.address >= amount, 
    `${amount} tokens have been transferred out of the safe account.`);

  t.ok(balance.toAddress - initialBalance.toAddress == amount,
    `${toAddress} has received ${amount} tokens from the safe account.`);
});