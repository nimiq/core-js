class RawBlockMessage extends BlockMessage {
    /**
     * @param {Uint8Array} block
     */
    constructor(block) {
        super(null);
        /** @type {Uint8Array} */
        this._block = block;
    }

    /**
     * @param {SerialBuffer} [buf]
     * @return {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        buf.write(this._block);
        super._setChecksum(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return super.serializedSize
            + this._block.length;
    }

    /** @type {Block} */
    get block() {
        return Block.unserialize(new SerialBuffer(this._block));
    }
}
Class.register(RawBlockMessage);
