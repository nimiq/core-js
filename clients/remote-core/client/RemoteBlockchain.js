class RemoteBlockchain extends RemoteClass {
    /**
     * Construct a remote blockchain connected over a remote connection.
     * @param remoteConnection - a remote connection to the server
     * @param accounts - $.accounts, to compute accountsHash
     * @param live - if true, the blockchain auto updates and requests an event listener itself
     */
    constructor(remoteConnection, accounts, live) {
        super(RemoteBlockchain.IDENTIFIER, RemoteBlockchain.ATTRIBUTES, RemoteBlockchain.Events, remoteConnection);
        this.on(RemoteBlockchain.Events.HEAD_CHANGED, head => {
            this.head = head;
            head.hash().then(hash => this.headHash = hash);
            this.totalWork += head.difficulty;
            if (this.height % 20 === 0 || head.height!==this.height+1) {
                // every couple blocks request a full update as the blockchain might have forked
                this._updateState();
            }
            this.height = head.height;
        }, !live);
        this._accounts = accounts;
    }


    /**
     * @async
     * @overwrite
     */
    _updateState() {
        return super._updateState().then(state => {
            this.head = Nimiq.Block.unserialize(Nimiq.BufferUtils.fromBase64(state.head));
            this.headHash = Nimiq.Hash.fromBase64(state.headHash);
            return state;
        });
    }


    /** @async */
    accountsHash() {
        return this._accounts.hash();
    }


    /** @async */
    getNextCompactTarget() {
        return this._remoteConnection.request({
            command: RemoteBlockchain.Commands.BLOCKCHAIN_GET_NEXT_COMPACT_TARGET
        }, RemoteBlockchain.MessageTypes.BLOCKCHAIN_NEXT_COMPACT_TARGET);
    }


    /** @async */
    getBlock(hash) {
        const hashString = hash.toBase64();
        return this._remoteConnection.request({
            command: RemoteBlockchain.Commands.BLOCKCHAIN_GET_BLOCK,
            hash: hashString
        }, message => message.type === RemoteBlockchain.MessageTypes.BLOCKCHAIN_BLOCK && message.data.hash === hashString)
        .then(data => Nimiq.Block.unserialize(Nimiq.BufferUtils.fromBase64(data.block)));
    }

    /**
     * @overwrite
     */
    _handleEvents(message) {
        if (message.type === RemoteBlockchain.MessageTypes.BLOCKCHAIN_HEAD_CHANGED) {
            const head = Nimiq.Block.unserialize(Nimiq.BufferUtils.fromBase64(message.data));
            this.fire(RemoteBlockchain.Events.HEAD_CHANGED, head);
        } else {
            super._handleEvents(message);
        }
    }
}
RemoteBlockchain.IDENTIFIER = 'blockchain';
RemoteBlockchain.ATTRIBUTES = ['busy', 'checkpointLoaded', 'head', 'headHash', 'height', 'totalWork'];
RemoteBlockchain.Events = {
    HEAD_CHANGED: 'head-changed',
    READY: 'ready'
};
RemoteBlockchain.Commands = {
    BLOCKCHAIN_GET_BLOCK: 'get-block',
    BLOCKCHAIN_GET_NEXT_COMPACT_TARGET: 'blockchain-get-next-compact-target'
};
RemoteBlockchain.MessageTypes = {
    BLOCKCHAIN_HEAD_CHANGED: 'blockchain-head-changed',
    BLOCKCHAIN_READY: 'blockchain-ready',
    BLOCKCHAIN_BLOCK: 'blockchain-block',
    BLOCKCHAIN_NEXT_COMPACT_TARGET: 'blockchain-next-compact-target'
};

Class.register(RemoteBlockchain);