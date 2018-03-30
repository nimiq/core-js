class InvVector {
    /**
     * @param {Block} block
     * @returns {InvVector}
     */
    static fromBlock(block) {
        const hash = block.hash();
        return new InvVector(InvVector.Type.BLOCK, hash);
    }

    /**
     * @param {BlockHeader} header
     * @returns {InvVector}
     */
    static fromHeader(header) {
        const hash = header.hash();
        return new InvVector(InvVector.Type.BLOCK, hash);
    }

    /**
     * @param {Transaction} tx
     * @returns {InvVector}
     */
    static fromTransaction(tx) {
        const hash = tx.hash();
        return new InvVector(InvVector.Type.TRANSACTION, hash);
    }

    /**
     * @param {InvVector.Type} type
     * @param {Hash} hash
     */
    constructor(type, hash) {
        // TODO validate type
        if (!Hash.isHash(hash)) throw 'Malformed hash';
        /** @type {InvVector.Type} */
        this._type = type;
        /** @type {Hash} */
        this._hash = hash;
    }

    /**
     * @param {SerialBuffer} buf
     * @return {InvVector}
     */
    static unserialize(buf) {
        const type = InvVector.Type.unserialize(buf);
        const hash = Hash.unserialize(buf);
        return new InvVector(type, hash);
    }

    /**
     * @param {?SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.writeUint32(this._type);
        this._hash.serialize(buf);
        return buf;
    }

    /**
     * @param {InvVector} o
     * @returns {boolean}
     */
    equals(o) {
        return o instanceof InvVector
            && this._type === o.type
            && this._hash.equals(o.hash);
    }

    /**
     * @returns {string}
     */
    hashCode() {
        return `${this._type}|${this._hash.toBase64()}`;
    }

    /**
     * @returns {string}
     */
    toString() {
        return `InvVector{type=${this._type}, hash=${this._hash}}`;
    }

    /** @type {number} */
    get serializedSize() {
        return /*invType*/ 4
            + this._hash.serializedSize;
    }

    /** @type {InvVector.Type} */
    get type() {
        return this._type;
    }

    /** @type {Hash} */
    get hash() {
        return this._hash;
    }
}
/**
 * @enum {number}
 */
InvVector.Type = {
    ERROR: 0,
    TRANSACTION: 1,
    BLOCK: 2,

    /**
     * @param {SerialBuffer} buf
     * @returns {InvVector.Type}
     */
    unserialize: function (buf) {
        return /** @type {InvVector.Type} */ (buf.readUint32());
    }
};
Class.register(InvVector);

class BaseInventoryMessage extends Message {
    /**
     * @param {Message.Type} type
     * @param {Array.<InvVector>} vectors
     */
    constructor(type, vectors) {
        super(type);
        if (!vectors || !NumberUtils.isUint16(vectors.length)
            || vectors.some(it => !(it instanceof InvVector))
            || vectors.length > BaseInventoryMessage.VECTORS_MAX_COUNT) throw 'Malformed vectors';
        /** @type {Array.<InvVector>} */
        this._vectors = vectors;
    }

    /**
     * @param {SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        buf.writeUint16(this._vectors.length);
        for (const vector of this._vectors) {
            vector.serialize(buf);
        }
        super._setChecksum(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        let size = super.serializedSize
            + /*count*/ 2;
        for (const vector of this._vectors) {
            size += vector.serializedSize;
        }
        return size;
    }

    /** @type {Array.<InvVector>} */
    get vectors() {
        return this._vectors;
    }

    // noinspection JSCheckFunctionSignatures
    toString(subtype = 'InventoryMessage') {
        return `${subtype}{transactions=${this._vectors.filter(vector => vector.type === InvVector.Type.TRANSACTION).length}, blocks=${this._vectors.filter(vector => vector.type === InvVector.Type.BLOCK).length}}`;
    }
}
BaseInventoryMessage.VECTORS_MAX_COUNT = 1000;
Class.register(BaseInventoryMessage);

class InvMessage extends BaseInventoryMessage {
    /**
     * @param {Array.<InvVector>} vectors
     */
    constructor(vectors) {
        super(Message.Type.INV, vectors);
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {InvMessage}
     */
    static unserialize(buf) {
        Message.unserialize(buf);
        const count = buf.readUint16();
        const vectors = [];
        for (let i = 0; i < count; ++i) {
            vectors.push(InvVector.unserialize(buf));
        }
        return new InvMessage(vectors);
    }

    toString() {
        return super.toString('InvMessage');
    }
}
Class.register(InvMessage);

class GetDataMessage extends BaseInventoryMessage {
    /**
     * @param {Array.<InvVector>} vectors
     */
    constructor(vectors) {
        super(Message.Type.GET_DATA, vectors);
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {GetDataMessage}
     */
    static unserialize(buf) {
        Message.unserialize(buf);
        const count = buf.readUint16();
        const vectors = [];
        for (let i = 0; i < count; ++i) {
            vectors.push(InvVector.unserialize(buf));
        }
        return new GetDataMessage(vectors);
    }

    toString() {
        return super.toString('GetDataMessage');
    }
}
Class.register(GetDataMessage);

class GetHeaderMessage extends BaseInventoryMessage {
    /**
     * @param {Array.<InvVector>} vectors
     */
    constructor(vectors) {
        super(Message.Type.GET_HEADER, vectors);
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {GetHeaderMessage}
     */
    static unserialize(buf) {
        Message.unserialize(buf);
        const count = buf.readUint16();
        const vectors = [];
        for (let i = 0; i < count; ++i) {
            vectors.push(InvVector.unserialize(buf));
        }
        return new GetHeaderMessage(vectors);
    }

    toString() {
        return super.toString('GetHeaderMessage');
    }
}
Class.register(GetHeaderMessage);

class NotFoundMessage extends BaseInventoryMessage {
    /**
     * @param {Array.<InvVector>} vectors
     */
    constructor(vectors) {
        super(Message.Type.NOT_FOUND, vectors);
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {NotFoundMessage}
     */
    static unserialize(buf) {
        Message.unserialize(buf);
        const count = buf.readUint16();
        const vectors = [];
        for (let i = 0; i < count; ++i) {
            vectors.push(InvVector.unserialize(buf));
        }
        return new NotFoundMessage(vectors);
    }

    toString() {
        return super.toString('NotFoundMessage');
    }
}
Class.register(NotFoundMessage);
