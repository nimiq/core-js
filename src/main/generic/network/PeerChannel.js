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
            Log.w(PeerChannel, `Failed to parse message from ${this.peerAddress || this.netAddress}`, e.message);

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
     * @param {Array.<InvVector>} vectors
     * @return {boolean}
     */
    getHeader(vectors) {
        return this._send(new GetHeaderMessage(vectors));
    }

    /**
     * @param {Block} block
     * @return {boolean}
     */
    block(block) {
        return this._send(new BlockMessage(block));
    }

    /**
     * @param {BlockHeader} header
     * @return {boolean}
     */
    header(header) {
        return this._send(new HeaderMessage(header));
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
     * @param {number} maxInvSize
     * @param {boolean} [ascending]
     * @return {boolean}
     */
    getBlocks(locators, maxInvSize=BaseInventoryMessage.VECTORS_MAX_COUNT, ascending=true) {
        return this._send(new GetBlocksMessage(locators, maxInvSize, ascending ? GetBlocksMessage.Direction.FORWARD : GetBlocksMessage.Direction.BACKWARD));
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
     * @param {Subscription} subscription
     * @returns {boolean}
     */
    subscribe(subscription) {
        return this._send(new SubscribeMessage(subscription));
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
     * @param {SignalId} senderId
     * @param {SignalId} recipientId
     * @param {number} nonce
     * @param {number} ttl
     * @param {SignalMessage.Flags|number} flags
     * @param {Uint8Array} [payload]
     * @param {PublicKey} [senderPubKey]
     * @param {Signature} [signature]
     * @return {boolean}
     */
    signal(senderId, recipientId, nonce, ttl, flags, payload, senderPubKey, signature) {
        return this._send(new SignalMessage(senderId, recipientId, nonce, ttl, flags, payload, senderPubKey, signature));
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
     * @param {AccountsProof} proof
     * @return {boolean}
     */
    accountsProof(blockHash, proof) {
        return this._send(new AccountsProofMessage(blockHash, proof));
    }

    /**
     * @return {boolean}
     */
    getChainProof() {
        return this._send(new GetChainProofMessage());
    }

    /**
     * @param {ChainProof} proof
     * @return {boolean}
     */
    chainProof(proof) {
        return this._send(new ChainProofMessage(proof));
    }

    /**
     * @param {Hash} blockHash
     * @param {string} startPrefix
     * @return {boolean}
     */
    getAccountsTreeChunk(blockHash, startPrefix) {
        return this._send(new GetAccountsTreeChunkMessage(blockHash, startPrefix));
    }

    /**
     * @param {Hash} blockHash
     * @param {AccountsTreeChunk} chunk
     * @return {boolean}
     */
    accountsTreeChunk(blockHash, chunk) {
        return this._send(new AccountsTreeChunkMessage(blockHash, chunk));
    }

    /**
     * @returns {boolean}
     */
    rejectAccounts() {
        return this._send(new AccountsRejectedMessage());
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
PeerChannel.Event[Message.Type.GET_HEADER] = 'get-header';
PeerChannel.Event[Message.Type.NOT_FOUND] = 'not-found';
PeerChannel.Event[Message.Type.GET_BLOCKS] = 'get-blocks';
PeerChannel.Event[Message.Type.BLOCK] = 'block';
PeerChannel.Event[Message.Type.HEADER] = 'header';
PeerChannel.Event[Message.Type.TX] = 'tx';
PeerChannel.Event[Message.Type.MEMPOOL] = 'mempool';
PeerChannel.Event[Message.Type.REJECT] = 'reject';
PeerChannel.Event[Message.Type.SUBSCRIBE] = 'subscribe';
PeerChannel.Event[Message.Type.ADDR] = 'addr';
PeerChannel.Event[Message.Type.GET_ADDR] = 'get-addr';
PeerChannel.Event[Message.Type.PING] = 'ping';
PeerChannel.Event[Message.Type.PONG] = 'pong';
PeerChannel.Event[Message.Type.SIGNAL] = 'signal';
PeerChannel.Event[Message.Type.GET_CHAIN_PROOF] = 'get-chain-proof';
PeerChannel.Event[Message.Type.CHAIN_PROOF] = 'chain-proof';
PeerChannel.Event[Message.Type.GET_ACCOUNTS_PROOF] = 'get-accounts-proof';
PeerChannel.Event[Message.Type.ACCOUNTS_PROOF] = 'accounts-proof';
PeerChannel.Event[Message.Type.GET_ACCOUNTS_TREE_CHUNK] = 'get-accounts-tree-chunk';
PeerChannel.Event[Message.Type.ACCOUNTS_TREE_CHUNK] = 'accounts-tree-chunk';
PeerChannel.Event[Message.Type.ACCOUNTS_REJECTED] = 'accounts-rejected';
