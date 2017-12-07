class MultiSigTransaction {
    /**
     * @param {Address} senderAddr
     * @param {Address} recipientAddr
     * @param {number} value
     * @param {number} fee
     * @param {number} nonce
     * @param {Commitment} [commitment]
     * @param {PublicKey} [publicKey]
     */
    constructor(senderAddr, recipientAddr, value, fee, nonce, commitment, publicKey) {
        if (!(senderAddr instanceof Address)) throw 'Malformed senderAddr';
        if (!(recipientAddr instanceof Address)) throw 'Malformed recipientAddr';
        if (!NumberUtils.isUint64(value) || value === 0) throw new Error('Malformed value');
        if (!NumberUtils.isUint64(fee)) throw 'Malformed fee';
        if (!NumberUtils.isUint32(nonce)) throw 'Malformed nonce';

        /** @type {Address} */
        this._senderAddr = senderAddr;
        /** @type {Address} */
        this._recipientAddr = recipientAddr;
        /** @type {number} */
        this._value = value;
        /** @type {number} */
        this._fee = fee;
        /** @type {number} */
        this._nonce = nonce;

        this.setCommitment(commitment, publicKey);
    }

    /**
     * @param {Commitment} commitment
     * @param {PublicKey} publicKey
     */
    setCommitment(commitment, publicKey) {
        if (!(commitment instanceof Commitment) || !(publicKey instanceof PublicKey)) {
            this._commitment = undefined;
            this._publicKey = undefined;
            this._stage = MultiSigTransaction.Stage.COLLECT_COMMITMENTS;
            return;
        }

        /** @type {Commitment} */
        this._commitment = commitment;
        /** @type {PublicKey} */
        this._publicKey = publicKey;

        this._stage = MultiSigTransaction.Stage.COLLECT_SIGNATURES;
    }

    /**
     * @return {Transaction}
     */
    toTransaction() {
        return new Transaction(this._publicKey, this._recipientAddr, this._value, this._fee, this._nonce);
    }

    /**
     * @param {SerialBuffer} buf
     * @return {MultiSigTransaction}
     */
    static unserialize(buf) {
        const senderAddr = Address.unserialize(buf);
        const recipientAddr = Address.unserialize(buf);
        const value = buf.readUint64();
        const fee = buf.readUint64();
        const nonce = buf.readUint32();
        const stage = buf.readUint8();
        let commitment, publicKey;
        if (stage === MultiSigTransaction.Stage.COLLECT_SIGNATURES) {
            commitment = Commitment.unserialize(buf);
            publicKey = PublicKey.unserialize(buf);
        }
        return new MultiSigTransaction(senderAddr, recipientAddr, value, fee, nonce, commitment, publicKey);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @return {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        this._senderAddr.serialize(buf);
        this._recipientAddr.serialize(buf);
        buf.writeUint64(this._value);
        buf.writeUint64(this._fee);
        buf.writeUint32(this._nonce);
        buf.writeUint8(this._stage);
        if (this._stage === MultiSigTransaction.Stage.COLLECT_SIGNATURES) {
            this._commitment.serialize(buf);
            this._publicKey.serialize(buf);
        }
        return buf;
    }

    /** @type {Address} */
    get senderAddress() {
        return this._senderAddr;
    }

    /** @type {Address} */
    get recipientAddress() {
        return this._recipientAddr;
    }

    /** @type {number} */
    get value() {
        return this._value;
    }

    /** @type {number} */
    get fee() {
        return this._fee;
    }

    /** @type {number} */
    get nonce() {
        return this._nonce;
    }

    /** @type {MultiSigTransaction.Stage|number} */
    get stage() {
        return this._stage;
    }

    /** @type {PublicKey} */
    get publicKey() {
        return this._publicKey;
    }

    /** @type {Commitment} */
    get commitment() {
        return this._commitment;
    }

    /**
     * @return {string}
     */
    toString() {
        return `Transaction{`
            + `senderAddr=${this._senderAddr.toBase64()}, `
            + `recipientAddr=${this._recipientAddr.toBase64()}, `
            + `value=${this._value}, `
            + `fee=${this._fee}, `
            + `nonce=${this._nonce}`
            + `}`;
    }
}
/** @enum {number} */
MultiSigTransaction.Stage = {
    COLLECT_COMMITMENTS: 0,
    COLLECT_SIGNATURES: 1
};
Class.register(MultiSigTransaction);
