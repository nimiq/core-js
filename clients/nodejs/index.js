const START = Date.now();
const argv = require('minimist')(process.argv.slice(2));
const Nimiq = require('../../dist/node.js');
const JsonRpcServer = require('./modules/JsonRpcServer.js');
const MetricsServer = require('./modules/MetricsServer.js');
const config = require('./modules/Config.js')(argv);

if ((!config.host || !config.port || !config.tls.key || !config.tls.cert) && !config.dumb || argv.help) {
    console.log(
        'Nimiq NodeJS client\n' +
        '\n' +
        'Usage:\n' +
        '    node index.js --config=CONFIG [options]\n' +
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
        '  --miner[=THREADS]          Activate mining on this node. The miner will be set\n' +
        '                             up to use THREADS parallel threads.\n' +
        '  --pool=SERVER:PORT         Mine shares for mining pool with address SERVER:PORT\n' +
        '  --passive                  Do not actively connect to the network and do not\n' +
        '                             wait for connection establishment.\n' +
        '  --rpc[=PORT]               Start JSON-RPC server on port PORT (default: 8648).\n' +
        '  --metrics[=PORT]           Start Prometheus-compatible metrics server on port\n' +
        '           [:PASSWORD]       PORT (default: 8649). If PASSWORD is specified, it\n' +
        '                             is required to be used for username "metrics" via\n' +
        '                             Basic Authentication.\n' +
        '  --statistics[=INTERVAL]    Output statistics like mining hashrate, current\n' +
        '                             account balance and mempool size every INTERVAL\n' +
        '                             seconds.\n' +
        '  --type=TYPE                Configure the consensus type to establish, one of\n' +
        '                             full (default), light, or nano.\n' +
        '  --wallet-seed=SEED         Initialize wallet using SEED as a wallet seed.\n' +
        '  --wallet-address=ADDRESS   Initialize wallet using ADDRESS as a wallet address\n' +
        '                             The wallet cannot be used to sign transactions when\n' +
        '                             using this option.\n' +
        '  --extra-data=EXTRA_DATA    Extra data to add to every mined block.\n' +
        '  --network=NAME             Configure the network to connect to, one of\n' +
        '                             main (default), test, dev, or bounty.\n');

    process.exit();
}

const statisticsOptions = argv.statistics;
const isNano = config.type === 'nano';

if (isNano && config.miner.enabled) {
    console.error('Cannot mine when running as a nano client.');
    process.exit(1);
}
if (config.metricsServer.enabled && config.dumb) {
    console.error('Cannot provide metrics when running as a dumb client.');
    process.exit(1);
}
if (config.metricsServer.enabled && isNano) {
    console.error('Cannot provide metrics when running as a nano client.');
    process.exit(1);
}
if (!Nimiq.GenesisConfig.CONFIGS[config.network]) {
    console.error(`Invalid network name: ${config.network}`);
    process.exit(1);
}
if (config.wallet.seed && config.wallet.address) {
    console.error('Cannot use both --wallet-seed and --wallet-address');
    process.exit(1);
}
if (config.host && config.dumb) {
    console.error('Cannot use both --host and --dumb');
    process.exit(1);
}
if (config.type === 'light') {
    console.error('Light node type is temporarily disabled.');
    process.exit(1);
}

Nimiq.Log.instance.level = config.log.level;
for(const tag in config.log.tags) {
    Nimiq.Log.instance.setLoggable(tag, config.log.tags[tag]);
}

for(const key in config.constantOverrides) {
    Nimiq.ConstantHelper.instance.set(key, config.constantOverrides[key]);
}

for(const seedPeer of config.seedPeers) {
    if (!seedPeer.host || !seedPeer.port) {
        console.error('Seed peers must have host and port attributes set');
        process.exit(1);
    }
}

const TAG = 'Node';
const $ = {};

(async () => {
    Nimiq.Log.i(TAG, `Nimiq NodeJS Client starting (network=${config.network}`
        + `, ${config.host ? `host=${config.host}, port=${config.port}` : 'dumb'}`
        + `, miner=${config.miner.enabled}, rpc=${config.rpcServer.enabled}${config.rpcServer.enabled ? `@${config.rpcServer.port}` : ''}`
        + `, metrics=${config.metricsServer.enabled}${config.metricsServer.enabled ? `@${config.metricsServer.port}` : ''})`);

    Nimiq.GenesisConfig.init(Nimiq.GenesisConfig.CONFIGS[config.network]);

    for(const seedPeer of config.seedPeers) {
        Nimiq.GenesisConfig.SEED_PEERS.push(Nimiq.WsPeerAddress.seed(seedPeer.host, seedPeer.port, seedPeer.publicKey));
    }

    const networkConfig = config.dumb
        ? new Nimiq.DumbNetworkConfig()
        : new Nimiq.WsNetworkConfig(config.host, config.port, config.tls.key, config.tls.cert);

    switch (config.type) {
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
    if (!config.wallet.address && !config.wallet.seed) {
        // Load or create default wallet.
        $.wallet = await $.walletStore.getDefault();
    } else if (config.wallet.seed) {
        // Load wallet from seed.
        const mainWallet = await Nimiq.Wallet.loadPlain(config.wallet.seed);
        await $.walletStore.put(mainWallet);
        await $.walletStore.setDefault(mainWallet.address);
        $.wallet = mainWallet;
    } else {
        const address = Nimiq.Address.fromUserFriendlyAddress(config.wallet.address);
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

    Nimiq.Log.i(TAG, `Blockchain state: height=${$.blockchain.height}, headHash=${$.blockchain.headHash}`);

    const extraData = config.miner.extraData ? Nimiq.BufferUtils.fromAscii(config.miner.extraData) : new Uint8Array(0);
    if (config.poolMining.enabled) {
        const deviceId = Nimiq.BasePoolMiner.generateDeviceId(networkConfig);
        switch (config.poolMining.mode) {
            case 'nano':
                $.miner = new Nimiq.NanoPoolMiner($.blockchain, $.network.time, $.wallet.address, deviceId);
                break;
            case 'smart':
            default:
                $.miner = new Nimiq.SmartPoolMiner($.blockchain, $.accounts, $.mempool, $.network.time, $.wallet.address, deviceId, extraData);
                break;
        }
        $.consensus.on('established', () => {
            Nimiq.Log.i(TAG, `Connecting to pool ${config.poolMining.host} using device id ${deviceId} as a ${config.poolMining.mode} client.`);
            $.miner.connect(config.poolMining.host, config.poolMining.port);
        });
    } else {
        $.miner = new Nimiq.Miner($.blockchain, $.accounts, $.mempool, $.network.time, $.wallet.address, extraData);
    }

    $.blockchain.on('head-changed', (head) => {
        if ($.consensus.established || head.height % 100 === 0) {
            Nimiq.Log.i(TAG, `Now at block: ${head.height}`);
        }
    });

    $.network.on('peer-joined', (peer) => {
        Nimiq.Log.i(TAG, `Connected to ${peer.peerAddress.toString()}`);
    });
    $.network.on('peer-left', (peer) => {
        Nimiq.Log.i(TAG, `Disconnected from ${peer.peerAddress.toString()}`);
    });

    if (!config.passive) {
        $.network.connect();
    }

    if (config.miner.enabled) {
        $.consensus.on('established', () => $.miner.startWork());
        $.consensus.on('lost', () => $.miner.stopWork());
        if (config.passive) {
            $.miner.startWork();
        }
    }
    if (typeof config.miner.threads === 'number') {
        $.miner.threads = config.miner.threads;
    }
    $.miner.throttleAfter = config.miner.throttleAfter;
    $.miner.throttleWait = config.miner.throttleWait;

    $.consensus.on('established', () => {
        Nimiq.Log.i(TAG, `Blockchain ${config.type}-consensus established in ${(Date.now() - START) / 1000}s.`);
        Nimiq.Log.i(TAG, `Current state: height=${$.blockchain.height}, totalWork=${$.blockchain.totalWork}, headHash=${$.blockchain.headHash}`);
    });

    $.miner.on('block-mined', (block) => {
        Nimiq.Log.i(TAG, `Block mined: #${block.header.height}, hash=${block.header.hash()}`);
    });

    if (config.statistics > 0) {
        // Output regular statistics
        const hashrates = [];
        const outputInterval = config.statistics;

        $.miner.on('hashrate-changed', async (hashrate) => {
            hashrates.push(hashrate);

            if (hashrates.length >= outputInterval) {
                const account = await $.accounts.get($.wallet.address);
                const sum = hashrates.reduce((acc, val) => acc + val, 0);
                Nimiq.Log.i(TAG, `Hashrate: ${(sum / hashrates.length).toFixed(2).padStart(7)} H/s`
                    + (!isNano ? ` - Balance: ${Nimiq.Policy.satoshisToCoins(account.balance)} NIM` : '')
                    + ` - Mempool: ${$.mempool.getTransactions().length} tx`);
                hashrates.length = 0;
            }
        });
    }

    if (config.rpcServer.enabled) {
        $.rpcServer = new JsonRpcServer(config.rpcServer);
        $.rpcServer.init($.consensus, $.blockchain, $.accounts, $.mempool, $.network, $.miner, $.walletStore);
    }

    if (config.metricsServer.enabled) {
        $.metricsServer = new MetricsServer(networkConfig.sslConfig, config.metricsServer.port, config.metricsServer.password);
        $.metricsServer.init($.blockchain, $.accounts, $.mempool, $.network, $.miner);
    }
})().catch(e => {
    console.error(e);
    process.exit(1);
});
