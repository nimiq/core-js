class GetBlocksMessage extends Message {
    constructor(hashes, hashStop) {
        super(Message.Type.GETBLOCKS);
        if (!hashes || !NumberUtils.isUint16(hashes.length)
            || hashes.some( it => !(it instanceof Hash))) throw 'Malformed hashes';
        this._hashes = hashes;
        this._hashStop = hashStop;
    }

    static unserialize(buf) {
		Message.unserialize(buf);
        const count = buf.readUint16();
        const hashes = [];
        for (let i = 0; i < count; i++) {
            hashes.push(Hash.unserialize(buf));
        }
        const hashStop = Hash.unserialize(buf);
		return new GetBlocksMessage(hashes, hashStop);
	}

	serialize(buf) {
		buf = buf || new SerialBuffer(this.serializedSize);
		super.serialize(buf);
        buf.writeUint16(this._hashes.length);
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

    get hashes() {
        return this._hashes;
    }

    get hashStop() {
        return this._hashStop;
    }
}
Class.register(GetBlocksMessage);
