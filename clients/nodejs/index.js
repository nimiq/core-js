const Nimiq = require('../../dist/node.js');
const argv = require('minimist')(process.argv.slice(2));

if (!argv.host || !argv.port || !argv.key || !argv.cert) {
    console.log('Usage: node index.js --host=<hostname> --port=<port> --key=<ssl-key> --cert=<ssl-cert> [--wallet-seed=<wallet-seed>] [--miner[=<thread-num>[:<throttle-after>[:<throttle-wait>]]]] [--passive] [--log=LEVEL] [--log-tag=TAG[:LEVEL]]');
    process.exit();
}

const host = argv.host;
const port = parseInt(argv.port);
const minerOptions = argv.miner;
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

console.log(`Nimiq NodeJS Client starting (host=${host}, port=${port}, miner=${!!minerOptions}, passive=${!!passive})`);

// XXX Configure Core.
// TODO Create config/options object and pass to Core.get()/init().
Nimiq.NetworkConfig.configurePeerAddress(host, port);
Nimiq.NetworkConfig.configureSSL(key, cert);

const TAG = 'Node';

(async () => {
    const consensus = await Nimiq.Consensus.full();

    const blockchain = consensus.blockchain;
    const accounts = blockchain.accounts;
    const mempool = consensus.mempool;
    const network = consensus.network;

    const wallet = walletSeed ? await Nimiq.Wallet.load(walletSeed) : await Nimiq.Wallet.getPersistent();
    Nimiq.Log.i(TAG, `Wallet initialized for address ${wallet.address.toUserFriendlyAddress()}.`);
    //Nimiq.Log.i(TAG, `Wallet initialized with seed ${wallet.dump()}.`);

    const miner = new Nimiq.Miner(blockchain, mempool, wallet.address);

    Nimiq.Log.i(TAG, `Blockchain: height=${blockchain.height}, totalWork=${blockchain.totalWork}, headHash=${blockchain.headHash.toBase64()}`);

    blockchain.on('head-changed', (head) => {
        Nimiq.Log.i(TAG, `Now at block: ${head.height}`);
    });

    if (!passive) {
        network.connect();
    }

    if (minerOptions) {
        consensus.on('established', () => miner.startWork());
        consensus.on('lost', () => miner.stopWork());
        if (typeof minerOptions === 'number') {
            miner.threads = minerOptions;
        } else if (typeof minerOptions === 'string') {
            const margs = minerOptions.split(':');
            miner.threads = parseInt(margs[0]);
            if (margs.length >= 2) { miner.throttleAfter = parseInt(margs[1]) * miner.threads; }
            if (margs.length >= 3) { miner.throttleWait = parseInt(margs[2]); }
        }
        if (passive) {
            miner.startWork();
        }
    }

    consensus.on('established', () => {
        Nimiq.Log.i(TAG, 'Blockchain consensus established');
    });

    miner.on('block-mined', (block) => {
        Nimiq.Log.i(TAG, `Block mined: ${block.header}`);
    });
})().then(console.log, console.error);
