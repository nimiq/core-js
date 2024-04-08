/**
 * Stores the validator configuration that will be registered
 * It also generates the data field for the txns that are necessary to register a new validator
 */
class ValidatorRegistry {
    /**
     * @param {Address} validator_address
     * @param {string} signing_key
     * @param {BLSPublicKey} voting_key
    */
    constructor(validator_address, signing_key, voting_key) {
        /** @type {Address} */
        this._validator_address = validator_address;
        /** @type {string} */
        this._signing_key = signing_key;
        /** @type {BLSPublicKey} */
        this._voting_key = voting_key;
    }

    /**
     * Obtains the serialized data for validator registration
     * (All sizes in bytes)
     *
     * <- 1  -><- 11 -> <-    32    -><-      20        ->
     * | Type | Unused | Signing key | Validator Address |
     *
     * <- 1  -><- 6   -> <-           57                ->
     * | Type | Unused |        Voting key[0]            |
     *
     * <- 1  -><- 6   -> <-           57                ->
     * | Type | Unused |        Voting key[1]            |
     *
     * <- 1  -><- 6   -> <-           57                ->
     * | Type | Unused |        Voting key[2]            |
     *
     * <- 1  -><- 6   -> <-           57                ->
     * | Type | Unused |        Voting key[3]            |
     *
     * <- 1  -><- 6   -> <-           57                ->
     * | Type | Unused |        Voting key[4]            |
     */
    get_serialized_data() {
        const txns_data = [];

        // Serialize first part of the transaction data
        let data = new Nimiq.SerialBuffer(64);
        // First byte: type
        let type = 1;
        data.writeUint8(type);

        // Unused bytes
        const unused = new Uint8Array(11);
        data.write(unused);

        // Signing key and validator address
        this._signing_key.serialize(data);
        this._validator_address.serialize(data);

        // We are done with the first part of the transaction data
        txns_data.push(data);

        // Extract the voting key
        const voting_key = Nimiq.BufferUtils.fromHex(this._voting_key.toHex());

        if (voting_key.length != 285) {
            console.error('Invalid voting key');
            process.exit(1);
        }

        // Create the next transactions
        const vk_unused = new Uint8Array(6);

        for (let i = 0; i < 5; i++) {
            data = new Nimiq.SerialBuffer(64);
            type += 1;
            data.writeUint8(type);
            data.write(vk_unused);
            // We read the voting key in 57 bytes chunks
            data.write(voting_key.read(57));
            txns_data.push(data);
        }

        return txns_data;
    }
}

function help() {
    console.log(`Nimiq NodeJS tool to register a new validator

Usage:
    node validator.js [options]

Description:
    If no arguments are provided all validator keys are generated and stored in a JSONC file
    Otherwise, the user must specify the path to the JSONC file with the validator configuration:
    The Validator Account, the Signing Key and the Voting Key.
    The nimiq core-web package is necessary to execute this tool, this can be installed via:
    $npm install @nimiq/core-web@next

Options:
    --help             Display this help page
    --validator        Path to the validator specification file (JSONC)
    --network          The network that should be used to register a validator. 
                       If this argument is not provided, we connect to the test network by default
    `);
}

const START = Date.now();
const argv = require('minimist')(process.argv.slice(2));
const Nimiq = require('../../dist/node.js');
const NimiqPOS = require ('@nimiq/core-web');
const config = require('./modules/Config.js')(argv);
const fs = require('fs');
const JSON5 = require('json5');
const TXN_VALUE = 1;
const TXN_FEE = 0;

// This tool uses a nano node
config.protocol = 'dumb';
config.type = 'nano';
config.network = 'test';

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
    if (argv.help) {
        return help();
    }

    if (!argv.validator){

        const pathToValidatorsFile = 'validator-keys.json';

        // Check if the file or directory exists synchronously
        if (fs.existsSync(pathToValidatorsFile)) {
            console.log(`WARNING! \nThe validator keys file already exists`);
            console.log(`\nPlease remove this file if you are sure you want to generate new validator keys`);
            process.exit(0);
        }

        // We are in validator configuration generation mode
        // We need to generate the validator paramaters and exit the tool
        console.log('Generating new validator paramaters... \n\n');

        // First we generate the validator address parameters.
        const validatorKeyPair =  NimiqPOS.KeyPair.generate();
        const validatorAddress = validatorKeyPair.toAddress();

        console.log('   Validator Account: ');
        console.log('Address: ');
        console.log(validatorAddress.toUserFriendlyAddress());
        console.log('Public key: ');
        console.log(validatorKeyPair.publicKey.toHex());
        console.log('Private Key: ');
        console.log(validatorKeyPair.privateKey.toHex());

        // Now we generate the signing key.
        const signingKeyPair =  NimiqPOS.KeyPair.generate();

        console.log('\n   Signing key: ');
        console.log('Public key: ');
        console.log(signingKeyPair.publicKey.toHex());
        console.log('Private key: ');
        console.log(signingKeyPair.privateKey.toHex());

        // Finally we generate the voting key (BLS)
        const votingKeyPair = NimiqPOS.BLSKeyPair.generate();

        console.log('\n   Voting BLS key: ');
        console.log('Public key: ');
        console.log(votingKeyPair.publicKey.toHex());
        console.log('Secret key: ');
        console.log(votingKeyPair.secretKey.toHex());

        // Now we write the configuration to a JSON file
        const validatorConfiguration = {
            'ValidatorAccount': {
                'Address': validatorAddress.toUserFriendlyAddress(),
                'PublicKey': validatorKeyPair.publicKey.toHex(),
                'PrivateKey': validatorKeyPair.privateKey.toHex(),
            },
            'SigningKey': {
                'PublicKey': signingKeyPair.publicKey.toHex(),
                'PrivateKey': signingKeyPair.privateKey.toHex(),
            },
            'VotingKey': {
                'PublicKey': votingKeyPair.publicKey.toHex(),
                'SecretKey': votingKeyPair.secretKey.toHex(),
            }
        };

        // converting the JSON object to a string
        const data = JSON.stringify(validatorConfiguration);

        try {
            fs.writeFileSync(pathToValidatorsFile, data);
        } catch (error) {
            // logging the error
            console.error(error);

            throw error;
        }

        console.log('\n\nValidator configuration file sucessfully written (validator-keys.json).');

       process.exit(0);
    }

    if (argv.network){
        config.network = argv.network
    }

    console.log(' Reading validator configuration.. ');
    let validator_config = JSON5.parse(fs.readFileSync(argv.validator));

    console.log(validator_config);

    Nimiq.Log.i(TAG, `Nimiq NodeJS Client starting (network=${config.network}`
        + `, ${config.host ? `host=${config.host}, port=${config.port}` : 'dumb'}`);

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
    if (config.reverseProxy.enabled) clientConfigBuilder.reverseProxy(config.reverseProxy.port, config.reverseProxy.header, ...config.reverseProxy.addresses);
    if (config.passive) clientConfigBuilder.feature(Nimiq.Client.Feature.PASSIVE);
    clientConfigBuilder.feature(Nimiq.Client.Feature.MEMPOOL);

    const clientConfig = clientConfigBuilder.build();
    const networkConfig = clientConfig.networkConfig;

    $.consensus = await (!config.volatile
        ? Nimiq.Consensus.nano(networkConfig)
        : Nimiq.Consensus.volatileNano(networkConfig));

    $.client = new Nimiq.Client(clientConfig, $.consensus);
    $.blockchain = $.consensus.blockchain;
    $.accounts = $.blockchain.accounts;
    $.mempool = $.consensus.mempool;
    $.network = $.consensus.network;

    Nimiq.Log.i(TAG, `Peer address: ${networkConfig.peerAddress.toString()} - public key: ${networkConfig.keyPair.publicKey.toHex()}`);

    // This is the hardcoded address dedicated to validator registration
    const recipientAddr = Nimiq.Address.fromUserFriendlyAddress('NQ07 0000 0000 0000 0000 0000 0000 0000 0000');

    // Extract the validator configuration (we read the private keys from the config file)
    let validatorPrivateKey = Nimiq.PrivateKey.unserialize(Nimiq.BufferUtils.fromHex(validator_config.ValidatorAccount.PrivateKey));
    let signingPrivateKey = Nimiq.PrivateKey.unserialize(Nimiq.BufferUtils.fromHex(validator_config.SigningKey.PrivateKey));
    let votingSecretKey =  NimiqPOS.BLSSecretKey.fromHex(validator_config.VotingKey.SecretKey);

    // Create the KeyPairs
    const validatorKeyPair = Nimiq.KeyPair.derive(validatorPrivateKey);
    const SigningKeyPair = Nimiq.KeyPair.derive(signingPrivateKey);
    const votingKeyPair = NimiqPOS.BLSKeyPair.derive(votingSecretKey);

    // Create a new validator registry
    let validator = new ValidatorRegistry(validatorKeyPair.publicKey.toAddress(), SigningKeyPair.publicKey, votingKeyPair.publicKey);

    // Get the transaction's data
    let data = validator.get_serialized_data();

    // We monitor the status of the validator registration transactions
    $.client.addTransactionListener((tx) => {
        console.log(' Transaction update: ');
        console.log(tx);
    }, [recipientAddr]);

    let consensusState = Nimiq.Client.ConsensusState.CONNECTING;
    $.client.addConsensusChangedListener(async (state) => {
        consensusState = state;
        if (state === Nimiq.Client.ConsensusState.ESTABLISHED) {
            Nimiq.Log.i(TAG, `Blockchain ${config.type}-consensus established in ${(Date.now() - START) / 1000}s.`);
            const chainHeight = await $.client.getHeadHeight();
            const chainHeadHash = await $.client.getHeadHash();
            Nimiq.Log.i(TAG, `Current state: height=${chainHeight}, headHash=${chainHeadHash}`);

            const account = await $.client.getAccount(validatorKeyPair.publicKey.toAddress()).catch(() => null);
            const balance = Nimiq.Policy.lunasToCoins(account.balance)

            Nimiq.Log.i(TAG, `Validator address ${validatorKeyPair.publicKey.toAddress().toUserFriendlyAddress()}.`
            + (account ? ` Balance: ${balance} NIM` : ''));

            // We need to send 6 txns, 1 Luna each
            if (account.balance < 6){
                console.error('Not enough funds to pay the validator registration txns');
                process.exit(1);
            }

            // Once we obtain consensus, we send the validator transactions
            // Send the txns for validator registration
            for (let i = 0; i < 6; i++) {
                console.log('sending transaction: ');

                let transaction = new Nimiq.ExtendedTransaction(validatorKeyPair.publicKey.toAddress(), Nimiq.Account.Type.BASIC, recipientAddr, Nimiq.Account.Type.BASIC, TXN_VALUE, TXN_FEE, chainHeight, Nimiq.Transaction.Flag.NONE, data[i]);

                const proof = Nimiq.SignatureProof.singleSig(validatorKeyPair.publicKey, Nimiq.Signature.create(validatorKeyPair.privateKey, validatorKeyPair.publicKey, transaction.serializeContent())).serialize();
                transaction.proof = proof;

                let result = await $.client.sendTransaction(transaction);

                console.log(' Transaction result: ');
                console.log(result);

                console.log(' Transaction hash: ');
                console.log(transaction.hash().toHex());
            }
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

    $.network.on('peer-joined', (peer) => {
        Nimiq.Log.i(TAG, `Connected to ${peer.peerAddress.toString()}`);
    });
    $.network.on('peer-left', (peer) => {
        Nimiq.Log.i(TAG, `Disconnected from ${peer.peerAddress.toString()}`);
    });
})().catch(e => {
    console.error(e);
    process.exit(1);
});
