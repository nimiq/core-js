class RejectMessage extends Message {
    /**
     * @param {Message.Type} messageType
     * @param {RejectMessage.Code} code
     * @param {string} reason
     * @param {Uint8Array} [extraData]
     */
    constructor(messageType, code, reason, extraData=new Uint8Array(0)) {
        super(Message.Type.REJECT);
        if (!NumberUtils.isUint64(messageType)) throw new Error('Malformed type');
        if (!NumberUtils.isUint8(code)) throw new Error('Malformed code');
        if (StringUtils.isMultibyte(reason) || reason.length > 255) throw new Error('Malformed reason');
        if (!(extraData instanceof Uint8Array) || !NumberUtils.isUint16(extraData.byteLength)) throw new Error('Malformed extraData');

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
        const messageType = /** @type {Message.Type} */ buf.readUint64();
        const code = /** @type {RejectMessage.Code} */ buf.readUint8();
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
        buf.writeUint64(this._messageType);
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
            + 8
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
    REJECT_MALFORMED: 0x01,
    REJECT_OBSOLETE: 0x11,
    REJECT_DUST: 0x41,
    REJECT_INSUFFICIENTFEE: 0x42
};
Class.register(RejectMessage);
