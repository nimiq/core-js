const Nimiq = require('../../../dist/node.js');
const RemoteApiComponent = require('./RemoteApiComponent.js');

class RemoteBlockchainAPI extends RemoteApiComponent {
    /**
     * Create a new blockchain API.
     * @param {Nimiq.Core} $ - a nimiq instance
     */
    constructor($) {
        super($);
        $.blockchain.on('head-changed', head => this._broadcast(RemoteBlockchainAPI.MessageTypes.BLOCKCHAIN_HEAD_CHANGED, this._serializeToBase64(head)));
        $.blockchain.on('ready', () => this._broadcast(RemoteBlockchainAPI.MessageTypes.BLOCKCHAIN_READY));
    }

    /** @overwrite */
    getState() {
        return {
            busy: this.$.blockchain.busy,
            checkpointLoaded: this.$.blockchain.checkpointLoaded,
            height: this.$.blockchain.height,
            head: this._serializeToBase64(this.$.blockchain.head),
            headHash: this.$.blockchain.headHash.toBase64(),
            totalWork: this.$.blockchain.totalWork
        };
    }

    /** @overwrite */
    handleMessage(connection, message) {
        if (message.command === RemoteBlockchainAPI.Commands.BLOCKCHAIN_GET_BLOCK) {
            this._sendBlock(connection, message.hash);
            return true;
        } else if (message.command === RemoteBlockchainAPI.Commands.BLOCKCHAIN_GET_NEXT_COMPACT_TARGET) {
            this._sendNextCompactTarget(connection);
            return true;
        } else {
            return false;
        }
    }

    /** @overwrite */
    _isValidListenerType(type) {
        return type===RemoteBlockchainAPI.MessageTypes.BLOCKCHAIN_HEAD_CHANGED || type===RemoteBlockchainAPI.MessageTypes.BLOCKCHAIN_READY;
    }

    /**
     * @private
     * Send the block with the given hash.
     * @param {AuthenticatedConnection} connection - The requesting connection.
     * @param {string} hashString - The hash of the desired block in base 64.
     */
    _sendBlock(connection, hashString) {
        let hash;
        try {
            hash = Nimiq.Hash.fromBase64(hashString);
        } catch(e) {
            connection.sendError('A valid block hash in Base64 format required.', RemoteBlockchainAPI.Commands.BLOCKCHAIN_GET_BLOCK);
            return;
        }
        this.$.blockchain.getBlock(hash)
            .then(block => connection.send(RemoteBlockchainAPI.MessageTypes.BLOCKCHAIN_BLOCK, {
                block: this._serializeToBase64(block),
                hash: hashString
            }))
            .catch(e => connection.sendError('Failed to get block '+hashString+' - '+e, RemoteBlockchainAPI.Commands.BLOCKCHAIN_GET_BLOCK));
    }

    /**
     * @private
     * Send the next compact target of the blockchain.
     * @param {AuthenticatedConnection} connection - The requesting connection.
     */
    _sendNextCompactTarget(connection) {
        this.$.blockchain.getNextCompactTarget()
            .then(nextCompactTarget => connection.send(RemoteBlockchainAPI.MessageTypes.BLOCKCHAIN_NEXT_COMPACT_TARGET, nextCompactTarget))
            .catch(e => connection.sendError('Failed to get next compact target.', RemoteBlockchainAPI.Commands.BLOCKCHAIN_GET_NEXT_COMPACT_TARGET));
    }
}
/** @enum */
RemoteBlockchainAPI.Commands = {
    BLOCKCHAIN_GET_BLOCK: 'get-block',
    BLOCKCHAIN_GET_NEXT_COMPACT_TARGET: 'blockchain-get-next-compact-target'
};
/** @enum */
RemoteBlockchainAPI.MessageTypes = {
    BLOCKCHAIN_STATE: 'blockchain',
    BLOCKCHAIN_HEAD_CHANGED: 'blockchain-head-changed',
    BLOCKCHAIN_READY: 'blockchain-ready',
    BLOCKCHAIN_BLOCK: 'blockchain-block',
    BLOCKCHAIN_NEXT_COMPACT_TARGET: 'blockchain-next-compact-target'
};

module.exports = RemoteBlockchainAPI;