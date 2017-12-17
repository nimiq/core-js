class AccountsProofMessage extends Message {
    /**
     * @param {Hash} blockHash
     * @param {AccountsProof} [accountsProof]
     */
    constructor(blockHash, accountsProof=null) {
        super(Message.Type.ACCOUNTS_PROOF);
        if (!(blockHash instanceof Hash)) throw new Error('Malformed blockHash');
        if (accountsProof && !(accountsProof instanceof AccountsProof)) throw new Error('Malformed proof');
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
        const hasProof = buf.readUint8();
        let accountsProof = null;
        if (hasProof !== 0) {
            accountsProof = AccountsProof.unserialize(buf);
        }
        return new AccountsProofMessage(blockHash, accountsProof);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        this._blockHash.serialize(buf);
        buf.writeUint8(this.hasProof() ? 1 : 0);
        if (this.hasProof()) {
            this._accountsProof.serialize(buf);
        }
        super._setChecksum(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return super.serializedSize
            + /*success bit*/ 1
            + this._blockHash.serializedSize
            + (this.hasProof() ? this._accountsProof.serializedSize : 0);
    }

    /**
     * @return {boolean}
     */
    hasProof() {
        return !!this._accountsProof;
    }

    /** @type {Hash} */
    get blockHash() {
        return this._blockHash;
    }

    /** @type {AccountsProof} */
    get proof() {
        return this._accountsProof;
    }
}
Class.register(AccountsProofMessage);
