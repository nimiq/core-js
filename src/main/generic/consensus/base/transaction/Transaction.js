// TODO V2: Copy 'serialized' to detach all outer references
class Transaction {

    /**
     * @param {Transaction} o
     * @returns {Transaction}
     */
    static copy(o) {
        if (!o) return o;
        if (o._senderPubKey) {
            // Legacy format
            const senderPubKey = PublicKey.copy(o._senderPubKey);
            const recipientAddr = Address.copy(o._recipientAddr);
            const signature = Signature.copy(o._signature);
            return Transaction.basic(senderPubKey, recipientAddr, o._value, o._fee, o._nonce, signature);
        } else {
            const sender = Address.copy(o._sender);
            const recipient = Address.copy(o._recipient);
            const data = new Uint8Array(o._data);
            const proof = new Uint8Array(o._proof);
            return new Transaction(o._type, sender, o._senderType, recipient, o._recipientType, o._value, o._fee, o._nonce, proof, data);
        }
    }

    /**
     * @param {Transaction.Type} type
     * @param {Address} sender
     * @param {Account.Type} senderType
     * @param {Address} recipient
     * @param {Account.Type} recipientType
     * @param {number} value
     * @param {number} fee
     * @param {number} nonce
     * @param {Uint8Array} proof
     * @param {Uint8Array} data
     */
    constructor(type, sender, senderType, recipient, recipientType, value, fee, nonce, proof, data = new Uint8Array(0)) {
        if (!(sender instanceof Address)) throw new Error('Malformed sender');
        if (!NumberUtils.isUint8(senderType)) throw new Error('Malformed sender type');
        if (!(recipient instanceof Address)) throw new Error('Malformed recipient');
        if (!NumberUtils.isUint8(recipientType)) throw new Error('Malformed recipient type');
        if (!NumberUtils.isUint64(value) || value === 0) throw new Error('Malformed value');
        if (!NumberUtils.isUint64(fee)) throw new Error('Malformed fee');
        if (!NumberUtils.isUint32(nonce)) throw new Error('Malformed nonce');
        if (!(data instanceof Uint8Array) || !(NumberUtils.isUint16(data.byteLength))) throw new Error('Malformed data');
        if (!(proof instanceof Uint8Array) || !(NumberUtils.isUint16(proof.byteLength))) throw new Error('Malformed proof');
        if (type !== Transaction.Type.BASIC && type !== Transaction.Type.EXTENDED) throw new Error('Invalid transaction type');

        /** @type {Transaction.Type} */
        this._type = type;
        /** @type {Address} */
        this._sender = sender;
        /** @type {Account.Type} */
        this._senderType = senderType;
        /** @type {Address} */
        this._recipient = recipient;
        /** @type {Account.Type} */
        this._recipientType = recipientType;
        /** @type {number} */
        this._value = value;
        /** @type {number} */
        this._fee = fee;
        /** @type {number} */
        this._nonce = nonce;
        /** @type {Uint8Array} */
        this._data = data;
        /** @type {Uint8Array} */
        this._proof = proof;
    }

    /**
     * @param {PublicKey} senderPubKey
     * @param {Address} recipient
     * @param {number} value
     * @param {number} fee
     * @param {number} nonce
     * @param {Signature} [signature]
     * @return {Transaction}
     */
    static basic(senderPubKey, recipient, value, fee, nonce, signature) {
        if (!(senderPubKey instanceof PublicKey)) throw new Error('Malformed senderPubKey');
        // Signature may be initially empty and can be set later.
        if (signature !== undefined && !(signature instanceof Signature)) throw new Error('Malformed signature');

        const proof = new SerialBuffer(1 + Crypto.publicKeySize + Crypto.signatureSize);
        proof.writeUint8(0); // merkle tree depth
        senderPubKey.serialize(proof);
        if (signature) signature.serialize(proof);
        return new Transaction(Transaction.Type.BASIC, senderPubKey.toAddressSync(), Account.Type.BASIC, recipient, Account.Type.BASIC, value, fee, nonce, proof, new Uint8Array(0));
    }

    /**
     * @param {SerialBuffer} buf
     * @return {Transaction}
     */
    static unserialize(buf) {
        // We currently only support one transaction type: Basic.
        const type = /** @type {Transaction.Type} */ buf.readUint8();
        let /** @type {Address} */ sender, 
            /** @type {Account.Type} */ senderType, 
            /** @type {Address} */ recipient, 
            /** @type {Account.Type} */ recipientType, 
            /** @type {number} */ value, 
            /** @type {number} */ fee, 
            /** @type {number} */ nonce, 
            /** @type {Uint8Array} */ proof, 
            /** @type {Uint8Array} */ data;
        switch (type) {
            case Transaction.Type.BASIC: {
                // FIXME: Remove unused version field
                buf.readPos += 2;
                const senderPubKey = PublicKey.unserialize(buf);
                sender = senderPubKey.toAddressSync();
                senderType = Account.Type.BASIC;
                recipient = Address.unserialize(buf);
                recipientType = Account.Type.BASIC;
                value = buf.readUint64();
                fee = buf.readUint64();
                nonce = buf.readUint32();
                const signature = Signature.unserialize(buf);
                const proofBuffer = new SerialBuffer(1 + senderPubKey.serializedSize + signature.serializedSize);
                proofBuffer.writeUint8(0); // merkle tree depth
                senderPubKey.serialize(proofBuffer);
                signature.serialize(proofBuffer);
                proof = proofBuffer;
                data = new Uint8Array(0);
                break;
            }
            case Transaction.Type.EXTENDED: {
                sender = Address.unserialize(buf);
                senderType = /** @type {Account.Type} */ buf.readUint8();
                recipient = Address.unserialize(buf);
                recipientType = /** @type {Account.Type} */ buf.readUint8();
                value = buf.readUint64();
                fee = buf.readUint64();
                nonce = buf.readUint32();
                const dataSize = buf.readUint16();
                data = buf.read(dataSize);
                const proofSize = buf.readUint16();
                proof = buf.read(proofSize);
                break;
            }
            default:
                throw new Error('Invalid transaction type');
        }
        return new Transaction(type, sender, senderType, recipient, recipientType, value, fee, nonce, proof, data);
    }

    /**
     * @param {?SerialBuffer} [buf]
     * @return {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        this.serializeContent(buf);
        switch (this._type) {
            case Transaction.Type.BASIC:
                this.signature.serialize(buf);
                break;
            case Transaction.Type.EXTENDED:
                buf.writeUint16(this._proof.byteLength);
                buf.write(this._proof);
                break;
            default:
                throw new Error('Invalid state');
        }
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        switch (this._type) {
            case Transaction.Type.BASIC:
                return this.serializedContentSize + Crypto.signatureSize;
            case Transaction.Type.EXTENDED:
                return this.serializedContentSize + /*proofSize*/ 2 + this._proof.byteLength;
            default:
                throw new Error('Invalid state');
        }
    }

    /**
     * @param {?SerialBuffer} [buf]
     * @return {SerialBuffer}
     */
    serializeContent(buf) {
        buf = buf || new SerialBuffer(this.serializedContentSize);
        buf.writeUint8(this._type);
        switch (this._type) {
            case Transaction.Type.BASIC:
                // FIXME: @see {#unserialize}
                buf.writeUint16(256 /* version */);
                this.senderPubKey.serialize(buf);
                this._recipient.serialize(buf);
                buf.writeUint64(this._value);
                buf.writeUint64(this._fee);
                buf.writeUint32(this._nonce);
                break;
            case Transaction.Type.EXTENDED:
                this._sender.serialize(buf);
                buf.writeUint8(this._senderType);
                this._recipient.serialize(buf);
                buf.writeUint8(this._recipientType);
                buf.writeUint64(this._value);
                buf.writeUint64(this._fee);
                buf.writeUint32(this._nonce);
                buf.writeUint16(this._data.byteLength);
                buf.write(this._data);
                break;
            default:
                throw new Error('Invalid state');
        }
        return buf;
    }

    /** @type {number} */
    get serializedContentSize() {
        switch (this._type) {
            case Transaction.Type.BASIC:
                return /*type*/ 1
                    + /*version*/ 2
                    + Crypto.publicKeySize
                    + this._recipient.serializedSize
                    + /*value*/ 8
                    + /*fee*/ 8
                    + /*nonce*/ 4;
            case Transaction.Type.EXTENDED:
                return /*type*/ 1
                    + this._sender.serializedSize
                    + /*senderType*/ 1
                    + this._recipient.serializedSize
                    + /*recipientType*/ 1
                    + /*value*/ 8
                    + /*fee*/ 8
                    + /*nonce*/ 4
                    + /*dataSize*/ 2
                    + this._data.byteLength;
            default:
                throw new Error('Invalid state');
        }
    }

    /**
     * @returns {Promise.<boolean>}
     */
    async verify() {
        // Check that sender != recipient.
        if (this._recipient.equals(this._sender)) {
            Log.w(Transaction, 'Sender and recipient must not match');
            return false;
        }
        if (!Account.TYPE_MAP.has(this._senderType) || !Account.TYPE_MAP.has(this._recipientType)) {
            Log.w(Transaction, 'Invalid account type');
            return false;
        }
        if (!(await Account.TYPE_MAP.get(this._senderType).INITIAL.verifyOutgoingTransactionValidity(this))) {
            Log.w(Mempool, 'Invalid for sender proof');
            return false;
        }
        if (!(await Account.TYPE_MAP.get(this._recipientType).INITIAL.verifyIncomingTransactionValidity(this))) {
            Log.w(Mempool, 'Invalid recipient data');
            return false;
        }
        return true;
    }

    /**
     * @return {Promise.<boolean>}
     * @deprecated
     */
    async verifySignature() {
        if (this._type !== Transaction.Type.BASIC) throw new Error('Not allowed for non-basic transactions');
        if (this._proof[0] !== 0) throw new Error('Not allowed for non-basic transactions');
        return SignatureProof.verifySignatureProof(this);
    }

    /**
     * @return {Promise.<Hash>}
     */
    async hash() {
        // Exclude the signature, we don't want transactions to be malleable.
        this._hash = this._hash || await Hash.light(this.serializeContent());
        return this._hash;
    }

    /**
     * @param {Transaction} o
     * @return {boolean}
     */
    equals(o) {
        return o instanceof Transaction
            && this._type === o._type
            && this._sender.equals(o._sender)
            && this._recipient.equals(o._recipient)
            && this._value === o._value
            && this._fee === o._fee
            && this._nonce === o._nonce
            && this._recipientType === o._recipientType
            && BufferUtils.equals(this._data, o._data)
            && BufferUtils.equals(this._proof, o._proof);
    }

    /**
     * @param {Transaction} o
     */
    compareBlockOrder(o) {
        const recCompare = this._recipient.compare(o._recipient);
        if (recCompare !== 0) return recCompare;
        if (this._nonce < o._nonce) return -1;
        if (this._nonce > o._nonce) return 1;
        if (this._fee > o._fee) return -1;
        if (this._fee < o._fee) return 1;
        if (this._value > o._value) return -1;
        if (this._value < o._value) return 1;
        return this._sender.compare(o._sender);
    }

    /**
     * @param {Transaction} o
     */
    compareAccountOrder(o) {
        const senderCompare = this._sender.compare(o._sender);
        if (senderCompare !== 0) return senderCompare;
        if (this._nonce < o._nonce) return -1;
        if (this._nonce > o._nonce) return 1;
        return Assert.that(false, 'Invalid transaction set');
    }

    /**
     * @return {string}
     */
    toString() {
        return `Transaction{`
            + `sender=${this._sender.toBase64()}, `
            + `recipient=${this._recipient.toBase64()}, `
            + `value=${this._value}, `
            + `fee=${this._fee}, `
            + `nonce=${this._nonce}`
            + `}`;
    }

    get type() {
        return this._type;
    }

    /**
     * @type {PublicKey}
     * @deprecated
     */
    get senderPubKey() {
        return PublicKey.unserialize(new SerialBuffer(this._proof.subarray(1, 1 + Crypto.publicKeySize)));
    }

    /** @type {Address} */
    get sender() {
        return this._sender;
    }

    /** @type {Account.Type} */
    get senderType() {
        return this._senderType;
    }

    /** @type {Address} */
    get recipient() {
        return this._recipient;
    }

    /** @type {Account.Type} */
    get recipientType() {
        return this._recipientType;
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

    /** @type {Uint8Array} */
    get data() {
        return this._data;
    }

    /** @type {Uint8Array} */
    get proof() {
        return this._proof;
    }

    // Sender proof is set by the Wallet after signing a transaction.
    /** @type {Uint8Array} */
    set proof(proof) {
        this._proof = proof;
    }

    /**
     * @type {Signature}
     * @deprecated
     */
    get signature() {
        return Signature.unserialize(new SerialBuffer(this._proof.subarray(this._proof.length - Crypto.signatureSize, this._proof.length)));
    }

    /**
     * @type {Signature}
     * @deprecated
     */
    set signature(sig) {
        this._proof.set(sig.serialize(), this._proof.length - sig.serializedSize);
    }
}

/**
 * Enum for Transaction types.
 * @enum {number}
 */
Transaction.Type = {
    BASIC: 0,
    EXTENDED: 1
};

Class.register(Transaction);
