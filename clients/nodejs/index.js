const Nimiq = require('../../dist/node.js');
const argv = require('minimist')(process.argv.slice(2));

if (!argv.host || !argv.port || !argv.key || !argv.cert) {
    console.log('Usage: node index.js --host=<hostname> --port=<port> --key=<ssl-key> --cert=<ssl-cert> [--wallet-seed=<wallet-seed>] [--wallet-address=<address>] [--miner[=<thread-num>[:<throttle-after>[:<throttle-wait>]]]] [--statistics[=<interval>]] [--passive] [--log=LEVEL] [--log-tag=TAG[:LEVEL]]');
    process.exit();
}

const host = argv.host;
const port = parseInt(argv.port);
const minerOptions = argv.miner;
const statisticsOptions = argv.statistics;
const passive = argv.passive;
const key = argv.key;
const cert = argv.cert;
const walletSeed = argv['wallet-seed'] || null;
const walletAddress = argv['wallet-address'] || null;

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

console.log(`Nimiq NodeJS Client starting (host=${host}, port=${port}, miner=${!!minerOptions}, statistics=${!!statisticsOptions}, passive=${!!passive})`);

const TAG = 'Node';

const $ = {};

(async () => {
    const netconfig = new Nimiq.NetworkConfig(host, port, key, cert);
    $.consensus = await Nimiq.Consensus.full(netconfig);

    $.blockchain = $.consensus.blockchain;
    $.accounts = $.blockchain.accounts;
    $.mempool = $.consensus.mempool;
    $.network = $.consensus.network;

    if (!walletAddress) {
        $.wallet = walletSeed ? await Nimiq.Wallet.load(walletSeed) : await Nimiq.Wallet.getPersistent();
    } else {
        $.wallet = { address: Nimiq.Address.fromUserFriendlyAddress(walletAddress) };
    }

    const account = await $.accounts.get($.wallet.address) || Nimiq.Account.INITIAL;
    Nimiq.Log.i(TAG, `Wallet initialized for address ${$.wallet.address.toUserFriendlyAddress()}.`
                  + ` Balance: ${Nimiq.Policy.satoshisToCoins(account.balance)} NIM`);

    $.miner = new Nimiq.Miner($.blockchain, $.mempool, $.accounts, $.network.time, $.wallet.address);

    Nimiq.Log.i(TAG, () => `Blockchain: height=${$.blockchain.height}, totalWork=${$.blockchain.totalWork}, headHash=${$.blockchain.headHash.toBase64()}`);

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
        Nimiq.Log.i(TAG, 'Blockchain consensus established');
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
                const account = await $.accounts.get($.wallet.address) || Nimiq.Account.INITIAL;
                const sum = hashrates.reduce((acc, val) => acc + val, 0);
                Nimiq.Log.i(TAG, `Hashrate: ${(sum / hashrates.length).toFixed(Math.log10(hashrates.length)).padStart(7)} H/s`
                            + ` - Balance: ${Nimiq.Policy.satoshisToCoins(account.balance)} NIM`
                            + ` - Mempool: ${$.mempool.getTransactions().length} tx`);
                hashrates.length = 0;
            }
        });
    }
})().catch(e => {
    console.error(e);
    process.exit(1);
});
