const Core = require('../../src/main/platform/nodejs/index.js');
const argv = require('minimist')(process.argv.slice(2));

if (!argv.host || !argv.port) {
    console.log('Usage: node index.js --host=<hostname> --port=<port> [--miner] [--passive]');
    process.exit();
}

const host = argv.host;
const port = parseInt(argv.port);
const miner = argv.miner;
const passive = argv.passive;

console.log('Nimiq NodeJS Client starting (host=' + host + ', port=' + port + ', miner=' + miner + ', passive=' + passive + ')');

NetworkUtils.configureNetAddress(host, port);
Core.get().then( $ => {
    console.log('Blockchain: height=' + $.blockchain.height + ', totalWork=' + $.blockchain.totalWork + ', headHash=' + $.blockchain.headHash.toBase64());

    if (!passive) $.network.connect();
    if (miner) $.miner.startWork();
});
