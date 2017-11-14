const Nimiq = require('../../dist/node.js');
const argv = require('minimist')(process.argv.slice(2));

if (!argv.host || !argv.port || !argv.key || !argv.cert) {
    console.log('Usage: node index.js --host=<hostname> --port=<port> --key=<ssl-key> --cert=<ssl-cert> [--wallet-seed=<wallet-seed>] [--miner] [--passive] [--log=LEVEL] [--log-tag=TAG[:LEVEL]]');
    process.exit();
}

const host = argv.host;
const port = parseInt(argv.port);
const miner = argv.miner;
const passive = argv.passive;
const key = argv.key;
const cert = argv.cert;
const walletSeed = argv['wallet-seed'] || null;

if (argv['log']) {
    Nimiq.Log.instance.level = argv['log'] === true ? Log.VERBOSE : argv['log'];
}
if (argv['log-tag']) {
    if (!Array.isArray(argv['log-tag'])) {
        argv['log-tag'] = [argv['log-tag']];
    }
    argv['log-tag'].forEach((lt) => {
        const s = lt.split(':');
        Nimiq.Log.instance.setLoggable(s[0], s.length === 1 ? 2 : s[1]);
    });
}

console.log(`Nimiq NodeJS Client starting (host=${host}, port=${port}, miner=${!!miner}, passive=${!!passive})`);

// XXX Configure Core.
// TODO Create config/options object and pass to Core.get()/init().
Nimiq.NetworkConfig.configurePeerAddress(host, port);
Nimiq.NetworkConfig.configureSSL(key, cert);

const options = {
    'walletSeed': walletSeed
};

try {
    (new Nimiq.Core(options)).then($ => {
        Nimiq.Log.i(Nimiq.Core, `Blockchain: height=${$.blockchain.height}, totalWork=${$.blockchain.totalWork}, headHash=${$.blockchain.headHash.toBase64()}`);

        $.blockchain.on('head-changed', (head) => {
            Nimiq.Log.i(Nimiq.Core, `Now at block: ${head.height}`);
        });

        if (!passive) {
            $.network.connect();
        }

        if (miner) {
            $.consensus.on('established', () => $.miner.startWork());
            $.consensus.on('lost', () => $.miner.stopWork());
        }

        $.consensus.on('established', () => {
            Nimiq.Log.i(Nimiq.Core, 'Blockchain consensus established');
        });

        $.miner.on('block-mined', (block) => {
            Nimiq.Log.i(Nimiq.Core, `Block mined: ${block.header}`);
        });
    });
} catch (code) {
    switch (code) {
        case Nimiq.Wallet.ERR_INVALID_WALLET_SEED:
            console.log('Invalid wallet seed');
            break;
        default:
            console.log('Nimiq initialization error');
            break;
    }
}
