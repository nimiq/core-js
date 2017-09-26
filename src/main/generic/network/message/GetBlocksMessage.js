class GetBlocksMessage extends Message {
    /**
     * @param {Array.<Hash>} locators
     */
    constructor(locators) {
        super(Message.Type.GET_BLOCKS);
        if (!locators || !NumberUtils.isUint16(locators.length)
            || locators.some(it => !Hash.isHash(it))) throw 'Malformed locators';
        /** @type {Array.<Hash>} */
        this._locators = locators;
    }

    /**
     * @param {SerialBuffer} buf
     * @return {GetBlocksMessage}
     */
    static unserialize(buf) {
        Message.unserialize(buf);
        const count = buf.readUint16();
        const locators = [];
        for (let i = 0; i < count; i++) {
            locators.push(Hash.unserialize(buf));
        }
        return new GetBlocksMessage(locators);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @return {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        buf.writeUint16(this._locators.length);
        for (const locator of this._locators) {
            locator.serialize(buf);
        }
        super._setChecksum(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        let size = super.serializedSize
            + /*count*/ 2;
        for (const locator of this._locators) {
            size += locator.serializedSize;
        }
        return size;
    }

    /** @type {Array.<Hash>} */
    get locators() {
        return this._locators;
    }
}
Class.register(GetBlocksMessage);
