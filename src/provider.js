const { Web3 } = require('web3')

async function provider(uri) {
  const web3 = new Web3(uri)

  const block = await web3.eth.getBlockNumber()

  if(typeof block !== 'bigint' || block < BigInt(0)) throw new Error('Provider is invalid')

  return web3
}

module.exports = provider
