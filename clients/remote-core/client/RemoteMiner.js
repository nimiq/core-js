class RemoteMiner extends RemoteClass {
    static get IDENTIFIER() { return 'miner'; }
    static get ATTRIBUTES() { return ['address', 'hashrate', 'working']; }
    static get EVENTS() {
        return {
            STARTED: 'start',
            STOPPED: 'stop',
            HASHRATE_CHANGED: 'hashrate-changed',
            BLOCK_MINED: 'block-mined'
        };
    }
    static get MESSAGE_TYPES() {
        return {
            MINER_STARTED: 'miner-started',
            MINER_STOPPED: 'miner-stopped',
            MINER_HASHRATE_CHANGED: 'miner-hashrate-changed',
            MINER_BLOCK_MINED: 'miner-block-mined'
        };
    }
    static get EVENT_MAP() {
        let map = {};
        map[RemoteMiner.MESSAGE_TYPES.MINER_STARTED] = RemoteMiner.EVENTS.STARTED;
        map[RemoteMiner.MESSAGE_TYPES.MINER_STOPPED] = RemoteMiner.EVENTS.STOPPED;
        map[RemoteMiner.MESSAGE_TYPES.MINER_HASHRATE_CHANGED] = RemoteMiner.EVENTS.HASHRATE_CHANGED;
        map[RemoteMiner.MESSAGE_TYPES.MINER_BLOCK_MINED] = RemoteMiner.EVENTS.BLOCK_MINED;
        return map;
    }

    /**
     * Construct a remote miner connected over a remote connection.
     * @param remoteConnection - a remote connection to the server
     * @param live - if true, the miner auto updates and requests an event listener itself
     */
    constructor(remoteConnection, live) {
        super(RemoteMiner.IDENTIFIER, RemoteMiner.ATTRIBUTES, RemoteMiner.EVENT_MAP, remoteConnection);
        this.on(RemoteMiner.EVENTS.HASHRATE_CHANGED, hashrate => this.hashrate = hashrate, !live);
    }


    /**
     * @overwrites
     */
    async _updateState() {
        return super._updateState().then(state => {
            this.address = Nimiq.Address.fromHex(state.address);
            return state;
        });
    }


    /**
     * @overwrites
     */
    _handleEvents(message) {
        if (message.type === RemoteMiner.MESSAGE_TYPES.BLOCK_MINED) {
            const block = Nimiq.Block.unserialize(Nimiq.BufferUtils.fromBase64(message.data));
            this.fire(RemoteMiner.EVENTS.BLOCK_MINED, block);
        } else {
            super._handleEvents(message);
        }
    }
}
Class.register(RemoteMiner);