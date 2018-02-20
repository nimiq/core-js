class NetworkConnection extends Observable {
    /**
     * @param {DataChannel} channel
     * @param {number} protocol
     * @param {NetAddress} netAddress
     * @param {PeerAddress} peerAddress
     */
    constructor(channel, protocol, netAddress, peerAddress) {
        super();
        /** @type {DataChannel} */
        this._channel = channel;

        /** @type {number} */
        this._protocol = protocol;
        /** @type {NetAddress} */
        this._netAddress = netAddress;
        /** @type {PeerAddress} */
        this._peerAddress = peerAddress;

        /** @type {number} */
        this._bytesSent = 0;
        /** @type {number} */
        this._bytesReceived = 0;

        /** @type {boolean} */
        this._inbound = !peerAddress;
        /** @type {boolean} */
        this._closedByUs = false;
        /** @type {boolean} */
        this._closed = false;

        // Unique id for this connection.
        /** @type {number} */
        this._id = NetworkConnection._instanceCount++;

        this._channel.on('message', msg => this._onMessage(msg));
        this._channel.on('close', () => this._onClose(ClosingType.CLOSED_BY_REMOTE, "Closed by remote"));
        this._channel.on('error', e => this.fire('error', e, this));
    }

    _onMessage(msg) {
        // Don't emit messages if this channel is closed.
        if (this._closed) {
            return;
        }

        this._bytesReceived += msg.byteLength || msg.length;
        this.fire('message', msg, this);
    }

    /**
     * @param {number} [type]
     * @param {string} [reason]
     * @private
     */
    _onClose(type, reason) {
        // Don't fire close event again when already closed.
        if (this._closed) {
            return;
        }

        // Mark this connection as closed.
        this._closed = true;

        // Tell listeners that this connection has closed.
        this.fire('close', !this._closedByUs, type, reason, this);
    }

    /**
     * @param {number} [type]
     * @param {string} [reason]
     * @private
     */
    _close(type, reason) {
        this._closedByUs = true;

        // Don't wait for the native close event to fire.
        this._onClose(type, reason);

        // Close the native channel.
        this._channel.close();
    }

    /**
     * @return {boolean}
     * @private
     */
    _isChannelOpen() {
        return this._channel.readyState === DataChannel.ReadyState.OPEN;
    }

    /**
     * @return {boolean}
     * @private
     */
    _isChannelClosing() {
        return this._channel.readyState === DataChannel.ReadyState.CLOSING;
    }

    /**
     * @return {boolean}
     * @private
     */
    _isChannelClosed() {
        return this._channel.readyState === DataChannel.ReadyState.CLOSED;
    }

    /**
     * @param {Uint8Array} msg
     * @return {boolean}
     */
    send(msg) {
        const logAddress = this._peerAddress || this._netAddress;
        if (this._closed) {
            return false;
        }

        // Fire close event (early) if channel is closing/closed.
        if (this._isChannelClosing() || this._isChannelClosed()) {
            Log.w(NetworkConnection, `Not sending data to ${logAddress} - channel closing/closed (${this._channel.readyState})`);
            this._onClose();
            return false;
        }

        // Don't attempt to send if channel is not (yet) open.
        if (!this._isChannelOpen()) {
            Log.w(NetworkConnection, `Not sending data to ${logAddress} - channel not open (${this._channel.readyState})`);
            return false;
        }

        try {
            this._channel.send(msg);
            this._bytesSent += msg.byteLength || msg.length;
            return true;
        } catch (e) {
            Log.e(NetworkConnection, `Failed to send data to ${logAddress}: ${e.message || e}`);
            return false;
        }
    }

    /**
     * @param {Message.Type|Array.<Message.Type>} types
     * @param {function()} timeoutCallback
     * @param {number} [msgTimeout]
     * @param {number} [chunkTimeout]
     */
    expectMessage(types, timeoutCallback, msgTimeout, chunkTimeout) {
        this._channel.expectMessage(types, timeoutCallback, msgTimeout, chunkTimeout);
    }

    /**
     * @param {Message.Type} type
     * @returns {boolean}
     */
    isExpectingMessage(type) {
        return this._channel.isExpectingMessage(type);
    }

    /**
     * @param {number} [type]
     * @param {string} [reason]
     */
    close(type, reason) {
        const connType = this._inbound ? 'inbound' : 'outbound';
        Log.d(NetworkConnection, `Closing ${connType} connection #${this._id} ${this._peerAddress || this._netAddress}` + (reason ? ` - ${reason}` : ''));
        this._close(type, reason);
    }

    /**
     * @param {NetworkConnection} o
     * @return {boolean}
     */
    equals(o) {
        return o instanceof NetworkConnection
            && this._id === o.id;
    }

    /**
     * @returns {string}
     */
    hashCode() {
        return this._id.toString();
    }

    /**
     * @return {string}
     */
    toString() {
        return `NetworkConnection{id=${this._id}, protocol=${this._protocol}, peerAddress=${this._peerAddress}, netAddress=${this._netAddress}}`;
    }

    /** @type {number} */
    get id() {
        return this._id;
    }

    /** @type {number} */
    get protocol() {
        return this._protocol;
    }

    /** @type {PeerAddress} */
    get peerAddress() {
        return this._peerAddress;
    }

    /** @type {PeerAddress} */
    set peerAddress(value) {
        this._peerAddress = value;
    }

    /** @type {NetAddress} */
    get netAddress() {
        return this._netAddress;
    }

    /** @type {NetAddress} */
    set netAddress(value) {
        this._netAddress = value;
    }

    /** @type {number} */
    get bytesSent() {
        return this._bytesSent;
    }

    /** @type {number} */
    get bytesReceived() {
        return this._bytesReceived;
    }

    /** @type {boolean} */
    get inbound() {
        return this._inbound;
    }

    /** @type {boolean} */
    get outbound() {
        return !this._inbound;
    }

    /** @type {boolean} */
    get closed() {
        return this._closed;
    }
}
// Used to generate unique NetworkConnection ids.
NetworkConnection._instanceCount = 0;
Class.register(NetworkConnection);

// In order to give control to scoring
class ClosingType {
    /**
     * @param {number} closingType
     * @return {boolean}
     */
    static isBanningType(closingType){
        return closingType >= 100 && closingType < 200;
    }

    /**
     * @param {number} closingType
     * @return {boolean}
     */
    static isFailingType(closingType){
        return closingType >= 200;
    }
}
////// Regular Closing Types

ClosingType.GET_BLOCKS_TIMEOUT = 0; //getBlocks timeout
ClosingType.BLOCKCHAIN_SYNC_FAILED = 1; //blockchain sync failed

ClosingType.GET_CHAIN_PROOF_TIMEOUT = 2; //getChainProof timeout
ClosingType.GET_ACCOUNTS_TREE_CHUNK_TIMEOUT = 3; //getAccountsTreeChunk timeout
ClosingType.GET_HEADER_TIMEOUT = 4; //getHeader timeout
ClosingType.INVALID_ACCOUNTS_TREE_CHUNK = 5; //Invalid AccountsTreeChunk
ClosingType.ACCOUNTS_TREE_CHUNCK_ROOT_HASH_MISMATCH = 6; //AccountsTreeChunk root hash mismatch
ClosingType.INVALID_CHAIN_PROOF = 7; //invalid chain proof
ClosingType.RECEIVED_WRONG_HEADER = 8; //Received wrong header
ClosingType.DID_NOT_REQESTED_HEADER = 9; //Did not get requested header
ClosingType.ABORTED_SYNC = 10; //aborted sync

ClosingType.GET_ACCOUNTS_PROOF_TIMEOUT = 11; //getAccountsProof timeout
ClosingType.GET_TRANSACTIONS_PROOF_TIMEOUT = 12; //getTransactionsProof timeout
ClosingType.GET_TRANSACTION_RECEIPTS_TIMEOUT = 13; //getTransactionReceipt timeout
ClosingType.INVALID_ACCOUNTS_PROOF = 14; //Invalid AccountsProof
ClosingType.ACCOUNTS_PROOF_ROOT_HASH_MISMATCH = 15; //AccountsProof root hash mismatch
ClosingType.INCOMPLETE_ACCOUNTS_PROOF = 16; //Incomplete AccountsProof
ClosingType.INVALID_BLOCK = 17; //Invalid block
ClosingType.INVALID_CHAIN_PROOF = 18; //invalid chain proof
ClosingType.INVALID_TRANSACTION_PROOF = 19; //Invalid TransactionProof

ClosingType.VERSION_TIMEOUT = 20; //version timeout
ClosingType.VERACK_TIMEOUT = 21; //verack timeout
ClosingType.SENDING_PING_MESSAGE_FAILED = 22; //sending ping message failed
ClosingType.INVALID_PUBLIC_KEY_IN_VERACK_MESSAGE = 23; //Invalid public key in verack message
ClosingType.INVALID_SIGNATURE_IN_VERACK_MESSAGE  = 24; //Invalid signature in verack message
ClosingType.INCOMPATIBLE_VERSION = 25; //incompatible version
ClosingType.DIFFERENT_GENESIS_BLOCK = 26; //different genesis block
ClosingType.INVALID_PEER_ADDRESS_IN_VERSION_MESSAGE = 27; //invalid peerAddress in version message
ClosingType.UNEXPECTED_PEER_ADDRESS_IN_VERSION_MESSAGE = 28; //unexpected peerAddress in version message
ClosingType.SENDING_OF_VERSION_MESSAGE_FAILED = 29; //sending of version message failed

ClosingType.DUPLICATE_CONNECTION = 30; //duplicate connection
ClosingType.PEER_IS_BANNED = 31; //peer is banned
ClosingType.CONNECTION_LIMIT_PER_IP = 32; //verack timeout
ClosingType.MANUAL_NETWORK_DISCONNECT  = 33; //manual network disconnect
ClosingType.MANUAL_WEBSOCKET_DISCONNECT  = 34; //manual websocket disconnect
ClosingType.MAX_PEER_COUNT_REACHED  = 35; //max peer count reached

////// Banning Closing Types

ClosingType.RECEIVED_INVALID_BLOCK = 100; //received invalid block
ClosingType.BANNED_BLOCKCHAIN_SYNC_FAILED = 101; //blockchain sync failed
ClosingType.RECEIVED_INVALID_HEADER = 102; //received invalid header
ClosingType.RECEIVED_TRANSACTION_NOT_MATCHING_OUR_SUBSCRIPTION = 103; //received transaction not matching our subscriptio
ClosingType.ADDR_MESSAGE_TOO_LARGE = 104; //addr message too large
ClosingType.INVALID_ADDR = 105; //invalid addr
ClosingType.ADDR_NOT_GLOBALLY_REACHABLE = 106; //addr not globally reachable
ClosingType.INVALID_SIGNAL_TTL = 107; //invalid signal ttl
ClosingType.INVALID_SIGNATURE = 108; //invalid signature

//////  Failed Closing Types

ClosingType.CLOSED_BY_REMOTE  = 200;
ClosingType.PING_TIMEOUT = 201; //ping timeout
ClosingType.CONNECTION_FAILED = 202; //Connection failed
ClosingType.MISSING_PEER_CONNECTION = 203; //missing peer connection

Class.register(ClosingType);
