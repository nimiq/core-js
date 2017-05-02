class VersionMessage extends Message {
    constructor(version, netAddress, startHeight) {
        super(Message.Type.VERSION);
        this._version = version;
        this._netAddress = netAddress;
        this._startHeight = startHeight;
    }

    static unserialize(buf) {
		Message.unserialize(buf);
        const version = buf.readUint32();
        const netAddress = NetAddress.unserialize(buf);
        const startHeight = buf.readUint32();
		return new VersionMessage(version, netAddress, startHeight);
	}

	serialize(buf) {
		buf = buf || new SerialBuffer(this.serializedSize);
		super.serialize(buf);
		buf.writeUint32(this._version);
        this._netAddress.serialize(buf);
        buf.writeUint32(this._startHeight);
		return buf;
	}

	get serializedSize() {
		return super.serializedSize
			+ /*version*/ 4
            + this._netAddress.serializedSize
            + /*startHeight*/ 4;
	}

    get version() {
        return this._version;
    }

    get netAddress() {
        return this._netAddress;
    }
    
    get startHeight() {
        return this._startHeight;
    }
}
Class.register(VersionMessage);
