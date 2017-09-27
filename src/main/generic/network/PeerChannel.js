class PeerChannel extends Observable {
    /**
     * @listens PeerConnection#message
     * @param {PeerConnection} connection
     */
    constructor(connection) {
        super();
        this._conn = connection;
        this._conn.on('message', msg => this._onMessage(msg));

        // Forward specified events on the connection to listeners of this Observable.
        this.bubble(this._conn, 'close', 'error', 'ban');
    }

    /**
     * @param {Uint8Array} rawMsg
     * @private
     */
    _onMessage(rawMsg) {
        let msg;
        try {
            msg = MessageFactory.parse(rawMsg);
        } catch(e) {
            Log.w(PeerChannel, `Failed to parse message from ${this.peerAddress || this.netAddress}: ${e}`);

            // Ban peer if it sends junk.
            // TODO We should probably be more lenient here. Bitcoin sends a
            // reject message if the message can't be decoded.
            // From the Bitcoin Reference:
            //  "Be careful of reject message feedback loops where two peers
            //   each don’t understand each other’s reject messages and so keep
            //   sending them back and forth forever."
            this.ban('junk received');
        }

        if (!msg) return;

        try {
            this.fire(PeerChannel.Event[msg.type], msg, this);
        } catch (e) {
            Log.w(PeerChannel, `Error while processing ${msg.type} message from ${this.peerAddress || this.netAddress}: ${e}`);
        }
    }

    /**
     * @param {Message} msg
     * @return {boolean}
     * @private
     */
    _send(msg) {
        return this._conn.send(msg.serialize());
    }

    /**
     * @param {string} [reason]
     */
    close(reason) {
        this._conn.close(reason);
    }

    /**
     * @param {string} [reason]
     */
    ban(reason) {
        this._conn.ban(reason);
    }

    /**
     * @param {PeerAddress} peerAddress
     * @param {Hash} headHash
     * @return {boolean}
     */
    version(peerAddress, headHash) {
        return this._send(new VersionMessage(Version.CODE, peerAddress, Block.GENESIS.HASH, headHash));
    }

    /**
     * @param {Array.<InvVector>} vectors
     * @return {boolean}
     */
    inv(vectors) {
        return this._send(new InvMessage(vectors));
    }

    /**
     * @param {Array.<InvVector>} vectors
     * @return {boolean}
     */
    notFound(vectors) {
        return this._send(new NotFoundMessage(vectors));
    }

    /**
     * @param {Array.<InvVector>} vectors
     * @return {boolean}
     */
    getData(vectors) {
        return this._send(new GetDataMessage(vectors));
    }

    /**
     * @param {Block} block
     * @return {boolean}
     */
    block(block) {
        return this._send(new BlockMessage(block));
    }

    /**
     * @param {Transaction} transaction
     * @param {?AccountsProof} [accountsProof]
     * @return {boolean}
     */
    tx(transaction, accountsProof) {
        return this._send(new TxMessage(transaction, accountsProof));
    }

    /**
     * @param {Array.<Hash>} locators
     * @return {boolean}
     */
    getBlocks(locators) {
        return this._send(new GetBlocksMessage(locators));
    }

    /**
     * @return {boolean}
     */
    mempool() {
        return this._send(new MempoolMessage());
    }

    /**
     * @param {Message.Type} messageType
     * @param {RejectMessage.Code} code
     * @param {string} reason
     * @param {Uint8Array} extraData
     * @return {boolean}
     */
    reject(messageType, code, reason, extraData) {
        return this._send(new RejectMessage(messageType, code, reason, extraData));
    }

    /**
     * @param {Array.<PeerAddress>} addresses
     * @return {boolean}
     */
    addr(addresses) {
        return this._send(new AddrMessage(addresses));
    }

    /**
     * @param {number} protocolMask
     * @param {number} serviceMask
     * @return {boolean}
     */
    getAddr(protocolMask, serviceMask) {
        return this._send(new GetAddrMessage(protocolMask, serviceMask));
    }

    /**
     * @param {number} nonce
     * @return {boolean}
     */
    ping(nonce) {
        return this._send(new PingMessage(nonce));
    }

    /**
     * @param {number} nonce
     * @return {boolean}
     */
    pong(nonce) {
        return this._send(new PongMessage(nonce));
    }

    /**
     * @param {string} senderId
     * @param {string} recipientId
     * @param {number} nonce
     * @param {number} ttl
     * @param {SignalMessage.Flags|number} flags
     * @param {Uint8Array} [payload]
     * @return {boolean}
     */
    signal(senderId, recipientId, nonce, ttl, flags, payload) {
        return this._send(new SignalMessage(senderId, recipientId, nonce, ttl, flags, payload));
    }

    /**
     * @param {Hash} blockHash
     * @param {Array.<Address>} addresses
     * @return {boolean}
     */
    getAccountsProof(blockHash, addresses) {
        return this._send(new GetAccountsProofMessage(blockHash, addresses));
    }

    /**
     * @param {Hash} blockHash
     * @param {AccountsProof} accountsProof
     * @return {boolean}
     */
    accountsProof(blockHash, accountsProof) {
        return this._send(new AccountsProofMessage(blockHash, accountsProof));
    }

    /**
     * @param {number} k
     * @param {Hash} headHash
     * @return {boolean}
     */
    getHeaders(k, headHash) {
        return this._send(new GetHeadersMessage(k, headHash));
    }

    /**
     * @param {HeaderChain} headerChain
     * @return {boolean}
     */
    headers(headerChain) {
        return this._send(new HeadersMessage(headerChain));
    }

    /**
     * @param {Hash} headHash
     * @param {Array.<Hash>} locators
     * @param {number} m
     * @return {boolean}
     */
    getInterlinkChain(headHash, locators, m) {
        return this._send(new GetInterlinkChainMessage(headHash, locators, m));
    }

    /**
     * @param {InterlinkChain} interlinkChain
     * @return {boolean}
     */
    interlinkChain(interlinkChain) {
        return this._send(new InterlinkChainMessage(interlinkChain));
    }

    /**
     * @param {PeerChannel} o
     * @return {boolean}
     */
    equals(o) {
        return o instanceof PeerChannel
            && this._conn.equals(o.connection);
    }

    hashCode() {
        return this._conn.hashCode();
    }

    /**
     * @return {string}
     */
    toString() {
        return `PeerChannel{conn=${this._conn}}`;
    }

    /** @type {PeerConnection} */
    get connection() {
        return this._conn;
    }

    /** @type {number} */
    get id() {
        return this._conn.id;
    }

    /** @type {number} */
    get protocol() {
        return this._conn.protocol;
    }

    /** @type {PeerAddress} */
    get peerAddress() {
        return this._conn.peerAddress;
    }

    /** @type {PeerAddress} */
    set peerAddress(value) {
        this._conn.peerAddress = value;
    }

    /** @type {NetAddress} */
    get netAddress() {
        return this._conn.netAddress;
    }

    /** @type {NetAddress} */
    set netAddress(value) {
        this._conn.netAddress = value;
    }

    /** @type {boolean} */
    get closed() {
        return this._conn.closed;
    }
}
Class.register(PeerChannel);

PeerChannel.Event = {};
PeerChannel.Event[Message.Type.VERSION] = 'version';
PeerChannel.Event[Message.Type.INV] = 'inv';
PeerChannel.Event[Message.Type.GET_DATA] = 'get-data';
PeerChannel.Event[Message.Type.NOT_FOUND] = 'not-found';
PeerChannel.Event[Message.Type.GET_BLOCKS] = 'get-blocks';
PeerChannel.Event[Message.Type.BLOCK] = 'block';
PeerChannel.Event[Message.Type.TX] = 'tx';
PeerChannel.Event[Message.Type.MEMPOOL] = 'mempool';
PeerChannel.Event[Message.Type.REJECT] = 'reject';
PeerChannel.Event[Message.Type.ADDR] = 'addr';
PeerChannel.Event[Message.Type.GET_ADDR] = 'get-addr';
PeerChannel.Event[Message.Type.PING] = 'ping';
PeerChannel.Event[Message.Type.PONG] = 'pong';
PeerChannel.Event[Message.Type.SIGNAL] = 'signal';
PeerChannel.Event[Message.Type.GET_HEADERS] = 'get-headers';
PeerChannel.Event[Message.Type.HEADERS] = 'headers';
PeerChannel.Event[Message.Type.GET_INTERLINK_CHAIN] = 'get-interlink-chain';
PeerChannel.Event[Message.Type.INTERLINK_CHAIN] = 'interlink-chain';
PeerChannel.Event[Message.Type.GET_ACCOUNTS_PROOF] = 'get-accounts-proof';
PeerChannel.Event[Message.Type.ACCOUNTS_PROOF] = 'accounts-proof';
