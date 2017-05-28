class PeerChannel extends Observable {
    constructor(connection) {
        super();
        this._conn = connection;
        this._conn.on('message', msg => this._onMessage(msg));

        // Forward specified events on the connection to listeners of this Observable.
        this.bubble(this._conn, 'close', 'error', 'ban');
    }

    _onMessage(rawMsg) {
        let msg;
        try {
            msg = MessageFactory.parse(rawMsg);
        } catch(e) {
            // TODO Drop client if it keeps sending junk.
            // TODO Bitcoin sends a reject message if the message can't be decoded.
            // From the Bitcoin Reference:
            //  "Be careful of reject message feedback loops where two peers
            //   each don’t understand each other’s reject messages and so keep
            //   sending them back and forth forever."
            console.log('Failed to parse message: ' + rawMsg, e);
            this.ban('junk received');
        }

        if (!msg) return;

        try {
            this.fire(msg.type, msg, this);
        } catch (e) {
            console.log('Error while processing message: ' + msg, e);
        }
    }

    _send(msg) {
        this._conn.send(msg.serialize());
    }

    close(reason) {
        this._conn.close(reason);
    }

    ban(reason) {
        this._conn.ban(reason);
    }

    version(peerAddress, startHeight) {
        this._send(new VersionMessage(1, peerAddress, startHeight));
    }

    verack() {
        this._send(new VerAckMessage());
    }

    inv(vectors) {
        this._send(new InvMessage(vectors));
    }

    notfound(vectors) {
        this._send(new NotFoundMessage(vectors));
    }

    getdata(vectors) {
        this._send(new GetDataMessage(vectors));
    }

    block(block) {
        this._send(new BlockMessage(block));
    }

    tx(transaction) {
        this._send(new TxMessage(transaction));
    }

    getblocks(hashes, hashStop = new Hash()) {
        this._send(new GetBlocksMessage(hashes, hashStop));
    }

    mempool() {
        this._send(new MempoolMessage());
    }

    reject(messageType, code, reason, extraData) {
        this._send(new RejectMessage(messageType, code, reason, extraData));
    }

    addr(addresses) {
        this._send(new AddrMessage(addresses));
    }

    getaddr(serviceMask) {
        this._send(new GetAddrMessage(serviceMask));
    }

    ping(nonce) {
        this._send(new PingMessage(nonce));
    }

    pong(nonce) {
        this._send(new PongMessage(nonce));
    }

    signal(senderId, recipientId, payload) {
        this._send(new SignalMessage(senderId, recipientId, payload));
    }

    equals(o) {
        return o instanceof PeerChannel
            && this._conn.equals(o.connection);
    }

    hashCode() {
        return this.toString();
    }

    toString() {
        return 'PeerChannel{conn=' + this._conn + '}';
    }

    get connection() {
        return this._conn;
    }

    get peerAddress() {
        return this._conn.peerAddress;
    }

    get netAddress() {
        return this._conn.netAddress;
    }
}
Class.register(PeerChannel);
