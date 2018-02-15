const Nimiq = require('../../dist/node.js');
const JsonRpcServer = require('./JsonRpcServer.js');
const MetricsServer = require('./MetricsServer.js');
const START = Date.now();
/**
 * @type {{host: ?string, port: ?string, key: ?string, cert: ?string, dumb: ?boolean, type: ?string, help: ?boolean, miner: string|boolean, statistics: string|boolean, passive: boolean, log: string|boolean, help: boolean}}
 */
const argv = require('minimist')(process.argv.slice(2));

const type = typeof argv.type === 'string' ? argv.type : 'full';

if ((!argv.host || !argv.port || !argv.key || !argv.cert) && !argv.dumb || argv.help || (type !== 'full' && type !== 'light' && type !== 'nano')) {
    console.log(
        'Nimiq NodeJS client\n' +
        '\n' +
        'Usage:\n' +
        '    node index.js --host=HOSTNAME --port=PORT --cert=SSL_CERT_FILE --key=SSL_KEY_FILE [options]\n' +
        '    node index.js --dumb [options]\n' +
        '\n' +
        'Configuration:\n' +
        '  --cert=SSL_CERT_FILE       Certificate file to use. CN should match HOSTNAME.\n' +
        '  --dumb                     Set up a dumb node. Other nodes will not be able\n' +
        '                             to connect to this node, but you may connect to\n' +
        '                             others.\n' +
        '  --host=HOSTNAME            Configure hostname.\n' +
        '  --key=SSL_KEY_FILE         Private key file to use.\n' +
        '  --port=PORT                Specifies which port to listen on for connections.\n' +
        '\n' +
        'Options:\n' +
        '  --help                     Show this usage instructions.\n' +
        '  --log[=LEVEL]              Configure global log level. Not specifying a log\n' +
        '                             level will enable verbose log output.\n' +
        '  --log-tag=TAG[:LEVEL]      Configure log level for a specific tag.\n' +
        '  --miner[=THREADS           Activate mining on this node. The miner will be set\n' +
        '         [:THROTTLE_AFTER    up to use THREADS parallel threads and can be\n' +
        '         [:THROTTLE_WAIT]]]  throttled using THROTTLE_AFTER and _WAIT arguments.\n' +
        '  --passive                  Do not actively connect to the network and do not\n' +
        '                             wait for connection establishment.\n' +
        '  --rpc[=PORT]               Start JSON-RPC server on port PORT (default: 8648).\n' +
        '  --metrics[=PORT]           Start Prometheus-compatible metrics server on port\n' +
        '           [:PASSWORD]       PORT (default: 8649). If PASSWORD is specified, it\n' +
        '                             is required to be used for username "metrics" via\n' +
        '                             Basic Authentication.' +
        '  --statistics[=INTERVAL]    Output statistics like mining hashrate, current\n' +
        '                             account balance and mempool size every INTERVAL\n' +
        '                             seconds.\n' +
        '  --type=TYPE                Configure the consensus type to establish, one of\n' +
        '                             full (default), light or nano.\n' +
        '  --wallet-seed=SEED         Initialize wallet using SEED as a wallet seed.\n' +
        '  --wallet-address=ADDRESS   Initialize wallet using ADDRESS as a wallet address\n' +
        '                             The wallet cannot be used to sign transactions when\n' +
        '                             using this option.');

    process.exit();
}

const host = argv.host;
const port = parseInt(argv.port);
const key = argv.key;
const cert = argv.cert;
const dumb = argv.dumb;
const minerOptions = argv.miner;
const statisticsOptions = argv.statistics;
const passive = argv.passive;
const rpc = argv.rpc;
let rpcPort = 8648;
if (typeof rpc === 'string') {
    rpcPort = parseInt(rpc);
}
const metrics = argv.metrics;
let metricsPort = 8649, metricsPassword = null;
if (typeof metrics === 'string') {
    if (metrics.indexOf(':') > 0) {
        metricsPassword = metrics.substring(metrics.indexOf(':') + 1);
    }
    metricsPort = parseInt(metrics);
}
const walletSeed = argv['wallet-seed'] || null;
const walletAddress = argv['wallet-address'] || null;
const isNano = argv.type === 'nano';

if (isNano && minerOptions) {
    console.error('Cannot mine when running as a nano client.');
    process.exit(1);
}

if (metrics && dumb) {
    console.error('Cannot provide metrics when running as a dumb client.');
    process.exit(1);
}

if (metrics && isNano) {
    console.error('Cannot provide metrics when running as a nano client.');
    process.exit(1);
}

if (argv['log']) {
    Nimiq.Log.instance.level = argv['log'] === true ? Nimiq.Log.VERBOSE : argv['log'];
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

if (walletSeed && walletAddress) {
    console.error('Can only use one of wallet-seed or wallet-address, not both!');
    process.exit(1);
}

console.log(`Nimiq NodeJS Client starting (${host && port ? `host=${host}, port=${port}` : 'dumb'}, miner=${!!minerOptions}, statistics=${!!statisticsOptions}, passive=${!!passive}, rpc=${!!rpc})`);

const TAG = 'Node';

const $ = {};

(async () => {
    const networkConfig = dumb
        ? new Nimiq.DumbNetworkConfig()
        : new Nimiq.WsNetworkConfig(host, port, key, cert);

    switch (type) {
        case 'full':
            $.consensus = await Nimiq.Consensus.full(networkConfig);
            break;
        case 'light':
            $.consensus = await Nimiq.Consensus.light(networkConfig);
            break;
        case 'nano':
            $.consensus = await Nimiq.Consensus.nano(networkConfig);
            break;
    }

    $.blockchain = $.consensus.blockchain;
    $.accounts = $.blockchain.accounts;
    $.mempool = $.consensus.mempool;
    $.network = $.consensus.network;

    Nimiq.Log.i(TAG, `Peer address: ${networkConfig.peerAddress.toString()} - public key: ${networkConfig.keyPair.publicKey.toHex()}`);

    // TODO: Wallet key.
    $.walletStore = await new Nimiq.WalletStore();
    if (!walletAddress && !walletSeed) {
        // Load or create default wallet.
        $.wallet = await $.walletStore.getDefault();
    } else if (walletSeed) {
        // Load wallet from seed.
        const mainWallet = await Nimiq.Wallet.loadPlain(walletSeed);
        await $.walletStore.put(mainWallet);
        await $.walletStore.setDefault(mainWallet.address);
        $.wallet = mainWallet;
    } else {
        const address = Nimiq.Address.fromUserFriendlyAddress(walletAddress);
        $.wallet = {address: address};
        // Check if we have a full wallet in store.
        const wallet = await $.walletStore.get(address);
        if (wallet) {
            $.wallet = wallet;
            await $.walletStore.setDefault(wallet.address);
        }
    }

    const addresses = await $.walletStore.list();
    Nimiq.Log.i(TAG, `Managing wallets [${addresses.map(address => address.toUserFriendlyAddress())}]`);

    const account = !isNano ? await $.accounts.get($.wallet.address) : null;
    Nimiq.Log.i(TAG, `Wallet initialized for address ${$.wallet.address.toUserFriendlyAddress()}.`
        + (!isNano ? ` Balance: ${Nimiq.Policy.satoshisToCoins(account.balance)} NIM` : ''));

    $.miner = new Nimiq.Miner($.blockchain, $.accounts, $.mempool, $.network.time, $.wallet.address);

    $.blockchain.on('head-changed', (head) => {
        if ($.consensus.established || head.height % 100 === 0) {
            Nimiq.Log.i(TAG, `Now at block: ${head.height}`);
        }
    });

    $.network.on('peer-joined', (peer) => {
        Nimiq.Log.i(TAG, `Connected to ${peer.peerAddress.toString()}`);
    });

    if (!passive) {
        $.network.connect();
    }

    if (minerOptions) {
        $.consensus.on('established', () => $.miner.startWork());
        $.consensus.on('lost', () => $.miner.stopWork());
        if (typeof minerOptions === 'number') {
            $.miner.threads = minerOptions;
        } else if (typeof minerOptions === 'string') {
            const margs = minerOptions.split(':');
            $.miner.threads = parseInt(margs[0]);
            if (margs.length >= 2) { $.miner.throttleAfter = parseInt(margs[1]) * $.miner.threads; }
            if (margs.length >= 3) { $.miner.throttleWait = parseInt(margs[2]); }
        }
        if (passive) {
            $.miner.startWork();
        }
    }

    $.consensus.on('established', () => {
        Nimiq.Log.i(TAG, `Blockchain ${type}-consensus established in ${(Date.now() - START) / 1000}s.`);
        Nimiq.Log.i(TAG, `Current state: height=${$.blockchain.height}, totalWork=${$.blockchain.totalWork}, headHash=${$.blockchain.headHash.toBase64()}`);
    });

    $.miner.on('block-mined', (block) => {
        Nimiq.Log.i(TAG, `Block mined: ${block.header}`);
    });

    if (statisticsOptions) {
        // Output regular statistics
        const hashrates = [];
        const outputInterval = typeof statisticsOptions === 'number' ? statisticsOptions : 10; // seconds

        $.miner.on('hashrate-changed', async (hashrate) => {
            hashrates.push(hashrate);

            if (hashrates.length >= outputInterval) {
                const account = await $.accounts.get($.wallet.address);
                const sum = hashrates.reduce((acc, val) => acc + val, 0);
                Nimiq.Log.i(TAG, `Hashrate: ${(sum / hashrates.length).toFixed(Math.log10(hashrates.length)).padStart(7)} H/s`
                    + (!isNano ? ` - Balance: ${Nimiq.Policy.satoshisToCoins(account.balance)} NIM` : '')
                    + ` - Mempool: ${$.mempool.getTransactions().length} tx`);
                hashrates.length = 0;
            }
        });
    }

    if (rpc) {
        $.rpcServer = new JsonRpcServer(rpcPort);
        $.rpcServer.init($.blockchain, $.accounts, $.mempool, $.network, $.miner, $.walletStore);
    }

    if (metrics) {
        $.metricsServer = new MetricsServer(networkConfig.sslConfig, metricsPort, metricsPassword);
        $.metricsServer.init($.blockchain, $.accounts, $.mempool, $.network, $.miner);
    }
})().catch(e => {
    console.error(e);
    process.exit(1);
});
