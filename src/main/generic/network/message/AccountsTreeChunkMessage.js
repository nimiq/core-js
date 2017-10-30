]class AccountsTreeChunkMessage extends Message {
    /**
     * @param {Hash} blockHash
     * @param {AccountsTreeChunk} accountsTreeChunk
     */
    constructor(blockHash, accountsTreeChunk) {
        super(Message.Type.ACCOUNTS_TREE_CHUNK);
        if (!(blockHash instanceof Hash)) throw 'Malformed blockHash';
        if (!(accountsTreeChunk instanceof AccountsTreeChunk)) throw 'Malformed chunk';
        /** @type {Hash} */
        this._blockHash = blockHash;
        /** @type {AccountsTreeChunk} */
        this._accountsTreeChunk = accountsTreeChunk;
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {AccountsTreeChunkMessage}
     */
    static unserialize(buf) {
        Message.unserialize(buf);
        const blockHash = Hash.unserialize(buf);
        const accountsTreeChunk = AccountsTreeChunk.unserialize(buf);
        return new AccountsTreeChunkMessage(blockHash, accountsTreeChunk);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        this._blockHash.serialize(buf);
        this._accountsTreeChunk.serialize(buf);
        super._setChecksum(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return super.serializedSize
            + this._blockHash.serializedSize
            + this._accountsTreeChunk.serializedSize;
    }

    /** @type {Hash} */
    get blockHash() {
        return this._blockHash;
    }

    /** @type {AccountsTreeChunk} */
    get chunk() {
        return this._accountsTreeChunk;
    }
}
Class.register(AccountsTreeChunkMessage);
