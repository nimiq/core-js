class GetBlocksMessage extends Message {
    /**
     * @param {Array.<Hash>} locators
     * @param {GetBlocksMessage.Direction} direction
     */
    constructor(locators, direction=GetBlocksMessage.Direction.ASCENDING) {
        super(Message.Type.GET_BLOCKS);
        if (!locators || !NumberUtils.isUint16(locators.length)
            || locators.some(it => !Hash.isHash(it))) throw 'Malformed locators';
        if (!NumberUtils.isUint8(direction)) throw 'Malformed direction';
        /** @type {Array.<Hash>} */
        this._locators = locators;
        this._direction = direction;
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
        const direction = buf.readUint8();
        return new GetBlocksMessage(locators, direction);
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
        buf.writeUint8(this._direction);
        super._setChecksum(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        let size = super.serializedSize
            + /*count*/ 2
            + /*direction*/ 1;
        for (const locator of this._locators) {
            size += locator.serializedSize;
        }
        return size;
    }

    /** @type {Array.<Hash>} */
    get locators() {
        return this._locators;
    }

    /** @type {GetBlocksMessage.Direction} */
    get direction() {
        return this._direction;
    }
}
/**
 * @enum {number}
 */
GetBlocksMessage.Direction = {
    ASCENDING: 0x1,
    DESCENDING: 0x2
};
Class.register(GetBlocksMessage);
