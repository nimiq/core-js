class RejectMessage extends Message {
    /**
     * @param {Message.Type} messageType
     * @param {RejectMessage.Code} code
     * @param {string} reason
     * @param {Uint8Array} extraData
     */
    constructor(messageType, code, reason, extraData) {
        super(Message.Type.REJECT);
        if (StringUtils.isMultibyte(messageType) || messageType.length > 12) throw 'Malformed type';
        if (!NumberUtils.isUint8(code)) throw 'Malformed code';
        if (StringUtils.isMultibyte(reason) || reason.length > 255) throw 'Malformed reason';
        if (!extraData || !(extraData instanceof Uint8Array) || !NumberUtils.isUint16(extraData.byteLength)) throw 'Malformed extraData';

        /** @type {Message.Type} */
        this._messageType = messageType;
        /** @type {RejectMessage.Code} */
        this._code = code;
        /** @type {string} */
        this._reason = reason;
        /** @type {Uint8Array} */
        this._extraData = extraData;
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {RejectMessage}
     */
    static unserialize(buf) {
        Message.unserialize(buf);
        const messageType = Message.Type.readVarString(buf);
        const code = RejectMessage.Code.read(buf);
        const reason = buf.readVarLengthString();
        const length = buf.readUint16();
        const extraData = buf.read(length);
        return new RejectMessage(messageType, code, reason, extraData);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        buf.writeVarLengthString(this._messageType);
        buf.writeUint8(this._code);
        buf.writeVarLengthString(this._reason);
        buf.writeUint16(this._extraData.byteLength);
        buf.write(this._extraData);
        super._setChecksum(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return super.serializedSize
            + /*messageType VarLengthString extra byte*/ 1
            + this._messageType.length
            + /*code*/ 1
            + /*reason VarLengthString extra byte*/ 1
            + this._reason.length
            + /*extraDataLength*/ 2
            + this._extraData.byteLength;
    }

    /** @type {Message.Type} */
    get messageType() {
        return this._messageType;
    }

    /** @type {RejectMessage.Code} */
    get code() {
        return this._code;
    }

    /** @type {string} */
    get reason() {
        return this._reason;
    }

    /** @type {Uint8Array} */
    get extraData() {
        return this._extraData;
    }
}
/**
 * @enum {number}
 */
RejectMessage.Code = {
    DUPLICATE: 0x12,

    /**
     * @param {SerialBuffer} buf
     * @returns {RejectMessage.Code}
     */
    read: function (buf) {
        return /** @type {RejectMessage.Code} */ (buf.readUint8());
    }
};
Class.register(RejectMessage);
