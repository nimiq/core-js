class BlockP2PMessage extends P2PMessage {
    constructor(block) {
        super(P2PMessage.Type.BLOCK);
        // TODO Bitcoin block messages start with a block version
        this._block = block;
    }

	static unserialize(buf) {
		P2PMessage.unserialize(buf);
		const block = Block.unserialize(buf);
		return new BlockP2PMessage(block);
	}

	serialize(buf) {
		buf = buf || new SerialBuffer(this.serializedSize);
		super.serialize(buf);
		this._block.serialize(buf);
		return buf;
	}

	get serializedSize() {
		return super.serializedSize
			+ this._block.serializedSize;
	}

    get block() {
        return this._block;
    }
}
Class.register(BlockP2PMessage);