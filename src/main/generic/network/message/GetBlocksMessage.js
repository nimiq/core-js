class GetBlocksMessage extends Message {
    /**
     * @param {Array.<Hash>} hashes
     * @param {Hash} hashStop
     */
    constructor(hashes, hashStop) {
        super(Message.Type.GET_BLOCKS);
        if (!hashes || !NumberUtils.isUint16(hashes.length)
            || hashes.some(it => !(it instanceof Hash))) throw 'Malformed hashes';
        /** @type {Array.<Hash>} */
        this._hashes = hashes;
        /** @type {Hash} */
        this._hashStop = hashStop;
    }

    /**
     * @param {SerialBuffer} buf
     * @return {GetBlocksMessage}
     */
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

    /**
     * @param {SerialBuffer} [buf]
     * @return {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        buf.writeUint16(this._hashes.length);
        for (const hash of this._hashes) {
            hash.serialize(buf);
        }
        this._hashStop.serialize(buf);
        super._setChecksum(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        let size = super.serializedSize
            + /*count*/ 2
            + this._hashStop.serializedSize;
        for (const hash of this._hashes) {
            size += hash.serializedSize;
        }
        return size;
    }

    /** @type {Array.<Hash>} */
    get hashes() {
        return this._hashes;
    }

    /** @type {Hash} */
    get hashStop() {
        return this._hashStop;
    }
}
Class.register(GetBlocksMessage);
