class BaseInventoryP2PMessage extends P2PMessage {
    constructor(type, count, vectors) {
        super(type);
        if (!NumberUtils.isUint16(count)) throw 'Malformed count';
        if (!vectors || vectors.length !== count
			|| vectors.some( it => !(it instanceof InvVector))) throw 'Malformed vectors';
        this._count = count;
        this._vectors = vectors;
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
		super.serialize(buf);
        buf.writeUint16(this._count);
        for (let vector of this._vectors) {
            vector.serialize(buf);
        }
        return buf;
    }

    get serializedSize() {
        let size = super.serializedSize
            + /*count*/ 4;
        for (let vector of this._vectors) {
            size += vector.serializedSize;
        }
        return size;
    }

    get count() {
        return this._count;
    }

    get vectors() {
        return this._vectors;
    }
}
Class.register(BaseInventoryP2PMessage);

class InvP2PMessage extends BaseInventoryP2PMessage {
    constructor(count, vectors) {
        super(P2PMessage.Type.INV, count, vectors);
    }

    static unserialize(buf) {
		P2PMessage.unserialize(buf);
        const count = buf.readUint16();
        const vectors = [];
        for (let i = 0; i < count; ++i) {
            vectors.push(InvVector.unserialize(buf));
        }
        return new InvP2PMessage(count, vectors);
    }
}
Class.register(InvP2PMessage);

class GetDataP2PMessage extends BaseInventoryP2PMessage {
    constructor(count, vectors) {
        super(P2PMessage.Type.GETDATA, count, vectors);
    }

    static unserialize(buf) {
		P2PMessage.unserialize(buf);
        const count = buf.readUint16();
        const vectors = [];
        for (let i = 0; i < count; ++i) {
            vectors.push(InvVector.unserialize(buf));
        }
        return new GetDataP2PMessage(count, vectors);
    }
}

Class.register(GetDataP2PMessage);

class NotFoundP2PMessage extends BaseInventoryP2PMessage {
    constructor(count, vectors) {
        super(P2PMessage.Type.NOTFOUND, count, vectors);
    }

    static unserialize(buf) {
		P2PMessage.unserialize(buf);
        const count = buf.readUint16();
        const vectors = [];
        for (let i = 0; i < count; ++i) {
            vectors.push(InvVector.unserialize(buf));
        }
        return new NotFoundP2PMessage(count, vectors);
    }
}
Class.register(NotFoundP2PMessage);