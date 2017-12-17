class AccountsTreeChunkMessage extends Message {
    /**
     * @param {Hash} blockHash
     * @param {AccountsTreeChunk} [accountsTreeChunk]
     */
    constructor(blockHash, accountsTreeChunk=null) {
        super(Message.Type.ACCOUNTS_TREE_CHUNK);
        if (!(blockHash instanceof Hash)) throw 'Malformed blockHash';
        if (accountsTreeChunk && !(accountsTreeChunk instanceof AccountsTreeChunk)) throw 'Malformed chunk';
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
        const hasChunk = buf.readUint8();
        let accountsTreeChunk = null;
        if (hasChunk !== 0) {
            accountsTreeChunk = AccountsTreeChunk.unserialize(buf);
        }
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
        buf.writeUint8(this.hasChunk() ? 1 : 0);
        if (this.hasChunk()) {
            this._accountsTreeChunk.serialize(buf);
        }
        super._setChecksum(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return super.serializedSize
            + /*success bit*/ 1
            + this._blockHash.serializedSize
            + (this.hasChunk() ? this._accountsTreeChunk.serializedSize : 0);
    }

    /**
     * @return {boolean}
     */
    hasChunk() {
        return !!this._accountsTreeChunk;
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
