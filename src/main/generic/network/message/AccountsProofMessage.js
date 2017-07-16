class AccountsProofMessage extends Message {
    /**
     * @param {Hash} blockHash
     * @param {AccountsProof} accountsProof
     */
    constructor(blockHash, accountsProof) {
        super(Message.Type.GETACCOUNTSPROOF);
        if (!blockHash|| !(blockHash instanceof Hash)) throw 'Malformed blockHash';
        if (!accountsProof || !(accountsProof instanceof AccountsProof)) throw 'Malformed proof';
        /** @type {Hash} */
        this._blockHash = blockHash;
        /** @type {AccountsProof} */
        this._accountsProof = accountsProof;
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {AccountsProofMessage}
     */
    static unserialize(buf) {
        Message.unserialize(buf);
        const blockHash = Hash.unserialize(buf);
        const accountsProof = AccountsProof.unserialize(buf);
        return new AccountsProofMessage(blockHash, accountsProof);
    }

    /**
     * @param {?SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        this._blockHash.serialize(buf);
        this._accountsProof.serialize(buf);
        super._setChecksum(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return super.serializedSize
            + this._blockHash.serializedSize
            + this._accountsProof.serializedSize;
    }

    /** @type {Hash} */
    get blockHash() {
        return this._blockHash;
    }

    /** @type {AccountsProof} */
    get accountsProof() {
        return this._accountsProof;
    }
}
Class.register(AccountsProofMessage);
