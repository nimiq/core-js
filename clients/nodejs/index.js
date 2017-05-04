const Core = require('../../src/main/platform/nodejs/index.js');
const argv = require('minimist')(process.argv.slice(2));

if (!argv.host || !argv.port) {
    console.log('Usage: node index.js --host=<hostname> --port=<port> [--miner] [--miner-speed=75] [--passive]');
    process.exit();
}

const host = argv.host;
const port = parseInt(argv.port);
const miner = argv.miner;
const minerSpeed = argv['miner-speed'] || 75;
const passive = argv.passive;
const key = argv.key;
const cert = argv.cert;

console.log('Nimiq NodeJS Client starting (host=' + host + ', port=' + port + ', miner=' + !!miner + ', minerSpeed=' + minerSpeed + ', passive=' + !!passive + ')');

// XXX Configure Core.
// TODO Create config/options object and pass to Core.get()/init().
NetworkUtils.configureNetAddress(host, port);
NetworkUtils.configureSSL(key, cert);

Miner.configureSpeed(minerSpeed);

Core.get().then( $ => {
    console.log('Blockchain: height=' + $.blockchain.height + ', totalWork=' + $.blockchain.totalWork + ', headHash=' + $.blockchain.headHash.toBase64());

    if (!passive) $.network.connect();
    if (miner) $.miner.startWork();
});
