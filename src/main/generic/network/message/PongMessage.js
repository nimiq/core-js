class PongMessage extends Message {
    /**
     * @param {number} nonce
     */
    constructor(nonce) {
        super(Message.Type.PONG);
        if (!NumberUtils.isUint32(nonce)) throw 'Malformed nonce';

        this._nonce = nonce;
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {PongMessage}
     */
    static unserialize(buf) {
        Message.unserialize(buf);
        const nonce = buf.readUint32();
        return new PongMessage(nonce);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        buf.writeUint32(this._nonce);
        super._setChecksum(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return super.serializedSize
            + /*nonce*/ 4;
    }

    /** @type {number} */
    get nonce() {
        return this._nonce;
    }

    toString() {
        return `PongMessage{nonce=${this._nonce}}`;
    }
}
Class.register(PongMessage);
