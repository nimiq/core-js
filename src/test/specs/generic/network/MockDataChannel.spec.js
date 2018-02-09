class MockDataChannel extends DataChannel {
    constructor() {
        super();
        this._readyState = DataChannel.ReadyState.CONNECTING;
    }
    
    get readyState() {
        return this._readyState;
    }

    _link(channel) {
        this.sendChunk = (msg) => channel._onMessage(msg);
        this.close = () => channel.fire('close');
        this._readyState = DataChannel.ReadyState.OPEN;
    }

    /**
     * @return {{first:DataChannel, second:DataChannel}}
     */
    static pair() {
        const first = new MockDataChannel(), second = new MockDataChannel();

        first._link(second);
        second._link(first);

        return {first, second};
    }
}
Class.register(MockDataChannel);
