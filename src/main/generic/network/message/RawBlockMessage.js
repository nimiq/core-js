class RawBlockMessage extends Message {
    /**
     * @param {Uint8Array} block
     */
    constructor(block) {
        super(Message.Type.BLOCK);
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

    /*
        unserialize is not implemented,
        because this message will serialize
        to a BlockMessage
     */

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
