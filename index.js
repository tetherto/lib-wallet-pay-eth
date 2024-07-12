const EthPay = require('./src/wallet-pay-eth')
const erc20CurrencyFac = require('./src/erc20.currency')
const Erc20 = require('./src/erc20')
const Provider = require('./src/provider')
module.exports = {
  EthPay,
  Erc20,
  erc20CurrencyFac,
  Provider
}
