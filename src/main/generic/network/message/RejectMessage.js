class RejectMessage extends Message {
    constructor(messageType, code, reason, extraData) {
        super(Message.Type.REJECT);
        if (StringUtils.isMultibyte(messageType) || messageType.length > 12) throw 'Malformed type';
        if (!NumberUtils.isUint8(code)) throw 'Malformed code';
        if (StringUtils.isMultibyte(reason) || reason.length > 255) throw 'Malformed reason';
        // TODO extraData

        this._messageType = messageType;
        this._code = code;
        this._reason = reason;
        this._extraData = extraData;
    }

    static unserialize(buf) {
        Message.unserialize(buf);
        const messageType = buf.readVarLengthString();
        const code = buf.readUint8();
        const reason = buf.readVarLengthString();
        // TODO extraData
        return new BlockMessage(block);
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        buf.writeVarLengthString(this._messageType);
        buf.writeUint8(this._code);
        buf.writeVarLengthString(this._reason);
        // TODO extraData
        super._setChecksum(buf);
        return buf;
    }

    get serializedSize() {
        return super.serializedSize
            + /*messageType VarLengthString extra byte*/ 1
            + this._messageType.length
            + /*code*/ 1
            + /*reason VarLengthString extra byte*/ 1
            + this._reason.length;
    }

    get messageType() {
        return this._messageType;
    }

    get code() {
        return this._code;
    }

    get reason() {
        return this._reason;
    }

    get extraData() {
        return this._extraData;
    }
}
RejectMessage.Code = {};
RejectMessage.Code.DUPLICATE = 0x12;
Class.register(RejectMessage);
