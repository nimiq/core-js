const http = require('http');
const Nimiq = require('../../dist/node.js');

class JsonRpcServer {
    constructor(rpcPort = 8648) {
        http.createServer((req, res) => {
            if (req.method === 'GET') {
                res.writeHead(200);
                res.end('Nimiq JSON-RPC Server\n');
            } else if (req.method === 'POST') {
                this._onRequest(req, res);
            } else {
                res.writeHead(500);
                res.end();
            }
        }).listen(rpcPort, '127.0.0.1');

        /** @type {Map.<string, function(*)>} */
        this._methods = new Map();
    }

    /**
     * @param {FullChain} blockchain
     * @param {Accounts} accounts
     * @param {Mempool} mempool
     * @param {Network} network
     * @param {Miner} miner
     * @param {WalletStore} walletStore
     */
    init(blockchain, accounts, mempool, network, miner, walletStore) {
        // Network
        this._methods.set('peerCount', () => {
            return network.peerCount;
        });

        // Transactions
        this._methods.set('sendRawTransaction', async (txhex) => {
            const tx = Nimiq.Transaction.unserialize(BufferUtils.fromHex(txhex));
            const ret = await mempool.pushTransaction(tx);
            if (ret < 0) {
                const e = new Error(`Transaction not accepted: ${ret}`);
                e.code = ret;
                throw e;
            }
            return tx.hash().toHex();
        });
        this._methods.set('sendTransaction', async (tx) => {
            const from = Nimiq.Address.fromString(tx.from);
            const fromType = tx.fromType ? Number.parseInt(tx.fromType) : Nimiq.Account.Type.BASIC;
            const to = Nimiq.Address.fromString(tx.to);
            const toType = tx.toType ? Number.parseInt(tx.toType) : Nimiq.Account.Type.BASIC;
            const value = parseInt(tx.value);
            const fee = parseInt(tx.fee);
            const data = tx.data ? Nimiq.BufferUtils.fromHex(tx.data) : null;
            /** @type {Wallet} */
            const wallet = await walletStore.get(from);
            if (!wallet || !(wallet instanceof Nimiq.Wallet)) {
                throw new Error(`"${tx.from}" can not sign transactions using this node.`);
            }
            let transaction;
            if (fromType !== Nimiq.Account.Type.BASIC) {
                throw new Error('Only basic transactions may be sent using "sendTransaction".');
            } else if (toType !== Nimiq.Account.Type.BASIC || data !== null) {
                transaction = new Nimiq.ExtendedTransaction(from, fromType, to, toType, value, fee, blockchain.height, Nimiq.Transaction.Flag.NONE, data);
                transaction.proof = Nimiq.SignatureProof.singleSig(wallet.publicKey, Nimiq.Signature.create(wallet.keyPair.privateKey, wallet.publicKey, transaction.serializeContent())).serialize();
            } else {
                transaction = wallet.createTransaction(to, value, fee, blockchain.height);
            }
            const ret = await mempool.pushTransaction(transaction);
            if (ret < 0) {
                const e = new Error(`Transaction not accepted: ${ret}`);
                e.code = ret;
                throw e;
            }
            return transaction.hash().toHex();
        });
        this._methods.set('getTransactionByBlockHashAndIndex', async (blockHash, txIndex) => {
            const block = await blockchain.getBlock(Nimiq.Hash.fromString(blockHash));
            if (block && block.transactions.length > txIndex) {
                return JsonRpcServer._transactionToObj(block.transactions[txIndex], block, txIndex);
            }
            return null;
        });
        this._methods.set('getTransactionByBlockNumberAndIndex', async (number, txIndex) => {
            const block = await blockchain.getBlockAt(number);
            if (block && block.transactions.length > txIndex) {
                return JsonRpcServer._transactionToObj(block.transactions[txIndex], block, txIndex);
            }
            return null;
        });
        this._methods.set('getTransactionByHash', async (hash) => {
            const entry = await blockchain.getTransactionInfoByHash(Nimiq.Hash.fromString(hash));
            if (entry) {
                const block = await blockchain.getBlock(entry.blockHash);
                return JsonRpcServer._transactionToObj(block.transactions[entry.index], block, entry.index);
            }
            const mempoolTx = mempool.getTransaction(Nimiq.Hash.fromString(hash));
            if (mempoolTx) {
                return JsonRpcServer._transactionToObj(mempoolTx);
            }
            return null;
        });
        this._methods.set('getTransactionReceipt', async (hash) => {
            const entry = await blockchain.getTransactionInfoByHash(Nimiq.Hash.fromString(hash));
            if (!entry) return null;
            const block = await blockchain.getBlock(entry.blockHash);
            return {
                transactionHash: entry.transactionHash.toHex(),
                transactionIndex: entry.index,
                blockNumber: entry.blockHeight,
                blockHash: entry.blockHash.toHex(),
                timestamp: block ? block.timestamp : undefined
            };
        });
        this._methods.set('mempool', (includeTransactions) => {
            return mempool.getTransactions().map((tx) => includeTransactions ? JsonRpcServer._transactionToObj(tx) : tx.hash().toHex());
        });

        // Miner
        this._methods.set('mining', () => {
            if (!miner) throw new Error('This node does not include a miner');
            return miner.working;
        });
        this._methods.set('hashrate', () => {
            if (!miner) throw new Error('This node does not include a miner');
            return miner.hashrate;
        });

        // Accounts
        this._methods.set('accounts', async () => {
            return (await walletStore.list()).map(JsonRpcServer._addressToObj);
        });
        this._methods.set('createAccount', async () => {
            const wallet = await Nimiq.Wallet.generate();
            await walletStore.put(wallet);
            return JsonRpcServer._walletToObj(wallet);
        });
        this._methods.set('getBalance', async (addrString, atBlock) => {
            if (atBlock && atBlock !== 'latest') throw new Error(`Cannot calculate balance at block ${atBlock}`);
            return (await accounts.get(Nimiq.Address.fromString(addrString))).balance;
        });

        // Blockchain
        this._methods.set('blockNumber', () => {
            return blockchain.height;
        });
        this._methods.set('getBlockTransactionCountByHash', async (blockHash) => {
            const block = await blockchain.getBlock(Nimiq.Hash.fromString(blockHash));
            return block ? block.transactionCount : null;
        });
        this._methods.set('getBlockTransactionCountByNumber', async (number) => {
            const block = await blockchain.getBlockAt(number);
            return block ? block.transactionCount : null;
        });
        this._methods.set('getBlockByHash', async (blockHash, includeTransactions) => {
            const block = await blockchain.getBlock(Nimiq.Hash.fromString(blockHash));
            return block ? JsonRpcServer._blockToObj(block, includeTransactions) : null;
        });
        this._methods.set('getBlockByNumber', async (number, includeTransactions) => {
            const block = await blockchain.getBlockAt(number);
            return block ? JsonRpcServer._blockToObj(block, includeTransactions) : null;
        });
    }

    /**
     * @param {Block} block
     * @param {boolean} [includeTransactions]
     * @private
     */
    static async _blockToObj(block, includeTransactions = false) {
        return {
            number: block.height,
            hash: block.hash().toHex(),
            pow: (await block.pow()).toHex(),
            parentHash: block.prevHash.toHex(),
            nonce: block.nonce,
            bodyHash: block.bodyHash.toHex(),
            accountsHash: block.accountsHash.toHex(),
            miner: block.minerAddr.toHex(),
            minerString: block.minerAddr.toUserFriendlyAddress(),
            difficulty: block.difficulty,
            extraData: Nimiq.BufferUtils.toHex(block.body.extraData),
            size: block.serializedSize,
            timestamp: block.timestamp,
            transactions: includeTransactions
                ? block.transactions.map((tx, i) => JsonRpcServer._transactionToObj(tx, block, i))
                : block.transactions.map((tx) => tx.hash().toHex())
        };
    }

    /**
     * @param {Transaction} tx
     * @param {Block} [block]
     * @param {number} [i]
     * @private
     */
    static _transactionToObj(tx, block, i) {
        return {
            hash: tx.hash().toHex(),
            blockHash: block ? block.hash().toHex() : undefined,
            blockNumber: block ? block.height : undefined,
            transactionIndex: i,
            from: tx.sender.toHex(),
            fromString: tx.sender.toUserFriendlyAddress(),
            to: tx.recipient.toHex(),
            toString: tx.recipient.toUserFriendlyAddress(),
            value: tx.value,
            fee: tx.fee,
            data: Nimiq.BufferUtils.toHex(tx.data) || null
        };
    }

    /**
     * @param {Wallet} wallet
     * @param {boolean} [withPrivateKey]
     * @private
     */
    static _walletToObj(wallet, withPrivateKey) {
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
    static _addressToObj(address) {
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
