class GetTransactionsProofByHashesMessage extends Message {
    /**
     * @param {Hash} blockHash
     * @param {Array.<Hash>} hashes
     */
    constructor(blockHash, hashes) {
        super(Message.Type.GET_TRANSACTIONS_PROOF_BY_HASHES);
        if (!blockHash || !(blockHash instanceof Hash)) throw new Error('Malformed block hash');
        if (!Array.isArray(hashes) || hashes.length === 0 || !NumberUtils.isUint16(hashes.length)
            || hashes.length > GetTransactionsProofByHashesMessage.HASHES_MAX_COUNT
            || hashes.some(hash => !(hash instanceof Hash))) throw new Error('Malformed hashes');
        this._blockHash = blockHash;
        /** @type {Array.<Hash>} */
        this._hashes = hashes;
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {GetTransactionsProofByHashesMessage}
     */
    static unserialize(buf) {
        Message.unserialize(buf);
        const blockHash = Hash.unserialize(buf);
        const count = buf.readUint16();
        if (count > GetTransactionsProofByHashesMessage.HASHES_MAX_COUNT) throw new Error('Malformed count');
        const hashes = new Array(count);
        for (let i = 0; i < count; i++) {
            hashes[i] = Hash.unserialize(buf);
        }
        return new GetTransactionsProofByHashesMessage(blockHash, hashes);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        this._blockHash.serialize(buf);
        buf.writeUint16(this._hashes.length);
        for (const address of this._hashes) {
            address.serialize(buf);
        }
        super._setChecksum(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return super.serializedSize
            + this._blockHash.serializedSize
            + /*count*/ 2
            + this._hashes.reduce((sum, hash) => sum + hash.serializedSize, 0);
    }

    /** @type {Array.<Hash>} */
    get hashes() {
        return this._hashes;
    }

    /** @type {Hash} */
    get blockHash() {
        return this._blockHash;
    }
}
/**
 * @type {number}
 */
GetTransactionsProofByHashesMessage.HASHES_MAX_COUNT = 255;
Class.register(GetTransactionsProofByHashesMessage);
