const START = Date.now();
const argv = require('minimist')(process.argv.slice(2));
const Nimiq = require('../../dist/node.js');
const JsonRpcServer = require('./modules/JsonRpcServer.js');
const UiServer = require('./modules/UiServer.js');
const MetricsServer = require('./modules/MetricsServer.js');
const config = require('./modules/Config.js')(argv);
const openBrowserTab = require('./modules/NodeUtils.js').openBrowserTab;

if ((config.protocol === 'wss' && !(config.host && config.port && config.tls && config.tls.cert && config.tls.key)) ||
    (config.protocol === 'ws' && !(config.host && config.port)) ||
    argv.help) {

    if (!argv.help && config.protocol === 'wss') {
        console.error('WSS protocol requries host, port, TLS cert and TLS key to be configured!');
    }

    if (!argv.help && config.protocol === 'ws') {
        console.error('WS protocol requries host and port to be configured!');
    }

    console.log(
        'Nimiq NodeJS client\n' +
        '\n' +
        'Usage:\n' +
        '    node index.js --config=CONFIG [options]\n' +
        '    node index.js --host=HOSTNAME --port=PORT --cert=SSL_CERT_FILE --key=SSL_KEY_FILE [options]\n' +
        '    node index.js --host=HOSTNAME --port=PORT --protocol=ws [options]\n' +
        '\n' +
        'Configuration:\n' +
        '  --cert=SSL_CERT_FILE       Certificate file to use. CN should match HOSTNAME.\n' +
        '  --host=HOSTNAME            Configure hostname.\n' +
        '  --key=SSL_KEY_FILE         Private key file to use.\n' +
        '  --port=PORT                Specifies which port to listen on for connections.\n' +
        '  --protocol=TYPE            Set up the protocol to be used. Available protocols are\n' +
        '                              - wss (default): WebSocket Secure, requires a FQDN, port,\n' +
        '                                    and SSL certificate\n' +
        '                              - ws: WebSocket, only requires public IP/FQDN and port\n' +
        '                              - dumb: discouraged as the number of dumb nodes might\n' +
        '                                    be limited\n' +
        '\n' +
        'Options:\n' +
        '  --help                     Show this usage instructions.\n' +
        '  --log[=LEVEL]              Configure global log level. Not specifying a log\n' +
        '                             level will enable verbose log output.\n' +
        '  --miner[=THREADS]          Activate mining on this node. The miner will be set\n' +
        '                             up to use THREADS parallel threads.\n' +
        '  --pool=SERVER:PORT         Mine shares for mining pool with address SERVER:PORT\n' +
        '  --device-data=DATA_JSON    Pass information about this device to the pool. Takes a\n' +
        '                             valid JSON string, the format of which is defined by the\n' +
        '                             pool operator. Only used when registering for a pool.\n' +
        '  --passive                  Do not actively connect to the network and do not\n' +
        '                             wait for connection establishment.\n' +
        '  --rpc[=PORT]               Start JSON-RPC server on port PORT (default: 8648).\n' +
        '  --metrics[=PORT]           Start Prometheus-compatible metrics server on port\n' +
        '           [:PASSWORD]       PORT (default: 8649). If PASSWORD is specified, it\n' +
        '                             is required to be used for username "metrics" via\n' +
        '                             Basic Authentication.\n' +
        '  --ui[=PORT]                Serve a UI on port PORT (default: 8650).\n' +
        '                             The UI will be reachable at localhost:PORT.\n' +
        '  --statistics[=INTERVAL]    Output statistics like mining hashrate, current\n' +
        '                             account balance and mempool size every INTERVAL\n' +
        '                             seconds.\n' +
        '  --type=TYPE                Configure the consensus type to establish, one of\n' +
        '                             full (default), light, nano or pico.\n' +
        '  --volatile                 Run in volatile mode. Consensus state is kept\n' +
        '                             in memory only and not written to disk.\n' +
        '  --reverse-proxy[=PORT]     This client is behind a reverse proxy running on PORT,IP\n' +
        '                 [,IP]       (default: 8444,::ffff:127.0.0.1).\n' +
        '  --wallet-seed=SEED         Initialize wallet using SEED as a wallet seed.\n' +
        '  --wallet-address=ADDRESS   Initialize wallet using ADDRESS as a wallet address\n' +
        '                             The wallet cannot be used to sign transactions when\n' +
        '                             using this option.\n' +
        '  --extra-data=EXTRA_DATA    Extra data to add to every mined block.\n' +
        '  --network=NAME             Configure the network to connect to, one of\n' +
        '                             main (default), test, or dev.\n');

    process.exit();
}

const isNano = config.type === 'nano' || config.type === 'pico';

if (isNano && config.miner.enabled && config.poolMining.mode !== 'nano') {
    console.error('Cannot mine when running as a nano client');
    process.exit(1);
}
if (config.metricsServer.enabled && config.protocol !== 'wss') {
    console.error('Cannot provide metrics when running without a certificate');
    process.exit(1);
}
if (config.metricsServer.enabled && isNano) {
    console.error('Cannot provide metrics when running as a nano client');
    process.exit(1);
}
if ((isNano || config.poolMining.mode === 'nano') && config.uiServer.enabled) {
    console.error('The UI is currently not supported for nano clients');
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
if (config.host && config.protocol === 'dumb') {
    console.error('Cannot use both --host and --protocol=dumb');
    process.exit(1);
}
if (config.reverseProxy.enabled && config.protocol === 'dumb') {
    console.error('Cannot run a dumb client behind a reverse proxy');
    process.exit(1);
}
if (config.type === 'full' && config.volatile) {
    console.error('Cannot run in volatile mode as a full client');
    process.exit(1);
}

Nimiq.Log.instance.level = config.log.level;
for (const tag in config.log.tags) {
    Nimiq.Log.instance.setLoggable(tag, config.log.tags[tag]);
}

for (const key in config.constantOverrides) {
    Nimiq.ConstantHelper.instance.set(key, config.constantOverrides[key]);
}

for (const seedPeer of config.seedPeers) {
    if (!seedPeer.host || !seedPeer.port) {
        console.error('Seed peers must have host and port attributes set');
        process.exit(1);
    }
}

const TAG = 'Node';
const $ = {};

(async () => {
    if (config.protocol === 'dumb') {
        Nimiq.Log.e(TAG, `******************************************************************************`);
        Nimiq.Log.e(TAG, `*                                                                            *`);
        Nimiq.Log.e(TAG, `*  You are running in 'dumb' configuration, so others can't connect to you.  *`);
        Nimiq.Log.e(TAG, `*  Consider switching to a proper WebSocket/WebSocketSecure configuration.   *`);
        Nimiq.Log.e(TAG, `*                                                                            *`);
        Nimiq.Log.e(TAG, `******************************************************************************`);
    }

    Nimiq.Log.i(TAG, `Nimiq NodeJS Client starting (network=${config.network}`
        + `, ${config.host ? `host=${config.host}, port=${config.port}` : 'dumb'}`
        + `, miner=${config.miner.enabled}, rpc=${config.rpcServer.enabled}${config.rpcServer.enabled ? `@${config.rpcServer.port}` : ''}`
        + `, ui=${config.uiServer.enabled}${config.uiServer.enabled? `@${config.uiServer.port}` : ''}`
        + `, metrics=${config.metricsServer.enabled}${config.metricsServer.enabled ? `@${config.metricsServer.port}` : ''})`);

    Nimiq.GenesisConfig.init(Nimiq.GenesisConfig.CONFIGS[config.network]);

    for (const seedPeer of config.seedPeers) {
        let address;
        switch (seedPeer.protocol) {
            case 'ws':
                address = Nimiq.WsPeerAddress.seed(seedPeer.host, seedPeer.port, seedPeer.publicKey);
                break;
            case 'wss':
            default:
                address = Nimiq.WssPeerAddress.seed(seedPeer.host, seedPeer.port, seedPeer.publicKey);
                break;
        }
        Nimiq.GenesisConfig.SEED_PEERS.push(address);
    }

    const clientConfigBuilder = Nimiq.Client.Configuration.builder();
    clientConfigBuilder.protocol(config.protocol, config.host, config.port, config.tls.key, config.tls.cert);
    if (config.reverseProxy.enabled) clientConfigBuilder.reverseProxy(config.reverseProxy.port, config.reverseProxy.header, config.reverseProxy.terminatesSsl, ...config.reverseProxy.addresses);
    if (config.passive) clientConfigBuilder.feature(Nimiq.Client.Feature.PASSIVE);
    if (config.type === 'full' || config.type === 'light') clientConfigBuilder.feature(Nimiq.Client.Feature.MEMPOOL);
    const clientConfig = clientConfigBuilder.build();
    const networkConfig = clientConfig.networkConfig;

    switch (config.type) {
        case 'full':
            $.consensus = await Nimiq.Consensus.full(networkConfig);
            break;
        case 'light':
            $.consensus = await (!config.volatile
                ? Nimiq.Consensus.light(networkConfig)
                : Nimiq.Consensus.volatileLight(networkConfig));
            break;
        case 'nano':
            $.consensus = await (!config.volatile
                ? Nimiq.Consensus.nano(networkConfig)
                : Nimiq.Consensus.volatileNano(networkConfig));
            break;
        case 'pico':
            $.consensus = await Nimiq.Consensus.pico(networkConfig);
    }

    $.client = new Nimiq.Client(clientConfig, $.consensus);
    $.blockchain = $.consensus.blockchain;
    $.accounts = $.blockchain.accounts;
    $.mempool = $.consensus.mempool;
    $.network = $.consensus.network;

    Nimiq.Log.i(TAG, `Peer address: ${networkConfig.publicPeerAddress.toString()} - public key: ${networkConfig.keyPair.publicKey.toHex()}`);

    // TODO: Wallet key.
    $.walletStore = await new Nimiq.WalletStore();
    if (!config.wallet.address && !config.wallet.seed) {
        // Load or create default wallet.
        $.wallet = await $.walletStore.getDefault();
    } else if (config.wallet.seed) {
        // Load wallet from seed.
        const mainWallet = Nimiq.Wallet.loadPlain(config.wallet.seed);
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

    const account = await $.client.getAccount($.wallet.address).catch(() => null);
    Nimiq.Log.i(TAG, `Wallet initialized for address ${$.wallet.address.toUserFriendlyAddress()}.`
        + (account ? ` Balance: ${Nimiq.Policy.lunasToCoins(account.balance)} NIM` : ''));

    const chainHeight = await $.client.getHeadHeight();
    const chainHeadHash = await $.client.getHeadHash();
    Nimiq.Log.i(TAG, `Blockchain state: height=${chainHeight}, headHash=${chainHeadHash}`);

    const extraData = config.miner.extraData ? Nimiq.BufferUtils.fromAscii(config.miner.extraData) : new Uint8Array(0);
    if (config.poolMining.enabled || config.uiServer.enabled) { // ui requires SmartPoolMiner to be able to switch
        // between solo mining and pool mining
        const deviceId = Nimiq.BasePoolMiner.generateDeviceId(networkConfig);
        const deviceData = config.poolMining.deviceData || {};
        const poolMode = isNano ? 'nano' : config.poolMining.mode;
        deviceData.userAgent = Nimiq.Version.createUserAgent();
        switch (poolMode) {
            case 'nano':
                $.miner = new Nimiq.NanoPoolMiner($.blockchain, $.network.time, $.wallet.address, deviceId, deviceData);
                break;
            case 'smart':
            default:
                $.miner = new Nimiq.SmartPoolMiner($.blockchain, $.accounts, $.mempool, $.network.time, $.wallet.address, deviceId, deviceData, extraData);
                break;
        }
        $.client.addConsensusChangedListener((state) => {
            if (state === Nimiq.Client.ConsensusState.ESTABLISHED) {
                if (!config.poolMining.enabled || !$.miner.isDisconnected()) return;
                if (!config.poolMining.host || config.poolMining.port === -1) {
                    Nimiq.Log.i(TAG, 'Not connecting to pool as mining pool host or port were not specified.');
                    return;
                }
                Nimiq.Log.i(TAG, `Connecting to pool ${config.poolMining.host} using device id ${deviceId} as a ${poolMode} client.`);
                $.miner.connect(config.poolMining.host, config.poolMining.port);
            }
        });
    } else {
        $.miner = new Nimiq.Miner($.blockchain, $.accounts, $.mempool, $.network.time, $.wallet.address, extraData);
    }

    let consensusState = Nimiq.Client.ConsensusState.CONNECTING;
    $.client.addConsensusChangedListener(async (state) => {
        consensusState = state;
        if (state === Nimiq.Client.ConsensusState.ESTABLISHED) {
            if (config.miner.enabled) $.miner.startWork();
            Nimiq.Log.i(TAG, `Blockchain ${config.type}-consensus established in ${(Date.now() - START) / 1000}s.`);
            const chainHeight = await $.client.getHeadHeight();
            const chainHeadHash = await $.client.getHeadHash();
            Nimiq.Log.i(TAG, `Current state: height=${chainHeight}, headHash=${chainHeadHash}`);
        } else {
            if (!config.poolMining.enabled || config.poolMining.mode !== 'nano') $.miner.stopWork();
        }
    });

    $.client.addBlockListener(async (hash) => {
        if (consensusState === Nimiq.Client.ConsensusState.SYNCING) {
            const head = await $.client.getBlock(hash, false);
            if (head.height % 100 === 0) {
                Nimiq.Log.i(TAG, `Syncing at block: ${head.height}`);
            }
        }
    });

    $.client.addHeadChangedListener(async (hash, reason) => {
        const head = await $.client.getBlock(hash, false);
        Nimiq.Log.i(TAG, `Now at block: ${head.height} (${reason})`);
    });

    // TODO: Peer changed listeners
    $.network.on('peer-joined', (peer) => {
        Nimiq.Log.i(TAG, `Connected to ${peer.peerAddress.toString()}`);
    });
    $.network.on('peer-left', (peer) => {
        Nimiq.Log.i(TAG, `Disconnected from ${peer.peerAddress.toString()}`);
    });

    const isSeed = (peerAddress) => Nimiq.GenesisConfig.SEED_PEERS.some(seed => seed.equals(peerAddress));
    $.network.on('peer-joined', (peer) => {
        if (Math.abs(peer.timeOffset) > Nimiq.Network.TIME_OFFSET_MAX && isSeed(peer.peerAddress)) {
            Nimiq.Log.e(TAG, 'Your local system time seems to be wrong! You might not be able to synchronize with the network.');
        }
    });

    if (config.miner.enabled && config.passive) {
        $.miner.startWork();
    }

    if (typeof config.miner.threads === 'number') {
        $.miner.threads = config.miner.threads;
    }
    $.miner.throttleAfter = config.miner.throttleAfter;
    $.miner.throttleWait = config.miner.throttleWait;

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
                const account = !isNano ? await $.accounts.get($.wallet.address) : null;
                const sum = hashrates.reduce((acc, val) => acc + val, 0);
                Nimiq.Log.i(TAG, `Hashrate: ${(sum / hashrates.length).toFixed(2).padStart(7)} H/s`
                    + (account ? ` - Balance: ${Nimiq.Policy.lunasToCoins(account.balance)} NIM` : '')
                    + (config.poolMining.enabled ? ` - Pool balance: ${Nimiq.Policy.lunasToCoins($.miner.balance)} NIM (confirmed ${Nimiq.Policy.lunasToCoins($.miner.confirmedBalance)} NIM)` : '')
                    + ` - Mempool: ${$.mempool.getTransactions().length} tx`);
                hashrates.length = 0;
            }
        });
    }

    if (config.rpcServer.enabled || config.uiServer.enabled) {
        // Add CORS domain for UI.
        if (config.uiServer.enabled) {
            config.rpcServer.corsdomain = typeof config.rpcServer.corsdomain === 'string'
                ? [config.rpcServer.corsdomain]
                : (config.rpcServer.corsdomain || []);
            config.rpcServer.corsdomain.push(`http://localhost:${config.uiServer.port}`);
        }

        // Use restricted set of RPC functions for UI.
        if (!config.rpcServer.enabled) {
            config.rpcServer.methods = [
                'consensus',
                'blockNumber',
                'getBlockByNumber',
                'peerCount',
                'mining',
                'minerThreads',
                'minerAddress',
                'hashrate',
                'pool',
                'poolConnectionState',
                'poolConfirmedBalance',
                'getAccount'
            ];
        }

        $.rpcServer = new JsonRpcServer(config.rpcServer, config.miner, config.poolMining);
        await $.rpcServer.init($.client, $.consensus, $.miner, $.walletStore);
    }

    if (config.metricsServer.enabled) {
        $.metricsServer = new MetricsServer(networkConfig.ssl, config.metricsServer.port, config.metricsServer.password);
        $.metricsServer.init($.client, $.blockchain, $.mempool, $.network, $.miner);
    }

    if (config.uiServer.enabled) {
        $.uiServer = new UiServer(config.uiServer);
        openBrowserTab(`http://localhost:${config.uiServer.port}#port=${config.rpcServer.port}`, () => {
            Nimiq.Log.w(TAG, 'Failed to automatically open the UI in your web browser.');
            Nimiq.Log.w(TAG, `Go to http://localhost:${config.uiServer.port}#port=${config.rpcServer.port} to access it.`);
        });
    }
})().catch(e => {
    console.error(e);
    process.exit(1);
});
