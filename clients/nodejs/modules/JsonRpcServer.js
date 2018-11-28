const http = require('http');
const fs = require('fs');
const path = require('path');
const JSON5 = require('json5');
const btoa = require('btoa');
const NodeUtils = require('./NodeUtils.js');
const Nimiq = require('../../../dist/node.js');

class JsonRpcServer {
    /**
     * @param {{port: number, corsdomain: string|Array.<string>, username: ?string, password: ?string, allowip: string|Array.<string>, methods: ?Array.<string>}} config
     * @param {{enabled: boolean, threads: number, throttleAfter: number, throttleWait: number, extraData: string}} minerConfig
     * @param {{enabled: boolean, host: string, port: number, mode: string}} poolConfig
     */
    constructor(config, minerConfig, poolConfig) {
        this._config = config;
        this._minerConfig = minerConfig;
        this._poolConfig = poolConfig;

        if (typeof config.corsdomain === 'string') config.corsdomain = [config.corsdomain];
        if (!config.corsdomain) config.corsdomain = [];
        if (typeof config.allowip === 'string') config.allowip = [config.allowip];
        if (!config.allowip) config.allowip = [];

        http.createServer((req, res) => {
            // Block requests that might originate from a website in the users browser,
            // unless the origin is explicitly whitelisted.
            if (config.corsdomain.includes(req.headers.origin)) {
                res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
                res.setHeader('Access-Control-Allow-Methods', 'POST');
                res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
                res.setHeader('Access-Control-Max-Age', '900');
            } else if (req.headers.origin || req.headers.referer) {
                res.writeHead(403, `Access not allowed from ${req.headers.origin || req.headers.referer}`);
                res.end();
                return;
            }

            // Deny IP addresses other than local if not explicitly allowed.
            const remoteIp = req.connection.remoteAddress;
            if (!Nimiq.NetUtils.isLocalIP(remoteIp)) { // Not local host
                let found = false;
                for (const subnet of config.allowip) {
                    found |= Nimiq.NetUtils.isIPv4inSubnet(remoteIp, subnet);
                }
                if (!found) {
                    res.writeHead(403);
                    res.end();
                    return;
                }
            }

            if (req.method === 'GET') {
                res.writeHead(200);
                res.end('Nimiq JSON-RPC Server\n');
            } else if (req.method === 'POST') {
                if (JsonRpcServer._authenticate(req, res, config.username, config.password)) {
                    this._onRequest(req, res);
                }
            } else {
                res.writeHead(200);
                res.end();
            }
        }).listen(config.port, config.allowip.length ? '0.0.0.0' : '127.0.0.1');

        /** @type {Map.<string, function(*)>} */
        this._methods = new Map();

        /** @type {string} */
        this._consensusState = 'syncing';
    }

    /**
     * @param {FullConsensus} consensus
     * @param {FullChain} blockchain
     * @param {Accounts} accounts
     * @param {Mempool} mempool
     * @param {Network} network
     * @param {Miner|SmartPoolMiner|NanoPoolMiner} miner
     * @param {WalletStore} walletStore
     */
    init(consensus, blockchain, accounts, mempool, network, miner, walletStore) {
        this._consensus = consensus;
        this._blockchain = blockchain;
        this._accounts = accounts;
        this._mempool = mempool;
        this._network = network;
        this._miner = miner;
        this._walletStore = walletStore;

        this._startingBlock = blockchain.height;
        this._consensus.on('established', () => this._consensusState = 'established');
        this._consensus.on('syncing', () => this._consensusState = 'syncing');
        this._consensus.on('lost', () => this._consensusState = 'lost');

        // Network
        this._methods.set('peerCount', this.peerCount.bind(this));
        this._methods.set('syncing', this.syncing.bind(this));
        this._methods.set('consensus', this.consensus.bind(this));
        this._methods.set('peerList', this.peerList.bind(this));
        this._methods.set('peerState', this.peerState.bind(this));

        // Transactions
        this._methods.set('sendRawTransaction', this.sendRawTransaction.bind(this));
        this._methods.set('createRawTransaction', this.createRawTransaction.bind(this));
        this._methods.set('sendTransaction', this.sendTransaction.bind(this));
        this._methods.set('getRawTransactionInfo', this.getRawTransactionInfo.bind(this));
        this._methods.set('getTransactionByBlockHashAndIndex', this.getTransactionByBlockHashAndIndex.bind(this));
        this._methods.set('getTransactionByBlockNumberAndIndex', this.getTransactionByBlockNumberAndIndex.bind(this));
        this._methods.set('getTransactionByHash', this.getTransactionByHash.bind(this));
        this._methods.set('getTransactionReceipt', this.getTransactionReceipt.bind(this));
        this._methods.set('getTransactionsByAddress', this.getTransactionsByAddress.bind(this));
        this._methods.set('mempoolContent', this.mempoolContent.bind(this));
        this._methods.set('mempool', this.mempool.bind(this));
        this._methods.set('minFeePerByte', this.minFeePerByte.bind(this));

        // Miner
        this._methods.set('mining', this.mining.bind(this));
        this._methods.set('hashrate', this.hashrate.bind(this));
        this._methods.set('minerThreads', this.minerThreads.bind(this));
        this._methods.set('minerAddress', this.minerAddress.bind(this));
        this._methods.set('pool', this.pool.bind(this));
        this._methods.set('poolConnectionState', this.poolConnectionState.bind(this));
        this._methods.set('poolConfirmedBalance', this.poolConfirmedBalance.bind(this));
        this._methods.set('getWork', this.getWork.bind(this));
        this._methods.set('getBlockTemplate', this.getBlockTemplate.bind(this));
        this._methods.set('submitBlock', this.submitBlock.bind(this));

        // Accounts
        this._methods.set('accounts', this.accounts.bind(this));
        this._methods.set('createAccount', this.createAccount.bind(this));
        this._methods.set('getBalance', this.getBalance.bind(this));
        this._methods.set('getAccount', this.getAccount.bind(this));

        // Blockchain
        this._methods.set('blockNumber', this.blockNumber.bind(this));
        this._methods.set('getBlockTransactionCountByHash', this.getBlockTransactionCountByHash.bind(this));
        this._methods.set('getBlockTransactionCountByNumber', this.getBlockTransactionCountByNumber.bind(this));
        this._methods.set('getBlockByHash', this.getBlockByHash.bind(this));
        this._methods.set('getBlockByNumber', this.getBlockByNumber.bind(this));

        this._methods.set('constant', this.constant.bind(this));
        this._methods.set('log', this.log.bind(this));

        // Apply method whitelist if configured.
        if (this._config.methods && this._config.methods.length > 0) {
            const whitelist = new Set(this._config.methods);
            for (const method of this._methods.keys()) {
                if (!whitelist.has(method)) {
                    this._methods.delete(method);
                }
            }
        }
    }

    /**
     * @param req
     * @param res
     * @param {?string} username
     * @param {?string} password
     * @returns {boolean}
     * @private
     */
    static _authenticate(req, res, username, password) {
        if (username && password && req.headers.authorization !== `Basic ${btoa(`${username}:${password}`)}`) {
            res.writeHead(401, {'WWW-Authenticate': 'Basic realm="Use user-defined username and password to access the JSON-RPC API." charset="UTF-8"'});
            res.end();
            return false;
        }
        return true;
    }


    /*
     * Network
     */

    peerCount() {
        return this._network.peerCount;
    }

    consensus() {
        return this._consensusState;
    }

    syncing() {
        if (this._consensusState === 'established') return false;
        const currentBlock = this._blockchain.height;
        const highestBlock = this._blockchain.height; // TODO
        return {
            startingBlock: this._startingBlock,
            currentBlock: currentBlock,
            highestBlock: highestBlock
        };
    }

    peerList() {
        const peers = [];
        for (const peerAddressState of this._network.addresses.iterator()) {
            peers.push(this._peerAddressStateToPeerObj(peerAddressState));
        }
        return peers;
    }

    /**
     * @param {string} peer
     */
    peerState(peer, set) {
        const split = peer.split('/');
        let peerAddress;
        if (split.length === 1 || (split.length === 4 && split[3].length > 0)) {
            const peerId = Nimiq.PeerId.fromHex(split[split.length - 1]);
            peerAddress = this._network.addresses.getByPeerId(peerId);
        } else if ((split[0] === 'wss:' || split[0] === 'ws:') && split.length >= 3) {
            const colons = split[2].split(':', 2);
            if (colons.length === 2) {
                peerAddress = this._network.addresses.get(Nimiq.WsPeerAddress.seed(colons[0], parseInt(colons[1])));
            }
        }
        const addressState = peerAddress ? this._network.addresses.getState(peerAddress) : null;
        const connection = peerAddress ? this._network.connections.getConnectionByPeerAddress(peerAddress) : null;
        if (typeof set === 'string') {
            set = set.toLowerCase();
            switch (set) {
                case 'disconnect':
                    if (connection) {
                        connection.peerChannel.close(Nimiq.CloseType.MANUAL_PEER_DISCONNECT);
                    }
                    break;
                case 'fail':
                    if (connection) {
                        connection.peerChannel.close(Nimiq.CloseType.MANUAL_PEER_FAIL);
                    }
                    break;
                case 'ban':
                    if (connection) {
                        connection.peerChannel.close(Nimiq.CloseType.MANUAL_PEER_BAN);
                    }
                    break;
                case 'unban':
                    if (addressState.state === Nimiq.PeerAddressState.BANNED) {
                        addressState.state = Nimiq.PeerAddressState.TRIED;
                    }
                    break;
                case 'connect':
                    if (!connection) {
                        this._network.connections.connectOutbound(peerAddress);
                    }
                    break;
            }
        }
        return this._peerAddressStateToPeerObj(addressState);
    }

    /*
     * Transactions
     */

    async sendRawTransaction(txHex) {
        const tx = Nimiq.Transaction.unserialize(Nimiq.BufferUtils.fromHex(txHex));
        if (this._mempool.constructor === Nimiq.NanoMempool) {
            this._consensus.relayTransaction(tx);
        } else {
            const ret = await this._mempool.pushTransaction(tx);
            if (ret < 0) {
                const e = new Error(`Transaction not accepted: ${ret}`);
                e.code = ret;
                throw e;
            }
        }
        return tx.hash().toHex();
    }

    async createRawTransaction(tx) {
        const from = Nimiq.Address.fromString(tx.from);
        const fromType = tx.fromType ? Number.parseInt(tx.fromType) : Nimiq.Account.Type.BASIC;
        const to = Nimiq.Address.fromString(tx.to);
        const toType = tx.toType ? Number.parseInt(tx.toType) : Nimiq.Account.Type.BASIC;
        const value = parseInt(tx.value);
        const fee = parseInt(tx.fee);
        const flags = tx.flags ? Number.parseInt(tx.flags) : Nimiq.Transaction.Flag.NONE;
        const data = tx.data ? Nimiq.BufferUtils.fromHex(tx.data) : null;
        /** @type {Wallet} */
        const wallet = await this._walletStore.get(from);
        if (!wallet || !(wallet instanceof Nimiq.Wallet)) {
            throw new Error(`"${tx.from}" can not sign transactions using this node.`);
        }
        let transaction;
        if (fromType !== Nimiq.Account.Type.BASIC) {
            throw new Error('Only transactions from basic accounts may be created using this function.');
        } else if (toType !== Nimiq.Account.Type.BASIC || data !== null) {
            transaction = new Nimiq.ExtendedTransaction(from, fromType, to, toType, value, fee, this._blockchain.height, flags, data);
            transaction.proof = Nimiq.SignatureProof.singleSig(wallet.publicKey, Nimiq.Signature.create(wallet.keyPair.privateKey, wallet.publicKey, transaction.serializeContent())).serialize();
        } else {
            transaction = wallet.createTransaction(to, value, fee, this._blockchain.height);
        }
        return Nimiq.BufferUtils.toHex(transaction.serialize());
    }

    async sendTransaction(tx) {
        return this.sendRawTransaction(await this.createRawTransaction(tx));
    }

    async getRawTransactionInfo(txHex) {
        const tx = Nimiq.Transaction.unserialize(Nimiq.BufferUtils.fromHex(txHex));
        const liveTx = await this._getTransactionByHash(tx.hash());
        if (liveTx) {
            liveTx.valid = true;
            liveTx.inMempool = (liveTx.confirmations === 0);
            return liveTx;
        }
        const txObj = this._transactionToObj(tx);
        txObj.valid = await tx.verify();
        txObj.inMempool = false;
        return txObj;
    }

    async getTransactionByBlockHashAndIndex(blockHash, txIndex) {
        const block = await this._blockchain.getBlock(Nimiq.Hash.fromString(blockHash), /*includeForks*/ false, /*includeBody*/ true);
        if (block && block.transactions.length > txIndex) {
            return this._transactionToObj(block.transactions[txIndex], block, txIndex);
        }
        return null;
    }

    async getTransactionByBlockNumberAndIndex(number, txIndex) {
        const block = await this._getBlockByNumber(number);
        if (block && block.transactions.length > txIndex) {
            return this._transactionToObj(block.transactions[txIndex], block, txIndex);
        }
        return null;
    }

    async getTransactionByHash(hash) {
        return this._getTransactionByHash(Nimiq.Hash.fromString(hash));
    }

    async _getTransactionByHash(hash) {
        const entry = await this._blockchain.getTransactionInfoByHash(hash);
        if (entry) {
            const block = await this._blockchain.getBlock(entry.blockHash, /*includeForks*/ false, /*includeBody*/ true);
            return this._transactionToObj(block.transactions[entry.index], block, entry.index);
        }
        const mempoolTx = this._mempool.getTransaction(hash);
        if (mempoolTx) {
            return this._transactionToObj(mempoolTx);
        }
        return null;
    }

    async getTransactionReceipt(hash) {
        const entry = await this._blockchain.getTransactionInfoByHash(Nimiq.Hash.fromString(hash));
        if (!entry) return null;
        const block = await this._blockchain.getBlock(entry.blockHash);
        return {
            transactionHash: entry.transactionHash.toHex(),
            transactionIndex: entry.index,
            blockNumber: entry.blockHeight,
            blockHash: entry.blockHash.toHex(),
            confirmations: this._blockchain.height - entry.blockHeight,
            timestamp: block ? block.timestamp : undefined
        };
    }

    async getTransactionsByAddress(addr, limit = 1000) {
        const address = Nimiq.Address.fromString(addr);
        const receipts = await this._blockchain.getTransactionReceiptsByAddress(address, limit);
        const result = [];
        for (const r of receipts) {
            result.push(await this._getTransactionByHash(r.transactionHash));
        }
        // const result = await Promise.all(receipts.map((r) => this._getTransactionByHash(r.transactionHash)));
        return result;
    }

    mempoolContent(includeTransactions) {
        return this._mempool.getTransactions().map((tx) => includeTransactions ? this._transactionToObj(tx) : tx.hash().toHex());
    }

    mempool() {
        const transactions = this._mempool.getTransactions();
        const buckets = [10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 2, 1, 0];
        const transactionsPerBucket = { total: transactions.length, buckets: [] };
        let i = 0;
        // Transactions are ordered by feePerByte
        for (const tx of transactions) {
            // Find appropriate bucked
            while (tx.feePerByte < buckets[i]) i++;
            const bucket = buckets[i];
            if (!transactionsPerBucket[bucket]) {
                transactionsPerBucket[bucket] = 0;
                transactionsPerBucket.buckets.push(bucket);
            }
            transactionsPerBucket[bucket]++;
        }
        return transactionsPerBucket;
    }

    minFeePerByte(minFeePerByte) {
        if (typeof minFeePerByte === 'number') {
            this._consensus.subscribeMinFeePerByte(minFeePerByte);
        }
        return this._consensus.minFeePerByte;
    }

    /*
     * Miner
     */

    mining(enabled) {
        if (enabled === true) {
            this._minerConfig.enabled = true;
            if (this._poolConfig.enabled && this._isPoolValid() && this._miner.isDisconnected()) {
                this._miner.connect(this._poolConfig.host, this._poolConfig.port);
            }
            if (!this._miner.working && this._consensus.established) this._miner.startWork();
        } else if (enabled === false) {
            this._minerConfig.enabled = false;
            if (this._miner.working) this._miner.stopWork();
            if (this._miner instanceof Nimiq.BasePoolMiner && !this._miner.isDisconnected()) {
                this._miner.disconnect();
            }
        }
        return this._minerConfig.enabled;
    }

    hashrate() {
        return this._miner.hashrate;
    }

    minerThreads(threads) {
        if (typeof threads === 'number') {
            this._miner.threads = threads;
            this._minerConfig.threads = threads;
        }
        return this._miner.threads;
    }

    minerAddress() {
        return this._miner.address.toUserFriendlyAddress();
    }

    pool(pool) {
        if (pool && !(this._miner instanceof Nimiq.BasePoolMiner)) {
            throw new Error('Client was not started with the pool miner option.');
        }
        if (typeof pool === 'string') {
            let [host, port] = pool.split(':');
            port = parseInt(port);
            if (!this._isPoolValid(host, port)) {
                throw new Error('Pool must be specified as `host:port`');
            }
            this._poolConfig.host = host;
            this._poolConfig.port = port;
            if (!this._miner.isDisconnected()) {
                // disconnect from old pool
                this._miner.disconnect();
            }
            pool = true;
        }

        if (pool === true) {
            if (!this._isPoolValid()) {
                throw new Error('No valid pool specified.');
            }
            this._poolConfig.enabled = true;
            if (this._miner.isDisconnected()) {
                this._miner.connect(this._poolConfig.host, this._poolConfig.port);
            }
        } else if (pool === false) {
            this._poolConfig.enabled = false;
            if (this._miner instanceof Nimiq.BasePoolMiner
                && !this._miner.isDisconnected()) {
                this._miner.disconnect();
            }
        }

        return this._poolConfig.enabled && this._isPoolValid(this._miner.host, this._miner.port)
            ? `${this._miner.host}:${this._miner.port}`
            : null;
    }

    poolConnectionState() {
        return typeof this._miner.connectionState !== 'undefined'
            ? this._miner.connectionState
            : Nimiq.BasePoolMiner.ConnectionState.CLOSED;
    }

    poolConfirmedBalance() {
        return this._miner.confirmedBalance || 0;
    }

    async getWork(addressStr, extraDataHex) {
        let address, extraData;
        try {
            address = Nimiq.Address.fromString(addressStr);
            extraData = Nimiq.BufferUtils.fromHex(extraDataHex);
        } catch (e) {}
        const block = await this._miner.getNextBlock(address, extraData);
        if (!block) {
            const e = new Error('Cannot create work template, check state before requesting work.');
            e.code = 501;
            throw e;
        }
        const shareCompact = this._miner.shareCompact || Nimiq.BlockUtils.targetToCompact(block.target);
        const blockSerialized = block.serialize();
        return {
            data: Nimiq.BufferUtils.toHex(blockSerialized.subarray(0, block.header.serializedSize)),
            suffix: Nimiq.BufferUtils.toHex(blockSerialized.subarray(block.header.serializedSize, blockSerialized.length)),
            target: shareCompact,
            algorithm: "nimiq-argon2"
        }
    }

    async getBlockTemplate(addressStr, extraDataHex) {
        let address, extraData;
        try {
            address = Nimiq.Address.fromString(addressStr);
            extraData = Nimiq.BufferUtils.fromHex(extraDataHex);
        } catch (e) {}
        const block = await this._miner.getNextBlock(address, extraData);
        if (!block) {
            const e = new Error('Cannot create work template, check state before requesting work.');
            e.code = 501;
            throw e;
        }
        const shareCompact = this._miner.shareCompact || Nimiq.BlockUtils.targetToCompact(block.target);
        const merklePath = await Nimiq.MerklePath.compute(block.body.getMerkleLeafs(), block.minerAddr);
        const merkleHashes = merklePath.nodes.map(mpn => mpn.hash.toHex()).slice(1);
        return {
            header: {
                version: block.header.version,
                prevHash: block.header.prevHash.toHex(),
                interlinkHash: block.header.interlinkHash.toHex(),
                accountsHash: block.header.accountsHash.toHex(),
                nBits: block.header.nBits,
                height: block.header.height,
            },
            interlink: Nimiq.BufferUtils.toHex(block.interlink.serialize()),
            target: shareCompact,
            body: {
                hash: block.body.hash().toHex(),
                minerAddr: block.body.minerAddr.toHex(),
                extraData: Nimiq.BufferUtils.toHex(block.body.extraData),
                transactions: block.body.transactions.map(tx => Nimiq.BufferUtils.toHex(tx.serialize())),
                merkleHashes: merkleHashes,
                prunedAccounts: block.body.prunedAccounts.map(acc => Nimiq.BufferUtils.toHex(acc.serialize()))
            }
        }
    }

    /**
     * @param {string} blockHex
     * @returns {Promise}
     */
    async submitBlock(blockHex) {
        /** @type {Block} */
        const block = Nimiq.Block.unserialize(Nimiq.BufferUtils.fromHex(blockHex));
        if (!block.header.bodyHash.equals(block.body.hash())) throw new Error('Submitted invalid block: bodyHash and body.hash() mismatch');
        return this._miner.onWorkerShare({hash: await block.header.pow(), nonce: block.header.nonce, block});
    }

    /*
     * Accounts
     */

    async accounts() {
        return Promise.all((await this._walletStore.list()).map(async (address) => this._accountToObj(await this._accounts.get(address), address)));
    }

    async createAccount() {
        const wallet = Nimiq.Wallet.generate();
        await this._walletStore.put(wallet);
        return this._walletToObj(wallet);
    }

    async getBalance(addrString, atBlock) {
        if (atBlock && atBlock !== 'latest') throw new Error(`Cannot calculate balance at block ${atBlock}`);
        return (await this._accounts.get(Nimiq.Address.fromString(addrString))).balance;
    }

    async getAccount(addr) {
        const address = Nimiq.Address.fromString(addr);
        const account = await this._accounts.get(address);
        return this._accountToObj(account, address);
    }

    /*
     * Blockchain
     */

    blockNumber() {
        return this._blockchain.height;
    }

    async getBlockTransactionCountByHash(blockHash) {
        const block = await this._blockchain.getBlock(Nimiq.Hash.fromString(blockHash), /*includeForks*/ false, /*includeBody*/ true);
        return block ? block.transactionCount : null;
    }

    async getBlockTransactionCountByNumber(number) {
        const block = await this._getBlockByNumber(number);
        return block ? block.transactionCount : null;
    }

    async getBlockByHash(blockHash, includeTransactions) {
        const block = await this._blockchain.getBlock(Nimiq.Hash.fromString(blockHash), /*includeForks*/ false, /*includeBody*/ true);
        return block ? this._blockToObj(block, includeTransactions) : null;
    }

    async getBlockByNumber(number, includeTransactions) {
        const block = await this._getBlockByNumber(number);
        return block ? this._blockToObj(block, includeTransactions) : null;
    }


    /*
     * Utils
     */

    constant(constant, value) {
        if (typeof value !== 'undefined') {
            if (value === 'reset') {
                Nimiq.ConstantHelper.instance.reset(constant);
            } else {
                value = parseInt(value);
                Nimiq.ConstantHelper.instance.set(constant, value);
            }
        }
        return Nimiq.ConstantHelper.instance.get(constant);
    }

    log(tag, level) {
        if (tag && level) {
            if (tag === '*') {
                Nimiq.Log.instance.level = level;
            } else {
                Nimiq.Log.instance.setLoggable(tag, level);
            }
            return true;
        } else {
            throw new Error('Missing argument');
        }
    }

    /**
     * @param {number|string} number
     * @returns {Promise.<?Block>}
     * @private
     */
    _getBlockByNumber(number) {
        if (typeof number === 'string') {
            if (number.startsWith('latest-')) {
                number = this._blockchain.height - parseInt(number.substring(7));
            } else if (number === 'latest') {
                number = this._blockchain.height;
            } else {
                number = parseInt(number);
            }
        }
        if (number === 0) number = 1;
        if (number === 1) return Promise.resolve(Nimiq.GenesisConfig.GENESIS_BLOCK);
        return this._blockchain.getBlockAt(number, /*includeBody*/ true);
    }

    /**
     * @param {string} [host]
     * @param {number} [port]
     * @returns {boolean}
     * @private
     */
    _isPoolValid(host, port) {
        host = typeof host !== 'undefined' ? host : this._poolConfig.host;
        port = typeof port !== 'undefined' ? port : this._poolConfig.port;
        return typeof host === 'string' && host && typeof port === 'number' && !Number.isNaN(port) && port >= 0;
    }

    /**
     * @param {Account} account
     * @param {Address} address
     * @returns {object}
     * @private
     */
    _accountToObj(account, address) {
        if (!account) return null;
        const obj = {
            id: address.toHex(),
            address: address.toUserFriendlyAddress(),
            balance: account.balance,
            type: account.type
        };
        if (account instanceof Nimiq.VestingContract) {
            obj.owner = account.owner.toHex();
            obj.ownerAddress = account.owner.toUserFriendlyAddress();
            obj.vestingStart = account.vestingStart;
            obj.vestingStepBlocks = account.vestingStepBlocks;
            obj.vestingStepAmount = account.vestingStepAmount;
            obj.vestingTotalAmount = account.vestingTotalAmount;
        } else if (account instanceof Nimiq.HashedTimeLockedContract) {
            obj.sender = account.sender.toHex();
            obj.senderAddress = account.sender.toUserFriendlyAddress();
            obj.recipient = account.recipient.toHex();
            obj.recipientAddress = account.recipient.toUserFriendlyAddress();
            obj.hashRoot = account.hashRoot.toHex();
            obj.hashCount = account.hashCount;
            obj.timeout = account.timeout;
            obj.totalAmount = account.totalAmount;
        }
        return obj;
    }

    /**
     * @param {PeerAddressState} peerAddressState
     * @param {PeerConnection} [connection]
     * @private
     */
    _peerAddressStateToPeerObj(peerAddressState, connection) {
        if (!peerAddressState) return null;
        if (!connection) connection = this._network.connections.getConnectionByPeerAddress(peerAddressState.peerAddress);
        const peerAddress = connection && connection.peer && connection.peer.peerAddress ? connection.peer.peerAddress : peerAddressState.peerAddress;
        return {
            id: peerAddress.peerId ? peerAddress.peerId.toHex() : null,
            address: peerAddress.toString(),
            failedAttempts: peerAddressState.failedAttempts,
            addressState: peerAddressState.state,
            connectionState: connection ? connection.state : undefined,
            version: connection && connection.peer ? connection.peer.version : undefined,
            timeOffset: connection && connection.peer ? connection.peer.timeOffset : undefined,
            headHash: connection && connection.peer ? connection.peer.headHash.toHex() : undefined,
            score: connection ? connection.score : undefined,
            latency: connection ? connection.statistics.latencyMedian : undefined,
            rx: connection && connection.networkConnection ? connection.networkConnection.bytesReceived : undefined,
            tx: connection && connection.networkConnection ? connection.networkConnection.bytesSent : undefined
        };
    }

    /**
     * @param {Block} block
     * @param {boolean} [includeTransactions]
     * @private
     */
    async _blockToObj(block, includeTransactions = false) {
        return {
            number: block.height,
            hash: block.hash().toHex(),
            pow: (await block.pow()).toHex(),
            parentHash: block.prevHash.toHex(),
            nonce: block.nonce,
            bodyHash: block.bodyHash.toHex(),
            accountsHash: block.accountsHash.toHex(),
            miner: block.minerAddr.toHex(),
            minerAddress: block.minerAddr.toUserFriendlyAddress(),
            difficulty: block.difficulty,
            extraData: Nimiq.BufferUtils.toHex(block.body.extraData),
            size: block.serializedSize,
            timestamp: block.timestamp,
            transactions: includeTransactions
                ? block.transactions.map((tx, i) => this._transactionToObj(tx, block, i))
                : block.transactions.map((tx) => tx.hash().toHex())
        };
    }

    /**
     * @param {Transaction} tx
     * @param {Block} [block]
     * @param {number} [i]
     * @private
     */
    _transactionToObj(tx, block, i) {
        return {
            hash: tx.hash().toHex(),
            blockHash: block ? block.hash().toHex() : undefined,
            blockNumber: block ? block.height : undefined,
            timestamp: block ? block.timestamp : undefined,
            confirmations: block ? this._blockchain.height - block.height + 1 : 0,
            transactionIndex: i,
            from: tx.sender.toHex(),
            fromAddress: tx.sender.toUserFriendlyAddress(),
            to: tx.recipient.toHex(),
            toAddress: tx.recipient.toUserFriendlyAddress(),
            value: tx.value,
            fee: tx.fee,
            data: Nimiq.BufferUtils.toHex(tx.data) || null,
            flags: tx.flags
        };
    }

    /**
     * @param {Wallet} wallet
     * @param {boolean} [withPrivateKey]
     * @private
     */
    _walletToObj(wallet, withPrivateKey) {
        const a = {
            id: wallet.address.toHex(),
            address: wallet.address.toUserFriendlyAddress(),
            publicKey: wallet.publicKey.toHex()
        };
        if (withPrivateKey) a.privateKey = wallet.keyPair.privateKey.toHex();
        return a;
    }

    /**
     * @param {Address} address
     * @private
     */
    _addressToObj(address) {
        return {
            id: address.toHex(),
            address: address.toUserFriendlyAddress()
        };
    }

    _onRequest(req, res) {
        let body = [];
        req.on('data', (chunk) => {
            body.push(chunk);
        }).on('end', async () => {
            let single = false;
            try {
                body = JSON.parse(Buffer.concat(body).toString());
                single = !(body instanceof Array);
            } catch (e) {
                body = null;
            }
            if (!body) {
                res.writeHead(400);
                res.end(JSON.stringify({
                    'jsonrpc': '2.0',
                    'error': {'code': -32600, 'message': 'Invalid Request'},
                    'id': null
                }));
                return;
            }
            if (single) {
                body = [body];
            }
            res.writeHead(200);
            const result = [];
            for (const msg of body) {
                if (msg.jsonrpc !== '2.0' || !msg.method) {
                    result.push({
                        'jsonrpc': '2.0',
                        'error': {'code': -32600, 'message': 'Invalid Request'},
                        'id': msg.id
                    });
                    continue;
                }
                if (!this._methods.has(msg.method)) {
                    Nimiq.Log.w(JsonRpcServer, 'Unknown method called', msg.method);
                    result.push({
                        'jsonrpc': '2.0',
                        'error': {'code': -32601, 'message': 'Method not found'},
                        'id': msg.id
                    });
                    continue;
                }
                try {
                    const methodRes = await this._methods.get(msg.method).apply(null, msg.params instanceof Array ? msg.params : [msg.params]);
                    if (msg.id) {
                        result.push({'jsonrpc': '2.0', 'result': methodRes, 'id': msg.id});
                    }
                } catch (e) {
                    Nimiq.Log.d(JsonRpcServer, e.stack);
                    result.push({
                        'jsonrpc': '2.0',
                        'error': {'code': e.code || 1, 'message': e.message || e.toString()},
                        'id': msg.id
                    });
                }
            }
            if (single && result.length === 1) {
                res.end(JSON.stringify(result[0]));
            } else if (!single) {
                res.end(JSON.stringify(result));
            }
        });
    }
}

module.exports = exports = JsonRpcServer;
