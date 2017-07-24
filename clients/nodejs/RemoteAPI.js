const Nimiq = require('../../dist/node.js');
const WebSocket = require('ws'); // https://github.com/websockets/ws
const https = require('https');
const fs = require('fs');

class RemoteAPI {
    static get COMMANDS () {
        return {
            GET_SNAPSHOT: 'get-snapshot',
            GET_STATE: 'get-state',
            REGISTER_LISTENER: 'register-listener',
            UNREGISTER_LISTENER: 'unregister-listener',
            ACCOUNTS_GET_BALANCE: 'accounts-get-balance',
            ACCOUNTS_GET_HASH: 'accounts-get-hash',
            BLOCKCHAIN_GET_BLOCK: 'get-block',
            BLOCKCHAIN_GET_NEXT_COMPACT_TARGET: 'blockchain-get-next-compact-target',
            MEMPOOL_GET_TRANSACTIONS: 'mempool-get-transactions'
        };
    }
    static get MESSAGE_TYPES() {
        return {
            SNAPSHOT: 'snapshot',
            ACCOUNTS_STATE: 'accounts',
            ACCOUNTS_ACCOUNT_CHANGED: 'accounts-account-changed',
            ACCOUNTS_POPULATED: 'accounts-populated',
            ACCOUNTS_BALANCE: 'accounts-balance',
            ACCOUNTS_HASH: 'accounts-hash',
            CONSENSUS_STATE: 'consensus',
            CONSENSUS_ESTABLISHED: 'consensus-established',
            CONSENSUS_LOST: 'consensus-lost',
            CONSENSUS_SYNCING: 'consensus-syncing',
            BLOCKCHAIN_STATE: 'blockchain',
            BLOCKCHAIN_HEAD_CHANGED: 'blockchain-head-changed',
            BLOCKCHAIN_READY: 'blockchain-ready',
            BLOCKCHAIN_BLOCK: 'blockchain-block',
            BLOCKCHAIN_NEXT_COMPACT_TARGET: 'blockchain-next-compact-target',
            NETWORK_STATE: 'network',
            NETWORK_PEERS_CHANGED: 'network-peers-changed',
            NETWORK_PEER_JOINED: 'network-peer-joined',
            NETWORK_PEER_LEFT: 'network-peer-left',
            MEMPOOL_STATE: 'mempool',
            MEMPOOL_TRANSACTION_ADDED: 'mempool-transaction-added',
            MEMPOOL_TRANSACTIONS_READY: 'mempool-transactions-ready',
            MEMPOOL_TRANSACTIONS: 'mempool-transactions',
            MINER_STATE: 'miner',
            MINER_STARTED: 'miner-started',
            MINER_STOPPED: 'miner-stopped',
            MINER_HASHRATE_CHANGED: 'miner-hashrate-changed',
            MINER_BLOCK_MINED: 'miner-block-mined',
            WALLET_STATE: 'wallet',
            ERROR: 'error',
            INFO: 'info'
        };
    }

    constructor($, port, sslKey, sslCert) {
        this.$ = $;
        const sslOptions = {
            key: fs.readFileSync(sslKey),
            cert: fs.readFileSync(sslCert)
        };
        const httpsServer = https.createServer(sslOptions, (req, res) => {
            res.writeHead(200);
            res.end('Nimiq NodeJS Remote API\n');
        }).listen(port);
        // websocket server
        this._wss = new WebSocket.Server({server: httpsServer});
        this._wss.on('connection', (ws, message) => this._onConnection(ws, message)); // TODO authentication
        console.log('Remote API listening on port', port);

        // listeners:
        this._listeners = {};
        this._observedAccounts = new Set();
        $.accounts.on('populated', () => this._broadcast(RemoteAPI.MESSAGE_TYPES.ACCOUNTS_POPULATED));
        $.blockchain.on('head-changed', async head => this._broadcast(RemoteAPI.MESSAGE_TYPES.BLOCKCHAIN_HEAD_CHANGED, await this._getBlockInfo(head)));
        $.blockchain.on('ready', () => this._broadcast(RemoteAPI.MESSAGE_TYPES.BLOCKCHAIN_READY));
        $.network.on('peers-changed', () => this._broadcast(RemoteAPI.MESSAGE_TYPES.NETWORK_PEERS_CHANGED, this._getNetworkState()));
        $.network.on('peer-joined', () => this._broadcast(RemoteAPI.MESSAGE_TYPES.NETWORK_PEER_JOINED));
        $.network.on('peer-left', () => this._broadcast(RemoteAPI.MESSAGE_TYPES.NETWORK_PEER_LEFT));
        $.mempool.on('transactions-ready', () => this._broadcast(RemoteAPI.MESSAGE_TYPES.MEMPOOL_TRANSACTIONS_READY));
        $.mempool.on('transaction-added', transaction => this._broadcast(RemoteAPI.MESSAGE_TYPES.MEMPOOL_TRANSACTION_ADDED, this._getTransactionInfo(transaction)));
        $.miner.on('start', () => this._broadcast(RemoteAPI.MESSAGE_TYPES.MINER_STARTED));
        $.miner.on('stop', () => this._broadcast(RemoteAPI.MESSAGE_TYPES.MINER_STOPPED));
        $.miner.on('hashrate-changed', hashrate => this._broadcast(RemoteAPI.MESSAGE_TYPES.MINER_HASHRATE_CHANGED, hashrate));
        $.miner.on('block-mined', block => this._broadcast(RemoteAPI.MESSAGE_TYPES.MINER_BLOCK_MINED, this._getBlockInfo(block)));
        $.consensus.on('established', () => this._broadcast(RemoteAPI.MESSAGE_TYPES.CONSENSUS_ESTABLISHED));
        $.consensus.on('lost', () => this._broadcast(RemoteAPI.MESSAGE_TYPES.CONSENSUS_LOST));
        $.consensus.on('syncing', targetHeight => this._broadcast(RemoteAPI.MESSAGE_TYPES.CONSENSUS_SYNCING, targetHeight));
    }

    _onConnection(ws) {
        // handle websocket connection
        this._getSnapShot().then(snapshot => this._send(ws, RemoteAPI.MESSAGE_TYPES.SNAPSHOT, snapshot));

        ws.on('message', message => this._onMessage(ws, message));
        ws.on('close', () => this._unregisterListeners(ws));

        console.log('Remote API established connection.');
    }

    _onMessage(ws, message) {
        try {
            message = JSON.parse(message);
        } catch(e) {
            this._sendError(ws, message, 'Couldn\'t parse command');
            return;
        }
        if (message.command === RemoteAPI.COMMANDS.REGISTER_LISTENER) {
            this._registerListener(ws, message);
        } else if (message.command === RemoteAPI.COMMANDS.UNREGISTER_LISTENER) {
            this._unregisterListener(ws, message);
        } else if (message.command === RemoteAPI.COMMANDS.GET_SNAPSHOT) {
            this._getSnapShot().then(snapshot => this._send(ws, RemoteAPI.MESSAGE_TYPES.SNAPSHOT, snapshot));
        } else if (message.command === RemoteAPI.COMMANDS.GET_STATE) {
            this._sendState(ws, message.type);
        } else if (message.command === RemoteAPI.COMMANDS.ACCOUNTS_GET_BALANCE) {
            this._sendAccountsBalance(ws, message.address);
        } else if (message.command === RemoteAPI.COMMANDS.ACCOUNTS_GET_HASH) {
            this._sendAccountsHash(ws);
        } else if (message.command === RemoteAPI.COMMANDS.BLOCKCHAIN_GET_BLOCK) {
            this._sendBlock(ws, message.hash);
        } else if (message.command === RemoteAPI.COMMANDS.BLOCKCHAIN_GET_NEXT_COMPACT_TARGET) {
            this._sendNextCompactTarget(ws);
        } else if (message.command === RemoteAPI.COMMANDS.MEMPOOL_GET_TRANSACTIONS) {
            this._sendMempoolTransactions(ws);
        } else {
            this._sendError(ws, message.command, 'Unsupported command.');
        }
    }

    _isValidListenerType(type) {
        const VALID_LISTENER_TYPES = [RemoteAPI.MESSAGE_TYPES.ACCOUNTS_POPULATED, RemoteAPI.MESSAGE_TYPES.CONSENSUS_ESTABLISHED,
            RemoteAPI.MESSAGE_TYPES.CONSENSUS_LOST, RemoteAPI.MESSAGE_TYPES.CONSENSUS_SYNCING, RemoteAPI.MESSAGE_TYPES.BLOCKCHAIN_HEAD_CHANGED,
            RemoteAPI.MESSAGE_TYPES.BLOCKCHAIN_READY, RemoteAPI.MESSAGE_TYPES.NETWORK_PEERS_CHANGED, RemoteAPI.MESSAGE_TYPES.NETWORK_PEER_JOINED,
            RemoteAPI.MESSAGE_TYPES.NETWORK_PEER_LEFT, RemoteAPI.MESSAGE_TYPES.MEMPOOL_TRANSACTION_ADDED, RemoteAPI.MESSAGE_TYPES.MEMPOOL_TRANSACTIONS_READY,
            RemoteAPI.MESSAGE_TYPES.MINER_STARTED, RemoteAPI.MESSAGE_TYPES.MINER_STOPPED, RemoteAPI.MESSAGE_TYPES.MINER_HASHRATE_CHANGED,
            RemoteAPI.MESSAGE_TYPES.MINER_BLOCK_MINED];
        return type && (VALID_LISTENER_TYPES.indexOf(type) !== -1 || type.startsWith(RemoteAPI.MESSAGE_TYPES.ACCOUNTS_ACCOUNT_CHANGED));
    }

    _registerListener(ws, message) {
        let type = message.type;
        if (type === RemoteAPI.MESSAGE_TYPES.ACCOUNTS_ACCOUNT_CHANGED) {
            const address = this._parseAddress(message.address);
            if (!address) {
                this._sendError(ws, RemoteAPI.COMMANDS.REGISTER_LISTENER, 'Type ' + RemoteAPI.MESSAGE_TYPES.ACCOUNTS_ACCOUNT_CHANGED
                    + ' requires a valid address in hex format');
                return;
            }
            type = type + '-' + message.address.toLowerCase();
            this._setupAccountChangeListener(address);
        }
        if (!this._isValidListenerType(type)) {
            this._sendError(ws, RemoteAPI.COMMANDS.REGISTER_LISTENER, type + ' is not a valid type.');
            return;
        }
        if (!this._listeners[type]) {
            this._listeners[type] = new Set();
        }
        this._listeners[type].add(ws);
        this._send(ws, RemoteAPI.MESSAGE_TYPES.INFO, 'Listener for type '+type+' registered.');
    }

    _unregisterListener(ws, message) {
        let type = message.type;
        if (type === RemoteAPI.MESSAGE_TYPES.ACCOUNTS_ACCOUNT_CHANGED) {
            const address = this._parseAddress(message.address);
            if (!address) {
                this._sendError(ws, RemoteAPI.COMMANDS.UNREGISTER_LISTENER, 'Type ' + RemoteAPI.MESSAGE_TYPES.ACCOUNTS_ACCOUNT_CHANGED
                    + ' requires a valid address in hex format');
                return;
            }
            type = type + '-' + message.address.toLowerCase();
        }
        if (type in this._listeners) {
            this._listeners[type].delete(ws);
        }
        this._send(ws, RemoteAPI.MESSAGE_TYPES.INFO, 'Listener for type '+type+' unregistered.');
    }

    _unregisterListeners(ws) {
        for (const type in this._listeners) {
            this._unregisterListener(ws, type);
        }
    }

    _send(ws, type, data) {
        if (ws.readyState === WebSocket.OPEN) {
            // if the connection is (still) open, send the message
            let message = {
                type: type
            };
            if (data !== undefined) {
                message.data = data;
            }
            ws.send(JSON.stringify(message));
        }
    }

    _broadcast(type, data) {
        if (!this._listeners[type]) return;
        let message = {
            type: type
        };
        if (data !== undefined) {
            message.data = data;
        }
        message = JSON.stringify(message);
        for (let ws of this._listeners[type]) {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(message);
            }
        }
    }

    _sendError(ws, command, errorMessage) {
        errorMessage = 'Error' + (command? ' executing '+command : '') + ': ' +errorMessage;
        this._send(ws, RemoteAPI.MESSAGE_TYPES.ERROR, errorMessage);
    }

    _parseAddress(addressString) {
        try {
            return Nimiq.Address.fromHex(addressString);
        } catch(e) {
            return false;
        }
    }

    _setupAccountChangeListener(address) {
        const addressString = address.toHex().toLowerCase();
        if (this._observedAccounts.has(addressString)) {
            // already set up, nothing to do
            return;
        }
        this._observedAccounts.add(addressString);
        const messageType = RemoteAPI.MESSAGE_TYPES.ACCOUNTS_ACCOUNT_CHANGED + '-' + addressString;
        this.$.accounts.on(address, account => {
            this._broadcast(messageType, {
                address: addressString,
                value: account.balance.value,
                nonce: account.balance.nonce
            });
        });
    }

    _sendAccountsBalance(ws, addressString) {
        const address = this._parseAddress(addressString);
        if (!address) {
            this._sendError(ws, RemoteAPI.COMMANDS.ACCOUNTS_GET_BALANCE, 'A valid address in hex format required.');
            return;
        }
        this.$.accounts.getBalance(address)
            .then(balance => this._send(ws, RemoteAPI.MESSAGE_TYPES.ACCOUNTS_BALANCE, {
                address: addressString,
                value: balance.value,
                nonce: balance.nonce
            }))
            .catch(e => this._sendError(ws, RemoteAPI.COMMANDS.ACCOUNTS_GET_BALANCE, 'Failed to get balance for '+addressString));
    }

    _sendAccountsHash(ws) {
        this.$.accounts.hash()
            .then(hash => this._send(ws, RemoteAPI.MESSAGE_TYPES.ACCOUNTS_HASH, hash.toBase64()))
            .catch(e => this._sendError(ws, RemoteAPI.COMMANDS.ACCOUNTS_GET_HASH, 'Failed to get accounts hash.'));
    }

    _sendBlock(ws, hashString) {
        let hash;
        try {
            hash = Nimiq.Hash.fromBase64(hashString);
        } catch(e) {
            this._sendError(ws, RemoteAPI.COMMANDS.BLOCKCHAIN_GET_BLOCK, 'A valid block hash in Base64 format required.');
            return;
        }
        console.log('\n\n\nHash:', hash.toBase64(), hashString, hash.toBase64() === hashString);
        this.$.blockchain.getBlock(hash)
            .then(block => this._getBlockInfo(block))
            .then(blockInfo => this._send(ws, RemoteAPI.MESSAGE_TYPES.BLOCKCHAIN_BLOCK, blockInfo))
            .catch(e => this._sendError(ws, RemoteAPI.COMMANDS.BLOCKCHAIN_GET_BLOCK, 'Failed to get block '+hashString+' - '+e));
    }

    _sendNextCompactTarget(ws) {
        this.$.blockchain.getNextCompactTarget()
            .then(nextCompactTarget => this._send(ws, RemoteAPI.MESSAGE_TYPES.BLOCKCHAIN_NEXT_COMPACT_TARGET, nextCompactTarget))
            .catch(e => this._sendError(ws, RemoteAPI.COMMANDS.BLOCKCHAIN_GET_NEXT_COMPACT_TARGET, 'Failed to get next compact target.'));
    }

    _sendMempoolTransactions(ws) {
        this._send(ws, RemoteAPI.MESSAGE_TYPES.MEMPOOL_TRANSACTIONS, this.$.mempool.getTransactions().map(this._getTransactionInfo));
    }

    _sendState(ws, type) {
        if (type === RemoteAPI.MESSAGE_TYPES.ACCOUNTS_STATE) {
            this._getAccountsState().then(accountsState => this._send(ws, type, accountsState));
        } else if (type === RemoteAPI.MESSAGE_TYPES.CONSENSUS_STATE) {
            this._send(ws, type, this._getConsensusState());
        } else if (type === RemoteAPI.MESSAGE_TYPES.BLOCKCHAIN_STATE) {
            this._getBlockchainState().then(blockchainState => this._send(ws, type, blockchainState));
        } else if (type === RemoteAPI.MESSAGE_TYPES.NETWORK_STATE) {
            this._send(ws, type, this._getNetworkState());
        } else if (type === RemoteAPI.MESSAGE_TYPES.MEMPOOL_STATE) {
            this._send(ws, type, this._getMempoolState());
        } else if (type === RemoteAPI.MESSAGE_TYPES.MINER_STATE) {
            this._send(ws, type, this._getMinerState());
        } else if (type === RemoteAPI.MESSAGE_TYPES.WALLET_STATE) {
            this._send(ws, type, this._getWalletState());
        } else {
            this._sendError(ws, RemoteAPI.COMMANDS.GET_STATE, type + ' is not a valid type.');
        }
    }

    async _getSnapShot() {
        return await Promise.all([
            this._getAccountsState(),
            this._getBlockchainState()
        ]).then(promiseResults => {
            let [accountsState, blockchainState] = promiseResults;
            return {
                accounts: accountsState,
                blockchain: blockchainState,
                consensus: this._getConsensusState(),
                mempool: this._getMempoolState(),
                miner: this._getMinerState(),
                network: this._getNetworkState(),
                wallet: this._getWalletState()
            };
        });
    }

    async _getAccountsState() {
        return {
            hash: (await this.$.accounts.hash()).toBase64()
        };
    }

    _getConsensusState() {
        return {
            established: this.$.consensus.established
        };
    }

    async _getBlockInfo(block) {
        return Promise.all([
            block.header.hash(),
            block.body.hash()
        ]).then(promiseResults => {
            let [blockHash, bodyHash] = promiseResults;
            blockHash = blockHash.toBase64();
            bodyHash = bodyHash.toBase64();
            let prevHash = block.header.prevHash.toBase64();
            let minerAddr = block.minerAddr.toHex();
            return {
                header: {
                    difficulty: block.header.difficulty,
                    height: block.header.height,
                    nBits: block.header.nBits,
                    nonce: block.header.nonce,
                    prevHash: prevHash,
                    serializedSize: block.header.serializedSize,
                    target: block.header.target,
                    timestamp: block.header.timestamp,
                    hash: blockHash
                },
                body: {
                    hash: bodyHash,
                    minerAddr: minerAddr,
                    serializedSize: block.body.serializedSize,
                    transactionCount: block.body.transactionCount,
                    transactions: block.body.transactions.map(this._getTransactionInfo)
                },
                accountsHash: block.accountsHash.toBase64(),
                hash: blockHash,
                bodyHash: bodyHash,
                difficulty: block.difficulty,
                height: block.height,
                minerAddr: minerAddr,
                nBits: block.nBits,
                nonce: block.nonce,
                prevHash: prevHash,
                serializedSize: block.serializedSize,
                target: block.target,
                timestamp: block.timestamp,
                transactionCount: block.transactionCount,
                transactions: block.transactions.map(this._getTransactionInfo)
            };
        });
    }

    async _getBlockchainState() {
        return Promise.all([
            this.$.blockchain.getNextCompactTarget(),
            this._getBlockInfo(this.$.blockchain.head)
        ]).then(promiseResults => {
            const [nextCompactTarget, headInfo] = promiseResults;
            return {
                busy: this.$.blockchain.busy,
                checkpointLoaded: this.$.blockchain.checkpointLoaded,
                nextCompactTarget: nextCompactTarget,
                height: this.$.blockchain.height,
                head: headInfo,
                headHash: this.$.blockchain.headHash,
                totalWork: this.$.blockchain.totalWork
            };
        });
    }

    _getNetworkState() {
        return {
            bytesReceived: this.$.network.bytesReceived,
            bytesSent: this.$.network.bytesSent,
            peerCount: this.$.network.peerCount,
            peerCountDumb: this.$.network.peerCountDumb,
            peerCountWebRtc: this.$.network.peerCountWebRtc,
            peerCountWebSocket: this.$.network.peerCountWebSocket
        };
    }

    async _getTransactionInfo(transaction) {
        return {
            fee: transaction.fee,
            nonce: transaction.nonce,
            recipientAddr: transaction.recipientAddr.toHex(),
            senderPubKey: transaction.senderPubKey.toBase64(),
            serializedContentSize: transaction.serializedContentSize,
            serializedSize: transaction.serializedSize,
            signature: transaction.signature.toBase64(),
            value: transaction.value
        };
    }

    _getMempoolState() {
        return {
            transactions: this.$.mempool.getTransactions().map(this._getTransactionInfo)
        };
    }

    _getMinerState() {
        return {
            address: this.$.miner.address.toHex(),
            hashrate: this.$.miner.hashrate,
            working: this.$.miner.working
        };
    }

    _getWalletState() {
        return {
            address: this.$.wallet.address.toHex(),
            publicKey: this.$.wallet.publicKey.toBase64()
        };
    }
}

module.exports = RemoteAPI;