const AuthenticatedConnection = require('./AuthenticatedConnection.js');
const AuthenticatingWebSocketServer = require('./AuthenticatingWebSocketServer.js');
const RemoteAccountsAPI = require('./RemoteAccountsAPI.js');
const RemoteBlockchainAPI = require('./RemoteBlockchainAPI.js');
const RemoteConsensusAPI = require('./RemoteConsensusAPI.js');
const RemoteMempoolAPI = require('./RemoteMempoolAPI.js');
const RemoteMinerAPI = require('./RemoteMinerAPI.js');
const RemoteNetworkAPI = require('./RemoteNetworkAPI.js');
const RemoteWalletAPI = require('./RemoteWalletAPI.js');

class RemoteAPI {
    /**
     * Create a new RemoteAPI.
     * @param {Nimiq.Core} $ - a Nimiq Core instance.
     * @param {number} port - the port over which the remote API should be reachable
     * @param {string} sslKeyFile - path to the ssl key file
     * @param {string} sslCertificate - path to the ssl certificate file
     * @param {string} authSecretFile - path to a file containing the secret password for authentication
     */
    constructor($, port, sslKeyFile, sslCertFile, authSecretFile) {
        this._accountsAPI = new RemoteAccountsAPI($);
        this._blockchainAPI = new RemoteBlockchainAPI($);
        this._consensusAPI = new RemoteConsensusAPI($);
        this._mempoolAPI = new RemoteMempoolAPI($);
        this._minerAPI = new RemoteMinerAPI($);
        this._networkAPI = new RemoteNetworkAPI($);
        this._walletAPI = new RemoteWalletAPI($);
        const webSocketServer = new AuthenticatingWebSocketServer(port, sslKeyFile, sslCertFile, authSecretFile);
        webSocketServer.on(AuthenticatingWebSocketServer.Events.NEW_CONNECTION, connection => this._onConnection(connection));
        console.log('Remote API listening on port', port);
    }

    _onConnection(connection) {
        // handle websocket connection
        connection.on('message', message => this._onMessage(connection, message));
        connection.on('close', () => this._unregisterListeners(connection));
        console.log('Remote API established connection.');
    }

    _onMessage(connection, message) {
        if (message.command === RemoteAPI.Commands.REGISTER_LISTENER) {
            this._registerListener(connection, message);
        } else if (message.command === RemoteAPI.Commands.UNREGISTER_LISTENER) {
            this._unregisterListener(connection, message);
        } else if (message.command === RemoteAPI.Commands.GET_SNAPSHOT) {
            this._getSnapShot().then(snapshot => connection.send(RemoteAPI.MessageTypes.SNAPSHOT, snapshot));
        } else if (message.command === RemoteAPI.Commands.GET_STATE) {
            this._sendState(connection, message.type);
        } else {
            this._accountsAPI.handleMessage(connection, message)
            || this._blockchainAPI.handleMessage(connection, message)
            || this._consensusAPI.handleMessage(connection, message)
            || this._mempoolAPI.handleMessage(connection, message)
            || this._minerAPI.handleMessage(connection, message)
            || this._networkAPI.handleMessage(connection, message)
            || this._walletAPI.handleMessage(connection, message)
            || connection.sendError('Unsupported command.', message.command);
        }
    }

    _registerListener(connection, message) {
        this._accountsAPI.registerListener(connection, message)
        || this._blockchainAPI.registerListener(connection, message)
        || this._consensusAPI.registerListener(connection, message)
        || this._mempoolAPI.registerListener(connection, message)
        || this._minerAPI.registerListener(connection, message)
        || this._networkAPI.registerListener(connection, message)
        || this._walletAPI.registerListener(connection, message)
        || connection.sendError(message.type + ' is not a valid type.', RemoteAPI.Commands.REGISTER_LISTENER);
    }

    _unregisterListener(connection, message) {
        this._accountsAPI.unregisterListener(connection, message)
        || this._blockchainAPI.unregisterListener(connection, message)
        || this._consensusAPI.unregisterListener(connection, message)
        || this._mempoolAPI.unregisterListener(connection, message)
        || this._minerAPI.unregisterListener(connection, message)
        || this._networkAPI.unregisterListener(connection, message)
        || this._walletAPI.unregisterListener(connection, message)
        || connection.sendError(message.type + ' is not a valid type.', RemoteAPI.Commands.UNREGISTER_LISTENER);
    }

    _unregisterListeners(connection) {
        this._accountsAPI.unregisterListeners(connection);
        this._blockchainAPI.unregisterListeners(connection);
        this._consensusAPI.unregisterListeners(connection);
        this._mempoolAPI.unregisterListeners(connection);
        this._minerAPI.unregisterListeners(connection);
        this._networkAPI.unregisterListeners(connection);
        this._walletAPI.unregisterListeners(connection);
    }

    _sendState(connection, type) {
        if (type === RemoteAccountsAPI.MessageTypes.ACCOUNTS_STATE) {
            this._accountsAPI.getState().then(accountsState => connection.send(type, accountsState));
        } else if (type === RemoteBlockchainAPI.MessageTypes.BLOCKCHAIN_STATE) {
            connection.send(type, this._blockchainAPI.getState());
        } else if (type === RemoteConsensusAPI.MessageTypes.CONSENSUS_STATE) {
            connection.send(type, this._consensusAPI.getState());
        } else if (type === RemoteMempoolAPI.MessageTypes.MEMPOOL_STATE) {
            connection.send(type, this._mempoolAPI.getState());
        } else if (type === RemoteMinerAPI.MessageTypes.MINER_STATE) {
            connection.send(type, this._minerAPI.getState());
        } else if (type === RemoteNetworkAPI.MessageTypes.NETWORK_STATE) {
            connection.send(type, this._networkAPI.getState());
        } else if (type === RemoteWalletAPI.MessageTypes.WALLET_STATE) {
            connection.send(type, this._walletAPI.getState());
        } else {
            connection.sendError(type + ' is not a valid type.', RemoteAPI.Commands.GET_STATE);
        }
    }

    _getSnapShot() {
        return this._accountsAPI.getState().then(accountsState => {
            return {
                accounts: accountsState,
                blockchain: this._blockchainAPI.getState(),
                consensus: this._consensusAPI.getState(),
                mempool: this._mempoolAPI.getState(),
                miner: this._minerAPI.getState(),
                network: this._networkAPI.getState(),
                wallet: this._walletAPI.getState()
            };
        });
    }
}
RemoteAPI.Commands = {
    GET_SNAPSHOT: 'get-snapshot',
    GET_STATE: 'get-state',
    REGISTER_LISTENER: 'register-listener',
    UNREGISTER_LISTENER: 'unregister-listener'
};
RemoteAPI.MessageTypes = {
    SNAPSHOT: 'snapshot',
    ERROR: 'error'
};

module.exports = RemoteAPI;