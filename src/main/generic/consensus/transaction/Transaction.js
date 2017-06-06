// TODO V2: Transactions may contain a payment reference such that the chain can prove existence of data
// TODO V2: Copy 'serialized' to detach all outer references
class Transaction {
    constructor(senderPubKey, recipientAddr, value, fee, nonce, signature, version = Transaction.CURRENT_VERSION) {
        if (!NumberUtils.isUint16(version)) throw 'Malformed version';
        if (!(senderPubKey instanceof PublicKey)) throw 'Malformed senderPubKey';
        if (!(recipientAddr instanceof Address)) throw 'Malformed recipientAddr';
        if (!NumberUtils.isUint64(value) || value == 0) throw 'Malformed value';
        if (!NumberUtils.isUint64(fee)) throw 'Malformed fee';
        if (!NumberUtils.isUint32(nonce)) throw 'Malformed nonce';
        // Signature may be initially empty and can be set later.
        if (signature !== undefined && !(signature instanceof Signature)) throw 'Malformed signature';

        // Note that the signature is NOT verified here.
        // Callers must explicitly invoke verifySignature() to check it.

        this._version = version;
        this._senderPubKey = senderPubKey;
        this._recipientAddr = recipientAddr;
        this._value = value;
        this._fee = fee;
        this._nonce = nonce;
        this._signature = signature;
    }

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

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        this.serializeContent(buf);
        this._signature.serialize(buf);
        return buf;
    }

    get serializedSize() {
        return this.serializedContentSize
            + this._signature.serializedSize;
    }

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

    get serializedContentSize() {
        return /*version*/ 2
            + /*type*/ 1
            + this._senderPubKey.serializedSize
            + this._recipientAddr.serializedSize
            + /*value*/ 8
            + /*fee*/ 8
            + /*nonce*/ 4;
    }

    async verifySignature() {
        return this._signature.verify(this._senderPubKey, this.serializeContent());
    }

    hash() {
        // Exclude the signature, we don't want transactions to be malleable.
        // TODO Think about this! This means that the signatures will not be
        // captured by the proof of work!
        return Hash.light(this.serializeContent());
    }

    equals(o) {
        return o instanceof Transaction
            && this._senderPubKey.equals(o.senderPubKey)
            && this._recipientAddr.equals(o.recipientAddr)
            && this._value === o.value
            && this._fee === o.fee
            && this._nonce === o.nonce
            && this._signature.equals(o.signature);
    }

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

    get senderPubKey() {
        return this._senderPubKey;
    }

    getSenderAddr() {
        return this._senderPubKey.toAddress();
    }

    get recipientAddr() {
        return this._recipientAddr;
    }

    get value() {
        return this._value;
    }

    get fee() {
        return this._fee;
    }

    get nonce() {
        return this._nonce;
    }

    get signature() {
        return this._signature;
    }

    // Signature is set by the Wallet after signing a transaction.
    set signature(sig) {
        this._signature = sig;
    }
}
Transaction.CURRENT_VERSION = 1;
Transaction.SUPPORTED_VERSIONS = [1];
Transaction.Type = {};
Transaction.Type.BASIC = 0;

Class.register(Transaction);
