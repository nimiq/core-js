const Nimiq = require('../../dist/node.js');
const AuthenticatedConnection = require('./AuthenticatedConnection.js');
const AuthenticatingWebSocketServer = require('./AuthenticatingWebSocketServer.js');

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

    constructor($, port, sslKeyFile, sslCertFile, authSecretFile) {
        this.$ = $;
        const webSocketServer = new AuthenticatingWebSocketServer(port, sslKeyFile, sslCertFile, authSecretFile);
        webSocketServer.on(AuthenticatingWebSocketServer.EVENTS.NEW_CONNECTION, connection => this._onConnection(connection));
        console.log('Remote API listening on port', port);

        // listeners:
        this._listeners = {};
        this._observedAccounts = new Set();
        $.accounts.on('populated', () => this._broadcast(RemoteAPI.MESSAGE_TYPES.ACCOUNTS_POPULATED));
        $.blockchain.on('head-changed', head => this._broadcast(RemoteAPI.MESSAGE_TYPES.BLOCKCHAIN_HEAD_CHANGED, this._serializeToBase64(head)));
        $.blockchain.on('ready', () => this._broadcast(RemoteAPI.MESSAGE_TYPES.BLOCKCHAIN_READY));
        $.network.on('peers-changed', () => this._broadcast(RemoteAPI.MESSAGE_TYPES.NETWORK_PEERS_CHANGED, this._getNetworkState()));
        $.network.on('peer-joined', () => this._broadcast(RemoteAPI.MESSAGE_TYPES.NETWORK_PEER_JOINED));
        $.network.on('peer-left', () => this._broadcast(RemoteAPI.MESSAGE_TYPES.NETWORK_PEER_LEFT));
        $.mempool.on('transactions-ready', () => this._broadcast(RemoteAPI.MESSAGE_TYPES.MEMPOOL_TRANSACTIONS_READY));
        $.mempool.on('transaction-added', transaction => this._broadcast(RemoteAPI.MESSAGE_TYPES.MEMPOOL_TRANSACTION_ADDED, this._serializeToBase64(transaction)));
        $.miner.on('start', () => this._broadcast(RemoteAPI.MESSAGE_TYPES.MINER_STARTED));
        $.miner.on('stop', () => this._broadcast(RemoteAPI.MESSAGE_TYPES.MINER_STOPPED));
        $.miner.on('hashrate-changed', hashrate => this._broadcast(RemoteAPI.MESSAGE_TYPES.MINER_HASHRATE_CHANGED, hashrate));
        $.miner.on('block-mined', block => this._broadcast(RemoteAPI.MESSAGE_TYPES.MINER_BLOCK_MINED, this._serializeToBase64(block)));
        $.consensus.on('established', () => this._broadcast(RemoteAPI.MESSAGE_TYPES.CONSENSUS_ESTABLISHED));
        $.consensus.on('lost', () => this._broadcast(RemoteAPI.MESSAGE_TYPES.CONSENSUS_LOST));
        $.consensus.on('syncing', targetHeight => this._broadcast(RemoteAPI.MESSAGE_TYPES.CONSENSUS_SYNCING, targetHeight));
    }

    _onConnection(connection) {
        // handle websocket connection

        connection.on('message', message => this._onMessage(connection, message));
        connection.on('close', () => this._unregisterListeners(connection));

        console.log('Remote API established connection.');
    }

    _onMessage(connection, message) {
        if (message.command === RemoteAPI.COMMANDS.REGISTER_LISTENER) {
            this._registerListener(connection, message);
        } else if (message.command === RemoteAPI.COMMANDS.UNREGISTER_LISTENER) {
            this._unregisterListener(connection, message);
        } else if (message.command === RemoteAPI.COMMANDS.GET_SNAPSHOT) {
            this._getSnapShot().then(snapshot => connection.send(RemoteAPI.MESSAGE_TYPES.SNAPSHOT, snapshot));
        } else if (message.command === RemoteAPI.COMMANDS.GET_STATE) {
            this._sendState(connection, message.type);
        } else if (message.command === RemoteAPI.COMMANDS.ACCOUNTS_GET_BALANCE) {
            this._sendAccountsBalance(connection, message.address);
        } else if (message.command === RemoteAPI.COMMANDS.ACCOUNTS_GET_HASH) {
            this._sendAccountsHash(connection);
        } else if (message.command === RemoteAPI.COMMANDS.BLOCKCHAIN_GET_BLOCK) {
            this._sendBlock(connection, message.hash);
        } else if (message.command === RemoteAPI.COMMANDS.BLOCKCHAIN_GET_NEXT_COMPACT_TARGET) {
            this._sendNextCompactTarget(connection);
        } else if (message.command === RemoteAPI.COMMANDS.MEMPOOL_GET_TRANSACTIONS) {
            this._sendMempoolTransactions(connection);
        } else {
            connection.sendError('Unsupported command.', message.command);
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

    _registerListener(connection, message) {
        let type = message.type;
        if (type === RemoteAPI.MESSAGE_TYPES.ACCOUNTS_ACCOUNT_CHANGED) {
            const address = this._parseAddress(message.address);
            if (!address) {
                connection.sendError('Type ' + RemoteAPI.MESSAGE_TYPES.ACCOUNTS_ACCOUNT_CHANGED
                    + ' requires a valid address in hex format', RemoteAPI.COMMANDS.REGISTER_LISTENER);
                return;
            }
            type = type + '-' + message.address.toLowerCase();
            this._setupAccountChangeListener(address);
        }
        if (!this._isValidListenerType(type)) {
            connection.sendError(type + ' is not a valid type.', RemoteAPI.COMMANDS.REGISTER_LISTENER);
            return;
        }
        if (!this._listeners[type]) {
            this._listeners[type] = new Set();
        }
        this._listeners[type].add(connection);
        connection.send(RemoteAPI.MESSAGE_TYPES.INFO, 'Listener for type '+type+' registered.');
    }

    _unregisterListener(connection, message) {
        let type = message.type;
        if (type === RemoteAPI.MESSAGE_TYPES.ACCOUNTS_ACCOUNT_CHANGED) {
            const address = this._parseAddress(message.address);
            if (!address) {
                connection.sendError('Type ' + RemoteAPI.MESSAGE_TYPES.ACCOUNTS_ACCOUNT_CHANGED
                    + ' requires a valid address in hex format', RemoteAPI.COMMANDS.UNREGISTER_LISTENER);
                return;
            }
            type = type + '-' + message.address.toLowerCase();
        }
        if (type in this._listeners) {
            this._listeners[type].delete(connection);
        }
        connection.send(RemoteAPI.MESSAGE_TYPES.INFO, 'Listener for type '+type+' unregistered.');
    }

    _unregisterListeners(connection) {
        for (const type in this._listeners) {
            this._unregisterListener(connection, type);
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
        for (let connection of this._listeners[type]) {
            if (connection.connected) {
                connection.send(message);
            }
        }
    }

    _serializeToBase64(serializable) {
        return Nimiq.BufferUtils.toBase64(serializable.serialize());
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
                account: this._serializeToBase64(account)
            });
        });
    }

    _sendAccountsBalance(connection, addressString) {
        const address = this._parseAddress(addressString);
        if (!address) {
            connection.sendError('A valid address in hex format required.', RemoteAPI.COMMANDS.ACCOUNTS_GET_BALANCE);
            return;
        }
        this.$.accounts.getBalance(address)
            .then(balance => connection.send(RemoteAPI.MESSAGE_TYPES.ACCOUNTS_BALANCE, {
                address: addressString,
                balance: this._serializeToBase64(balance)
            }))
            .catch(e => connection.sendError('Failed to get balance for '+addressString+' - '+e, RemoteAPI.COMMANDS.ACCOUNTS_GET_BALANCE));
    }

    _sendAccountsHash(connection) {
        this.$.accounts.hash()
            .then(hash => connection.send(RemoteAPI.MESSAGE_TYPES.ACCOUNTS_HASH, hash.toBase64()))
            .catch(e => connection.sendError('Failed to get accounts hash.', RemoteAPI.COMMANDS.ACCOUNTS_GET_HASH));
    }

    _sendBlock(connection, hashString) {
        let hash;
        try {
            hash = Nimiq.Hash.fromBase64(hashString);
        } catch(e) {
            connection.sendError('A valid block hash in Base64 format required.', RemoteAPI.COMMANDS.BLOCKCHAIN_GET_BLOCK);
            return;
        }
        this.$.blockchain.getBlock(hash)
            .then(block => connection.send(RemoteAPI.MESSAGE_TYPES.BLOCKCHAIN_BLOCK, {
                block: this._serializeToBase64(block),
                hash: hashString
            }))
            .catch(e => connection.sendError('Failed to get block '+hashString+' - '+e, RemoteAPI.COMMANDS.BLOCKCHAIN_GET_BLOCK));
    }

    _sendNextCompactTarget(connection) {
        this.$.blockchain.getNextCompactTarget()
            .then(nextCompactTarget => connection.send(RemoteAPI.MESSAGE_TYPES.BLOCKCHAIN_NEXT_COMPACT_TARGET, nextCompactTarget))
            .catch(e => connection.sendError('Failed to get next compact target.', RemoteAPI.COMMANDS.BLOCKCHAIN_GET_NEXT_COMPACT_TARGET));
    }

    _sendMempoolTransactions(connection) {
        connection.send(RemoteAPI.MESSAGE_TYPES.MEMPOOL_TRANSACTIONS, this.$.mempool.getTransactions().map(this._serializeToBase64));
    }

    _sendState(connection, type) {
        if (type === RemoteAPI.MESSAGE_TYPES.ACCOUNTS_STATE) {
            this._getAccountsState().then(accountsState => connection.send(type, accountsState));
        } else if (type === RemoteAPI.MESSAGE_TYPES.CONSENSUS_STATE) {
            connection.send(type, this._getConsensusState());
        } else if (type === RemoteAPI.MESSAGE_TYPES.BLOCKCHAIN_STATE) {
            connection.send(type, this._getBlockchainState());
        } else if (type === RemoteAPI.MESSAGE_TYPES.NETWORK_STATE) {
            connection.send(type, this._getNetworkState());
        } else if (type === RemoteAPI.MESSAGE_TYPES.MEMPOOL_STATE) {
            connection.send(type, this._getMempoolState());
        } else if (type === RemoteAPI.MESSAGE_TYPES.MINER_STATE) {
            connection.send(type, this._getMinerState());
        } else if (type === RemoteAPI.MESSAGE_TYPES.WALLET_STATE) {
            connection.send(type, this._getWalletState());
        } else {
            connection.sendError(type + ' is not a valid type.', RemoteAPI.COMMANDS.GET_STATE);
        }
    }

    _getSnapShot() {
        return this._getAccountsState().then(accountsState => {
            return {
                accounts: accountsState,
                blockchain: this._getBlockchainState(),
                consensus: this._getConsensusState(),
                mempool: this._getMempoolState(),
                miner: this._getMinerState(),
                network: this._getNetworkState(),
                wallet: this._getWalletState()
            };
        });
    }

    _getAccountsState() {
        return this.$.accounts.hash().then(hash => {
            return {
                hash: hash.toBase64()
            };
        });
    }

    _getConsensusState() {
        return {
            established: this.$.consensus.established
        };
    }

    _getBlockchainState() {
        return {
            busy: this.$.blockchain.busy,
            checkpointLoaded: this.$.blockchain.checkpointLoaded,
            height: this.$.blockchain.height,
            head: this._serializeToBase64(this.$.blockchain.head),
            headHash: this.$.blockchain.headHash.toBase64(),
            totalWork: this.$.blockchain.totalWork
        };
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

    _getMempoolState() {
        return {
            transactions: this.$.mempool.getTransactions().map(this._serializeToBase64)
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