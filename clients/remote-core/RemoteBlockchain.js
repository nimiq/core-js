class RemoteBlockchain extends RemoteClass {
    static get IDENTIFIER() { return 'blockchain'; }
    static get ATTRIBUTES() { return ['busy', 'checkpointLoaded', 'head', 'headHash', 'height', 'totalWork']; }
    static get EVENTS() {
        return {
            HEAD_CHANGED: 'head-changed',
            READY: 'ready'
        };
    }
    static get COMMANDS() {
        return {
            BLOCKCHAIN_GET_BLOCK: 'get-block',
            BLOCKCHAIN_GET_NEXT_COMPACT_TARGET: 'blockchain-get-next-compact-target'
        };
    }
    static get MESSAGE_TYPES() {
        return {
            BLOCKCHAIN_HEAD_CHANGED: 'blockchain-head-changed',
            BLOCKCHAIN_READY: 'blockchain-ready',
            BLOCKCHAIN_BLOCK: 'blockchain-block',
            BLOCKCHAIN_NEXT_COMPACT_TARGET: 'blockchain-next-compact-target'
        };
    }
    static get EVENT_MAP() {
        let map = {};
        map[RemoteBlockchain.MESSAGE_TYPES.BLOCKCHAIN_HEAD_CHANGED] = RemoteBlockchain.EVENTS.HEAD_CHANGED;
        map[RemoteBlockchain.MESSAGE_TYPES.BLOCKCHAIN_READY] = RemoteBlockchain.EVENTS.READY;
        return map;
    }

    /**
     * Construct a remote blockchain connected over a remote connection.
     * @param remoteConnection - a remote connection to the server
     * @param accounts - $.accounts, to compute accountsHash
     * @param live - if true, the blockchain auto updates and requests an event listener itself
     */
    constructor(remoteConnection, accounts, live) {
        super(RemoteBlockchain.IDENTIFIER, RemoteBlockchain.ATTRIBUTES, RemoteBlockchain.EVENT_MAP, remoteConnection);
        this.on(RemoteBlockchain.EVENTS.HEAD_CHANGED, head => {
            this.head = head;
            this.headHash = head.hash;
            this.height += 1;
            this.totalWork += head.difficulty;
            if (this.height % 20 === 0) {
                // every couple blocks request a full update as the blockchain might have forked
                this._updateState();
            }
        }, !live);
        this._accounts = accounts;
    }


    async accountsHash() {
        return this._accounts.hash();
    }


    async getNextCompactTarget() {
        return this._remoteConnection.request({
            command: RemoteBlockchain.COMMANDS.BLOCKCHAIN_GET_NEXT_COMPACT_TARGET
        }, RemoteBlockchain.MESSAGE_TYPES.BLOCKCHAIN_NEXT_COMPACT_TARGET);
    }


    async getBlock(hashString) {
        return this._remoteConnection.request({
            command: RemoteBlockchain.COMMANDS.BLOCKCHAIN_GET_BLOCK,
            hash: hashString
        }, message => message.type === RemoteBlockchain.MESSAGE_TYPES.BLOCKCHAIN_BLOCK && message.data.hash === hashString);
    }
}