class VersionMessage extends Message {
    constructor(version, peerAddress, startHeight) {
        super(Message.Type.VERSION);
        this._version = version;
        this._peerAddress = peerAddress;
        this._startHeight = startHeight;
    }

    static unserialize(buf) {
		Message.unserialize(buf);
        const version = buf.readUint32();
        const peerAddress = PeerAddress.unserialize(buf);
        const startHeight = buf.readUint32();
		return new VersionMessage(version, peerAddress, startHeight);
	}

	serialize(buf) {
		buf = buf || new SerialBuffer(this.serializedSize);
		super.serialize(buf);
		buf.writeUint32(this._version);
        this._peerAddress.serialize(buf);
        buf.writeUint32(this._startHeight);
		return buf;
	}

	get serializedSize() {
		return super.serializedSize
			+ /*version*/ 4
            + this._peerAddress.serializedSize
            + /*startHeight*/ 4;
	}

    get version() {
        return this._version;
    }

    get peerAddress() {
        return this._peerAddress;
    }

    get startHeight() {
        return this._startHeight;
    }
}
Class.register(VersionMessage);
