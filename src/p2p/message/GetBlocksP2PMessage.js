class GetBlocksP2PMessage extends P2PMessage {
    constructor(count, hashes, hashStop) {
        super(P2PMessage.Type.GETBLOCKS);
        this._count = count;
        this._hashes = hashes;
        this._hashStop = hashStop;
    }

    static unserialize(buf) {
		P2PMessage.unserialize(buf);
        const count = buf.readUint16();
        const hashes = [];
        for (let i = 0; i < count; i++) {
            hashes.push(Hash.unserialize(buf));
        }
        const hashStop = Hash.unserialize(buf);
		return new GetBlocksP2PMessage(count, hashes, hashStop);
	}

	serialize(buf) {
		buf = buf || new Buffer(this.serializedSize);
		super.serialize(buf);
        buf.writeUint16(this._count);
        for (let hash of this._hashes) {
            hash.serialize(buf);
        }
        this._hashStop.serialize(buf);
		return buf;
	}

	get serializedSize() {
		let size = super.serializedSize
			+ /*count*/ 2
            + this._hashStop.serializedSize;
        for (let hash of this._hashes) {
            size += hash.serializedSize;
        }
        return size;
	}

    get count() {
        return this._count;
    }

    get hashes() {
        return this._hashes;
    }

    get hashStop() {
        return this._hashStop;
    }
}
