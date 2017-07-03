const Nimiq = require('../../dist/node.js');
const argv = require('minimist')(process.argv.slice(2));

if (!argv.host || !argv.port || !argv.key || !argv.cert) {
    console.log('Usage: node index.js --host=<hostname> --port=<port> --key=<ssl-key> --cert=<ssl-cert> [--wallet-seed=<wallet-seed>] [--miner] [--passive] [--log=LEVEL] [--log-tag=TAG[:LEVEL]]');
    process.exit();
}

const host = argv.host;
const port = parseInt(argv.port);
const miner = argv.miner;
const minerSpeed = argv['miner-speed'] || 75;
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
        Nimiq.Log.instance.setLoggable(s[0], s.length == 1 ? 2 : s[1]);
    });
}

console.log(`Nimiq NodeJS Client starting (host=${host}, port=${port}, miner=${!!miner}, passive=${!!passive})`);

function _balanceChanged(balance) {
    if (!balance) balance = Nimiq.Balance.INITIAL;
    console.log('Balance: ' + Nimiq.Policy.satoshisToCoins(balance.value));
}

// XXX Configure Core.
// TODO Create config/options object and pass to Core.get()/init().
Nimiq.NetworkConfig.configurePeerAddress(host, port);
Nimiq.NetworkConfig.configureSSL(key, cert);

const options = {
    'walletSeed': walletSeed
};

try {
    (new Nimiq.Core(options)).then($ => {
        console.log(`Blockchain: height=${$.blockchain.height}, totalWork=${$.blockchain.totalWork}, headHash=${$.blockchain.headHash.toBase64()}`);

        $.blockchain.on('head-changed', (head) => {
            console.log(`Now at block: ${head.height}`);
        });

        if (!passive) {
            $.network.connect();
        }

        if (miner) {
            $.consensus.on('established', () => $.miner.startWork());
            $.consensus.on('lost', () => $.miner.stopWork());
        }

        $.consensus.on('established', () => {
            console.log('Blockchain consensus established');
            $.accounts.getBalance($.wallet.address).then(_balanceChanged);
        });

        $.miner.on('block-mined', (block) => {
            console.log(`Block mined: ${block.header}`);
        });

        $.accounts.on($.wallet.address, (account) => _balanceChanged(account._balance));

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
