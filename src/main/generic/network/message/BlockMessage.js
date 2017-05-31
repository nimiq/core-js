class BlockMessage extends Message {
    constructor(block) {
        super(Message.Type.BLOCK);
        // TODO Bitcoin block messages start with a block version
        this._block = block;
    }

    static unserialize(buf) {
        Message.unserialize(buf);
        const block = Block.unserialize(buf);
        return new BlockMessage(block);
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        this._block.serialize(buf);
        super._setChecksum(buf);
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
Class.register(BlockMessage);
