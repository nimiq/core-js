// TODO V2: Transactions may contain a payment reference such that the chain can prove existence of data
// TODO V2: Copy 'serialized' to detach all outer references
class Transaction {

    /**
     * @param {Transaction} o
     * @returns {Transaction}
     */
    static copy(o) {
        if (!o) return o;
        const senderPubKey = PublicKey.copy(o._senderPubKey);
        const recipientAddr = Address.copy(o._recipientAddr);
        const signature = Signature.copy(o._signature);
        return new Transaction(senderPubKey, recipientAddr, o._value, o._fee, o._nonce, signature, o._version);
    }

    /**
     * @param {PublicKey} senderPubKey
     * @param {Address} recipientAddr
     * @param {number} value
     * @param {number} fee
     * @param {number} nonce
     * @param {Signature} [signature]
     * @param {number} version
     */
    constructor(senderPubKey, recipientAddr, value, fee, nonce, signature, version = Transaction.CURRENT_VERSION) {
        if (!NumberUtils.isUint16(version)) throw 'Malformed version';
        if (!(senderPubKey instanceof PublicKey)) throw 'Malformed senderPubKey';
        if (!(recipientAddr instanceof Address)) throw 'Malformed recipientAddr';
        if (!NumberUtils.isUint64(value) || value === 0) throw new Error('Malformed value');
        if (!NumberUtils.isUint64(fee)) throw 'Malformed fee';
        if (!NumberUtils.isUint32(nonce)) throw 'Malformed nonce';
        // Signature may be initially empty and can be set later.
        if (signature !== undefined && !(signature instanceof Signature)) throw 'Malformed signature';

        // Note that the signature is NOT verified here.
        // Callers must explicitly invoke verifySignature() to check it.

        /** @type {number} */
        this._version = version;
        /** @type {PublicKey} */
        this._senderPubKey = senderPubKey;
        /** @type {Address} */
        this._recipientAddr = recipientAddr;
        /** @type {number} */
        this._value = value;
        /** @type {number} */
        this._fee = fee;
        /** @type {number} */
        this._nonce = nonce;
        /** @type {Signature} */
        this._signature = signature;
    }

    /**
     * @param {SerialBuffer} buf
     * @return {Transaction}
     */
    static unserialize(buf) {
        // We currently only support one transaction type: Basic.
        const version = buf.readUint16();
        if (!Transaction.SUPPORTED_VERSIONS.includes(version)) throw 'Transaction version unsupported';
        const type = buf.readUint8();
        if (type !== Transaction.Type.BASIC) throw 'Malformed transaction type';
        const senderPubKey = PublicKey.unserialize(buf);
        const recipientAddr = Address.unserialize(buf);
        const value = buf.readUint64();
        const fee = buf.readUint64();
        const nonce = buf.readUint32();
        const signature = Signature.unserialize(buf);
        return new Transaction(senderPubKey, recipientAddr, value, fee, nonce, signature, version);
    }

    /**
     * @param {?SerialBuffer} [buf]
     * @return {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        this.serializeContent(buf);
        this._signature.serialize(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return this.serializedContentSize
            + this._signature.serializedSize;
    }

    /**
     * @param {?SerialBuffer} [buf]
     * @return {SerialBuffer}
     */
    serializeContent(buf) {
        buf = buf || new SerialBuffer(this.serializedContentSize);
        buf.writeUint16(this._version);
        buf.writeUint8(Transaction.Type.BASIC);
        this._senderPubKey.serialize(buf);
        this._recipientAddr.serialize(buf);
        buf.writeUint64(this._value);
        buf.writeUint64(this._fee);
        buf.writeUint32(this._nonce);
        return buf;
    }

    /** @type {number} */
    get serializedContentSize() {
        return /*version*/ 2
            + /*type*/ 1
            + this._senderPubKey.serializedSize
            + this._recipientAddr.serializedSize
            + /*value*/ 8
            + /*fee*/ 8
            + /*nonce*/ 4;
    }

    /**
     * @returns {Promise.<boolean>}
     */
    async verify() {
        // Check that the signature is valid.
        if (!(await this.verifySignature())) {
            Log.w(Transaction, 'Invalid signature');
            return false;
        }

        // Check that sender != recipient.
        const senderAddr = await this.getSenderAddr();
        if (this._recipientAddr.equals(senderAddr)) {
            Log.w(Transaction, 'Sender and recipient must not match');
            return false;
        }

        return true;
    }

    /**
     * @return {Promise.<boolean>}
     */
    async verifySignature() {
        return this._signature.verify(this._senderPubKey, this.serializeContent());
    }

    /**
     * @return {Promise.<Hash>}
     */
    async hash() {
        // Exclude the signature, we don't want transactions to be malleable.
        // TODO Think about this! This means that the signatures will not be
        // captured by the proof of work!
        this._hash = this._hash || await Hash.light(this.serializeContent());
        return this._hash;
    }

    /**
     * @param {Transaction} o
     * @return {boolean}
     */
    equals(o) {
        return o instanceof Transaction
            && this._senderPubKey.equals(o.senderPubKey)
            && this._recipientAddr.equals(o.recipientAddr)
            && this._value === o.value
            && this._fee === o.fee
            && this._nonce === o.nonce
            && this._signature.equals(o.signature);
    }

    /**
     * @param {Transaction} o
     */
    compareBlockOrder(o) {
        const recCompare = this.recipientAddr.compare(o.recipientAddr);
        if (recCompare !== 0) return recCompare;
        if (this.nonce < o.nonce) return -1;
        if (this.nonce > o.nonce) return 1;
        if (this.fee > o.fee) return -1;
        if (this.fee < o.fee) return 1;
        if (this.value > o.value) return -1;
        if (this.value < o.value) return 1;
        return this.senderPubKey.compare(o.senderPubKey);
    }

    /**
     * @param {Transaction} o
     */
    compareAccountOrder(o) {
        const senderCompare = this.senderPubKey.compare(o.senderPubKey);
        if (senderCompare !== 0) return senderCompare;
        if (this.nonce < o.nonce) return -1;
        if (this.nonce > o.nonce) return 1;
        return Assert.that(false, 'Invalid transaction set');
    }

    /**
     * @return {string}
     */
    toString() {
        return `Transaction{`
            + `senderPubKey=${this._senderPubKey.toBase64()}, `
            + `recipientAddr=${this._recipientAddr.toBase64()}, `
            + `value=${this._value}, `
            + `fee=${this._fee}, `
            + `nonce=${this._nonce}, `
            + `signature=${this._signature.toBase64()}`
            + `}`;
    }

    /** @type {PublicKey} */
    get senderPubKey() {
        return this._senderPubKey;
    }

    /**
     * @return {Promise.<Address>}
     */
    getSenderAddr() {
        return this._senderPubKey.toAddress();
    }

    /** @type {Address} */
    get recipientAddr() {
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

    /** @type {Signature} */
    get signature() {
        return this._signature;
    }

    // Signature is set by the Wallet after signing a transaction.
    /** @type {Signature} */
    set signature(sig) {
        this._signature = sig;
    }
}
Transaction.CURRENT_VERSION = 1;
Transaction.SUPPORTED_VERSIONS = [1];
Transaction.Type = {};
Transaction.Type.BASIC = 0;

Class.register(Transaction);
