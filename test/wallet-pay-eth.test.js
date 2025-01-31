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

const { test, solo } = require("brittle");
const EthPay = require("../src/wallet-pay-eth.js");
const KeyManager = require("../src/wallet-key-eth.js");
const { WalletStoreHyperbee } = require("lib-wallet-store");
const BIP39Seed = require("wallet-seed-bip39");
const Provider = require("lib-wallet-pay-evm/src/provider.js");
const { ethereum: TestNode } = require("wallet-lib-test-tools");
const { Erc20CurrencyFactory, GasCurrencyBase } = require("lib-wallet-util-evm");
const ERC20 = require("lib-wallet-pay-evm/src/erc20.js");
const opts = require("./test.opts.json");
const fs = require("fs");

const TMP_STORE = "./tmp";

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
      new ERC20({
        currency: USDT,
      }),
    ],
    gas_token: {
      name: "ETH",
      base_name: "wei",
      decimals: 18,
    },
    auth_signer_private_key: "a70a71add3092e3c63f11545a62024d1ff3ff55a202eca094a2d5832c470bd29"
  });
  await eth.initialize({});
  return eth;
}

async function getTestnode() {
  const eth = new TestNode({
    tokenConfig: {
      contractAddress: opts.test_contract,
    },
  });
  await eth.init();
  return eth;
}

const USDT = new Erc20CurrencyFactory({
  name: "USDT",
  base_name: "USDT",
  contract_address: opts.test_contract,
  decimal_places: 6,
});

test("Create an instances of WalletPayEth", async function (t) {
  const provider = new Provider({
    web3: opts.web3,
    indexer: opts.indexer,
    indexerWs: opts.indexerWs,
  });
  await provider.connect();
  const eth = new EthPay({
    asset_name: "ETH",
    asset_base_name: "wei",
    asset_decimals: 18,
    provider,
    key_manager: new KeyManager({
      seed: await BIP39Seed.generate(),
    }),
    store: new WalletStoreHyperbee(),
    network: "regtest",
    auth_signer_private_key: "a70a71add3092e3c63f11545a62024d1ff3ff55a202eca094a2d5832c470bd29"
  });
  await eth.initialize({});

  t.ok(eth.ready, "instance is ready");
  t.comment("destoying instance");
});

test("getNewAddress", async function (t) {
  const expect = {
    address: "0xb89c31da0a0d796240dc99e551287f16145ce7a3",
    publicKey:
      "0xe835543d53422a1289b494439760bc529f9baa34032b4b24530f5299fd1401dd93519953291a65838b2e8b69b22b28c0c56c76870ce72545f79a8042436ae033",
    privateKey:
      "0xe595bf345fbb7ab56636bc4777b1b4e53b0de7de2ee7be635b2638ee4a90c1ee",
    path: "m/44'/60'/0'/0/0",
  };
  const eth = await activeWallet();
  const addr = await eth.getNewAddress();
  for (const key in expect) {
    t.ok(addr[key] === expect[key], `address.${key} matches mnemonic`);
  }
  const add = await eth.getNewAddress();
  t.ok(add.path === "m/44'/60'/0'/0/1", "address path is incremented");
});

async function syncTest(t, sync) {
  const eth = await activeWallet({ newWallet: true });
  const node = await getTestnode();
  const addr = await eth.getNewAddress();
  const addr2 = await eth.getNewAddress();
  const amt1 = 0.00002;
  const amt2 = 0.00005;

  if (sync) {
    t.comment("send eth to address ", addr.address);
    await node.sendToAddress({ address: addr.address, amount: amt1 });
    t.comment("send eth to address ", addr2.address);
    await node.sendToAddress({ address: addr2.address, amount: amt2 });
    t.comment("sync addresses");
    await eth.syncTransactions();
  } else {
    const firstTxPromise = new Promise((resolve, reject) => {
      setTimeout(async () => {
        t.comment("send amt1 to address ", addr.address);
        await node.sendToAddress({ address: addr.address, amount: amt1 });
      }, 1000); // 1 second timeout
    });

    await Promise.race([eth._onNewTx(), firstTxPromise]);

    const secondTxPromise = new Promise((resolve, reject) => {
      setTimeout(async () => {
        t.comment("send amt2 to address ", addr2.address);
        await node.sendToAddress({ address: addr2.address, amount: amt2 });
      }, 1000); // 1 second timeout
    });

    await Promise.race([eth._onNewTx(), secondTxPromise]);
  }

  const bal = await eth.getBalance({}, addr.address);
  t.ok(+bal.confirmed.toMainUnit() === amt1, "sent balance matches");
  const totalBal = await eth.getBalance({});

  t.ok(totalBal.confirmed.toMainUnit() === "0.00007", "total balance matches");

  const t0 = t.test("getTransactions");
  const amts = [amt1, amt2];
  const txs = await eth.getTransactions({});

  for (const tx of txs) {
    const amt = amts.shift();

    t0.ok(
      new GasCurrencyBase(...tx.amount).toBaseUnit() ===
        new GasCurrencyBase(amt, "main", {
          name: "ETH",
          base_name: "wei",
          decimals: 18,
        }).toBaseUnit(),
      "amount matches"
    );
  }

  t0.ok(amts.length === 0, "all expected  transactions found");
  t0.end();
}

test("new wallet syncTransactions", async (t) => {
  await syncTest(t, true);
});

test("new wallet, websocket tx detection", async (t) => {
  await syncTest(t, false);
});

test("sendTransaction", async (t) => {
  const node = await getTestnode();
  const eth = await activeWallet({ newWallet: false });
  const nodeAddr = await node.getNewAddress();
  const testAddr = await eth.getNewAddress();
  t.comment(`sending eth to ${testAddr.address}`);
  await node.sendToAddress({ amount: 1.1, address: testAddr.address });
  const res = eth.sendTransaction(
    {},
    {
      address: nodeAddr,
      amount: 0.0001,
      unit: "main",
    }
  );

  let bcast = false;
  res.broadcasted((tx) => {
    t.ok(
      tx.to.toString().toLowerCase() === nodeAddr.toLowerCase(),
      "recipient is correct"
    );
    // TODO: Fetch tx from servers and compare values with sent values
    bcast = true;
  });

  const tx = await res;
  t.ok(tx.confirmations === 1n, "transaction is confirmed");
  t.ok(tx.latestBlockHash, "tx has block hash");
  if (!bcast) throw new Error("broadcast call back not called");
});

test("getActiveAddresses", async (t) => {
  const eth = await activeWallet({ newWallet: true });
  const node = await getTestnode();
  const sends = [
    [await eth.getNewAddress(), 1.1],
    [await eth.getNewAddress(), 1.5],
  ];
  for (const s in sends) {
    const [addr, amount] = sends[s];
    await node.sendToAddress({ amount, address: addr.address });
  }
  const addrs = await eth.getActiveAddresses();
  let x = 0;
  for (const [addr, bal] of addrs) {
    const [sendAddr, amt] = sends[x];
    t.ok(addr === sendAddr.address, `Address index ${x} matches`);
    t.ok(bal.toMainUnit() === amt.toString(), `Amount index ${x} matches`);
    x++;
  }
  t.ok(x === sends.length, "all addresses found");
});

test("listen to last address on start", async (t) => {
  fs.rmSync(TMP_STORE, { recursive: true, force: true });

  const provider = new Provider({
    web3: opts.web3,
    indexer: opts.indexer,
    indexerWs: opts.indexerWs,
  });

  let addrTest = [];
  provider.subscribeToAccount = async (addr, token) => {
    addrTest.push(addr);
    t.ok(
      token.length === 1 && token[0] === opts.test_contract,
      "contract matches"
    );
  };
  await provider.connect();

  const eth = await activeWallet({
    newWallet: true,
    store: true,
    provider,
  });

  const addrs = [
    (await eth.getNewAddress()).address,
    (await eth.getNewAddress()).address,
  ];

  t.alike(addrs, addrTest, "should subscribe to address");

  const seed = eth.keyManager.seed.mnemonic;
  t.comment("stop first instance");
  await eth.destroy();
  addrTest = [];

  const eth2 = await activeWallet({
    newWallet: true,
    store: true,
    provider,
    seed,
  });
  t.alike(addrs, addrTest, "should subscribe to list of address on start");
  await eth2.destroy();
});
(() => {
  const tkopts = { token: USDT.name };

  const skip = false;
  test("ERC20: getBalance", { skip }, async (t) => {
    const eth = await activeWallet({ newWallet: true });
    const node = await getTestnode();
    const sendAmount = BigInt(Math.floor(Math.random() * (20 - 2 + 1) + 2));
    const sendAmount2 = BigInt(Math.floor(Math.random() * (20 - 2 + 1) + 2));
    const addr = await eth.getNewAddress();
    t.ok(addr.address, "can generate address");

    let balance = await eth.getBalance(tkopts, addr.address);
    t.ok(balance.confirmed.toMainUnit() === "0", "token balance is zero");
    t.comment(`Sending: ${sendAmount} tokens  to ${addr.address}`);
    await node.sendToken({
      address: addr.address,
      amount: sendAmount,
    });
    balance = await eth.getBalance(tkopts, addr.address);
    t.ok(
      balance.confirmed.toMainUnit() === sendAmount.toString(),
      "balance matches send amount"
    );

    const addr2 = await eth.getNewAddress();
    await node.sendToken({
      address: addr2.address,
      amount: sendAmount2,
    });
    const total = await eth.getBalance(tkopts);
    t.ok(
      total.confirmed.toMainUnit() === (sendAmount + sendAmount2).toString(),
      "total wallet balance for token  is correct"
    );
  });

  test("ERC20: syncTransactions", { skip }, async (t) => {
    const eth = await activeWallet({ newWallet: true });
    const node = await getTestnode();
    const sendAmount = BigInt(Math.floor(Math.random() * (20 - 2 + 1) + 2));
    const amt2 = 123;
    const addr = await eth.getNewAddress();
    t.comment(`Sending: ${sendAmount} tokens  to ${addr.address}`);
    await node.sendToken({
      address: addr.address,
      amount: sendAmount,
    });

    t.comment(`Sending: ${amt2} tokens  to ${addr.address}`);
    await node.sendToken({
      address: addr.address,
      amount: amt2,
    });
    await eth.syncTransactions(tkopts);

    const t0 = t.test("getTransactions");
    const amts = [sendAmount, amt2];
    const txs = await eth.getTransactions(tkopts);

    for (const tx of txs) {
      const amt = amts.shift();

      t0.ok(Number(tx.amount[0]) === Number(amt), "amount matches");
    }

    t.ok(amts.length === 0, "all expected  transactions found");
    t0.end();
  });

  test("ERC20: detect transactions", { skip }, async (t) => {
    const eth = await activeWallet({ newWallet: true });
    const node = await getTestnode();
    const sendAmount = BigInt(Math.floor(Math.random() * (20 - 2 + 1) + 2));
    const amt2 = 123;
    const addr = await eth.getNewAddress();
    t.comment(`Sending: ${sendAmount} tokens  to ${addr.address}`);
    await node.sendToken({
      address: addr.address,
      amount: sendAmount,
    });

    t.comment(`Sending: ${amt2} tokens  to ${addr.address}`);
    
    const minePromise = new Promise((resolve, reject) => {
      setTimeout(async () => {
        await node.sendToken({
          address: addr.address,
          amount: amt2,
        });
      }, 1000); // 1 second timeout
    });

    await Promise.race([eth._onNewTx(), minePromise]);

    const t0 = t.test("getTransactions");
    const amts = [sendAmount, amt2];
    const txs = await eth.getTransactions(tkopts);

    for (const tx of txs) {
      const amt = amts.shift();

      t0.ok(Number(tx.amount[0]) === Number(amt), "amount matches");
    }

    t.ok(amts.length === 0, "all expected  transactions found");
    t0.end();
  });

  test("ERC20: getActiveAddresses", { skip }, async (t) => {
    const eth = await activeWallet({ newWallet: true });
    const node = await getTestnode();
    const sends = [
      [await eth.getNewAddress(), 10],
      [await eth.getNewAddress(), 12],
    ];
    for (const s in sends) {
      const [addr, amount] = sends[s];
      await node.sendToken({ amount, address: addr.address });
    }
    const addrs = await eth.getActiveAddresses(tkopts);
    let x = 0;
    for (const [addr, bal] of addrs) {
      const [sendAddr, amt] = sends[x];
      t.ok(addr === sendAddr.address, `Address index ${x} matches`);
      t.ok(bal.toMainUnit() === amt.toString(), `Amount index ${x} matches`);
      x++;
    }
    t.ok(x === sends.length, "all addresses found");
  });

  test("ERC20: sendTransactions sweep all tokens", { skip }, async (t) => {
    const eth = await activeWallet({ newWallet: true });
    const node = await getTestnode();
    const nodeAddr = await node.getNewAddress();
    const sends = [
      [await eth.getNewAddress(), 10],
      [await eth.getNewAddress(), 12],
    ];
    for (const s in sends) {
      const [addr, amount] = sends[s];
      t.comment(`funding ${addr.address} - ${amount} tokens`);
      await node.sendToAddress({ amount: 1, address: addr.address });
      await node.sendToken({ amount, address: addr.address });
    }
    const addrs = await eth.getFundedTokenAddresses(tkopts);
    let x = 0;
    for (const [addr, bal] of addrs) {
      const [tbal] = bal;
      t.comment(`sending ${tbal.toMainUnit()} tokens from wallet`);
      await eth.sendTransaction(tkopts, {
        sender: addr,
        amount: tbal.toMainUnit(),
        unit: "main",
        address: nodeAddr,
      });
      const newBal = await eth.getBalance(tkopts, addr);
      t.ok(
        newBal.confirmed.toBaseUnit() === "0",
        `token account #${x} balance is zero after sending all of the amount`
      );
      x++;
    }
    t.ok(x === sends.length, "all addresses found");
  });
})();
