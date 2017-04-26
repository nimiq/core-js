class P2PChannel extends Observable {

    constructor(channel, peerId) {
        super();
        this._channel = channel;
        this._peerId = peerId;

        if (this._channel.onmessage !== undefined) {
            this._channel.onmessage = rawMsg => this._onMessage(rawMsg.data || rawMsg);
        }
        if (this._channel.onclose !== undefined) {
            this._channel.onclose = _ => this.fire('peer-left');
        }
        if (this._channel.onerror !== undefined) {
            this._channel.onerror = e => this.fire('peer-error', e);
        }
    }

    _onMessage(rawMsg) {
        let msg;
        try {
            msg = P2PMessageFactory.parse(rawMsg);
        } catch(e) {
            console.log('Failed to parse message: ' + rawMsg, e);
        }

        if (!msg) return;

        try {
            this.fire(msg.type, msg, this);
        } catch (e) {
            console.log('Error while processing message: ' + msg, e);
        }
    }

    _send(msg) {
        this._channel.send(msg.serialize());
    }

    version(startHeight) {
        this._send(new VersionP2PMessage(1, 0, Date.now(), startHeight));
    }

    inv(vectors) {
        this._send(new InvP2PMessage(vectors.length, vectors));
    }

    notfound(vectors) {
        this._send(new NotFoundP2PMessage(vectors.length, vectors));
    }

    getdata(vectors) {
        this._send(new GetDataP2PMessage(vectors.length, vectors));
    }

    block(block) {
        this._send(new BlockP2PMessage(block));
    }

    tx(transaction) {
        this._send(new TxP2PMessage(transaction));
    }

    getblocks(hashes, hashStop = new Hash()) {
        this._send(new GetBlocksP2PMessage(hashes.length, hashes, hashStop));
    }

    mempool() {
        this._send(new MempoolP2PMessage());
    }

    get rawChannel() {
        return this._channel;
    }

    get peerId() {
        return this._peerId;
    }
}
