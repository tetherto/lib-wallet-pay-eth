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
'use strict'

const test = require('brittle')
const Eth = require('../src/eth.currency.js')

test('Currency: Eth', async () => {
  test('Units', async (t) => {
    const eth = new Eth(1, 'main')
    t.ok(eth.name === 'ETH', 'currency name is ETH')
    t.ok(eth.base_name === 'WEI', 'currency name is WEI')

    const base = eth.toBaseUnit()
    t.ok(base === '1000000000000000000', 'toBaseUnit is correct')
    t.ok(+eth.toMainUnit(base) === 1, 'toMainUnit is correct')
  })

  test('isUnitOf', async (t) => {
    const eth = new Eth(1, 'main')
    try {
      eth.isUnitOf('SATS')
    } catch (err) {
      t.ok(err.message === 'Amount must be an instance of Ethereum', 'isUnitOf is implemented')
    }
  })

  test('Math: add', async (t) => {
    const v = new Eth(1, 'main')
    const v2 = v.add(v)
    t.ok(+v2.toMainUnit() === 2, 'add: 1+1=2')
    const v3 = v2.add(new Eth(1, 'base'))
    t.ok(v3.toMainUnit() === '2.000000000000000001', 'add: 2 + 1.00000001 =  2.000000000000000001')
  })

  test('Math: minus', async (t) => {
    const v = new Eth(2, 'main')
    const v2 = v.minus(v)

    t.ok(+v2.toMainUnit() === 0, 'add: 2-2=0')

    const v3 = v.minus(new Eth(1, 'base'))
    t.ok(v3.toMainUnit() === '1.999999999999999999', 'minus: 2-1.00000001 = 0.99999999')
  })

  test('Math: lte', async (t) => {
    const v2 = new Eth(2, 'main')
    const v1 = new Eth(1, 'main')
    t.ok(v1.lte(v2), '1 <= 2')
  })

  test('Math: gte', async (t) => {
    const btc2 = new Eth(2, 'main')
    const btc1 = new Eth(1, 'main')
    t.ok(btc2.gte(btc1), '2 >= 1')
  })

  test('Math: gte', async (t) => {
    const btc2 = new Eth(2, 'main')
    const btc1 = new Eth(2, 'main')
    t.ok(btc2.eq(btc1), '2 == 2')
    t.ok(btc2.eq(new Eth(3, 'main')) === false, ' 2 != 3')
  })
})

// TODO: ERC20 currency test
