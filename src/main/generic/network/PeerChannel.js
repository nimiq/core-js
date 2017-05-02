class PeerChannel extends Observable {

    constructor(connection) {
        super();
        this._conn = connection;

        // Forward specified events on the connection to listeners of this Observable.
        this.bubble(this._conn, 'close', 'error');
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

    close() {
        this._conn.close();
    }

    version(startHeight) {
        this._send(new VersionMessage(1, Services.myServices(), Date.now(), startHeight));
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

    get connection() {
        return this._conn;
    }

    toString() {
        return 'PeerChannel{conn=' + this._conn + '}';
    }
}
Class.register(PeerChannel);
