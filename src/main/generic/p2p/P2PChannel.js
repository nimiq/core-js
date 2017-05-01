class P2PChannel extends Observable {

    constructor(channel, peerId) {
        super();
        this._channel = channel;
        this._peerId = peerId;

        if (this._channel.onmessage !== undefined) {
            this._channel.onmessage = rawMsg => this._onMessage(rawMsg.data || rawMsg);
        }
        if (this._channel.onclose !== undefined) {
            this._channel.onclose = _ => this.fire('peer-left', this._peerId);
        }
        if (this._channel.onerror !== undefined) {
            this._channel.onerror = e => this.fire('peer-error', this._peerId, e);
        }
    }

    _onMessage(rawMsg) {
        // XXX Keep track of bytes received.
        P2PChannel.bytesReceived += rawMsg.byteLength;

        let msg;
        try {
            msg = P2PMessageFactory.parse(rawMsg);
        } catch(e) {
            // TODO Drop client if it keeps sending junk.
            // TODO Bitcoin sends a reject message if the message can't be decoded.
            // From the Bitcoin Reference:
            //  "Be careful of reject message feedback loops where two peers
            //   each don’t understand each other’s reject messages and so keep
            //   sending them back and forth forever."
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
        try {
            this._channel.send(msg.serialize());
        } catch (e) {
            console.error('Failed to send data to peer ' + this._peerId, e);
            return;
        }

        // XXX Keep track of bytes sent.
        P2PChannel.bytesSent += msg.serializedSize;
    }

    close() {
        if (!this._channel.close) throw 'Underlying channel is not closeable';
        console.log('Closing channel to peer ' + this.peerId);
        this._channel.close();
    }

    version(startHeight) {
        this._send(new VersionP2PMessage(1, 0, Date.now(), startHeight));
    }

    verack() {
        this._send(new VerAckP2PMessage());
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

    reject(messageType, code, reason, extraData) {
        this._send(new RejectP2PMessage(messageType, code, reason, extraData));
    }

    get rawChannel() {
        return this._channel;
    }

    get peerId() {
        return this._peerId;
    }

    toString() {
        return 'Peer{id=' + this._peerId + '}';
    }
}

// XXX Global bytes sent/received tracking for testing
P2PChannel.bytesReceived = 0;
P2PChannel.bytesSent = 0;

Class.register(P2PChannel);