// TODO V2: Transactions may contain a payment reference such that the chain can prove existence of data
// TODO V2: Copy 'serialized' to detach all outer references

class RawTransaction {
    constructor(senderPubKey, recipientAddr, value, fee, nonce) {
        if (value <= 0 || value > Number.MAX_SAFE_INTEGER) throw 'Malformed Value';
        if (fee <= 0) throw 'Malformed Fee';
        if (nonce < 0) throw 'Malformed Nonce';

        this._senderPubKey = senderPubKey;
        this._recipientAddr = recipientAddr;
        this._value = value;
        this._fee = fee;
        this._nonce = nonce;
    }

    static unserialize(buf) {
        let senderPubKey = buf.readKey();
        let recipientAddr = buf.readAddr();
        let value = buf.readUint64();
        let fee = buf.readUint32();
        let nonce = buf.readUint32();
        return new RawTransaction(senderPubKey, recipientAddr, value, fee, nonce);
    }

    serialize(buf) {
        buf = buf || new Buffer();
        buf.writeKey(this._senderPubKey);
        buf.writeAddr(this._recipientAddr);
        buf.writeUint64(this._value);
        buf.writeUint32(this._fee);
        buf.writeUint32(this._nonce);
        return buf;
    }

    get senderPubKey() {
        return this._senderPubKey;
    }

    senderAddr() {
        return Crypto.publicToAddress(this._senderPubKey);
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
}

class Transaction extends RawTransaction {

    constructor(rawTransaction, signature) {
        super(rawTransaction.senderPubKey, rawTransaction.recipientAddr,
            rawTransaction.value, rawTransaction.fee, rawTransaction.nonce);
        this._signature = signature;

        Object.freeze(this);

        /*
        return Crypto.verify(this._senderPubKey, this._signature, super.serialize())
            .then( success => {
                if (!success) throw 'Malformed Signature';
                return this;
            });
        */
    }

    static unserialize(buf) {
        const rawTransaction = RawTransaction.unserialize(buf)
        const signature = buf.readSig();
        return new Transaction(rawTransaction, signature);
    }

    serialize(buf) {
        buf = buf || new Buffer();
        super.serialize(buf);
        buf.writeSig(this._signature);
        return buf;
    }

    hash() {
        return Crypto.sha256(this.serialize());
    }

    get signature() {
        return this._signature;
    }

    log(desc) {
        this.senderAddr().then(addr => {
            super.log(desc,`Transaction:
            sender: ${Buffer.toBase64(addr)}
            receiver: ${Buffer.toBase64(this._receiverAddr)}
            signature: ${Buffer.toBase64(this._signature)}
            value: ${this._value} fee: ${this._fee}, nonce: ${this._nonce}`);
        });
    }
}
