class VersionP2PMessage extends P2PMessage {
    constructor(version, services, timestamp, startHeight) {
        super(P2PMessage.Type.VERSION);
        this._version = version;
        this._services = services;
        this._timestamp = timestamp;
        this._startHeight = startHeight;
    }

    static unserialize(buf) {
		P2PMessage.unserialize(buf);
        const version = buf.readUint32();
        const services = buf.readUint32();
        const timestamp = buf.readUint64();
        const startHeight = buf.readUint32();
		return new VersionP2PMessage(version, services, timestamp, startHeight);
	}

	serialize(buf) {
		buf = buf || new Buffer(this.serializedSize);
		super.serialize(buf);
		buf.writeUint32(this._version);
        buf.writeUint32(this._services);
        buf.writeUint64(this._timestamp);
        buf.writeUint32(this._startHeight);
		return buf;
	}

	get serializedSize() {
		return super.serializedSize
			+ /*version*/ 4
            + /*services*/ 4
            + /*timestamp*/ 8
            + /*startHeight*/ 4;
	}

    get version() {
        return this._version;
    }

    get services() {
        return this._services;
    }

    get timestamp() {
        return this._timestamp;
    }

    get startHeight() {
        return this._startHeight;
    }
}
