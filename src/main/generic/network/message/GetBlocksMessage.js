class GetBlocksMessage extends Message {
    /**
     * @param {Array.<Hash>} locators
     * @param {number} maxInvSize
     * @param {GetBlocksMessage.Direction} direction
     */
    constructor(locators, maxInvSize=BaseInventoryMessage.VECTORS_MAX_COUNT, direction=GetBlocksMessage.Direction.FORWARD) {
        super(Message.Type.GET_BLOCKS);
        if (!locators || !NumberUtils.isUint16(locators.length)
            || locators.length > GetBlocksMessage.LOCATORS_MAX_COUNT
            || locators.some(it => !Hash.isHash(it))) throw 'Malformed locators';
        if (!NumberUtils.isUint16(maxInvSize)) throw 'Malformed maxInvSize';
        if (!NumberUtils.isUint8(direction)) throw 'Malformed direction';
        /** @type {Array.<Hash>} */
        this._locators = locators;
        this._maxInvSize = maxInvSize;
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
        const maxInvSize = buf.readUint16();
        const direction = buf.readUint8();
        return new GetBlocksMessage(locators, maxInvSize, direction);
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
        buf.writeUint16(this._maxInvSize);
        buf.writeUint8(this._direction);
        super._setChecksum(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        let size = super.serializedSize
            + /*count*/ 2
            + /*direction*/ 1
            + /*maxInvSize*/ 2;
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

    /** @type {number} */
    get maxInvSize() {
        return this._maxInvSize;
    }

    toString() {
        return `GetBlocksMessage{direction=${this._direction === GetBlocksMessage.Direction.FORWARD ? 'forward' : 'backward'}, maxInvSize=${this._maxInvSize}}`;
    }
}
/**
 * @enum {number}
 */
GetBlocksMessage.Direction = {
    FORWARD: 0x1,
    BACKWARD: 0x2
};
/**
 * @type {number}
 */
GetBlocksMessage.LOCATORS_MAX_COUNT = 128;
Class.register(GetBlocksMessage);
