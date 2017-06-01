class VersionMessage extends Message {
    constructor(version, peerAddress, genesisHash, startHeight, totalWork) {
        super(Message.Type.VERSION);
        if (!NumberUtils.isUint32(version)) throw 'Malformed version';
        if (!peerAddress || !(peerAddress instanceof PeerAddress)) throw 'Malformed peerAddress';
        if (!Hash.isHash(genesisHash)) throw 'Malformed genesisHash';
        if (!NumberUtils.isUint32(startHeight)) throw 'Malformed startHeight';
        // TODO Validate that totalWork is a valid double.

        this._version = version;
        this._peerAddress = peerAddress;
        this._genesisHash = genesisHash;
        this._startHeight = startHeight;
        this._totalWork = totalWork;
    }

    static unserialize(buf) {
        Message.unserialize(buf);
        const version = buf.readUint32();
        const peerAddress = PeerAddress.unserialize(buf);
        const genesisHash = Hash.unserialize(buf);
        const startHeight = buf.readUint32();
        const totalWork = buf.readFloat64();
        return new VersionMessage(version, peerAddress, genesisHash, startHeight, totalWork);
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        buf.writeUint32(this._version);
        this._peerAddress.serialize(buf);
        this._genesisHash.serialize(buf);
        buf.writeUint32(this._startHeight);
        buf.writeFloat64(this._totalWork);
        super._setChecksum(buf);
        return buf;
    }

    get serializedSize() {
        return super.serializedSize
            + /*version*/ 4
            + this._peerAddress.serializedSize
            + this._genesisHash.serializedSize
            + /*startHeight*/ 4
            + /*totalWork*/ 8;
    }

    get version() {
        return this._version;
    }

    get peerAddress() {
        return this._peerAddress;
    }

    get genesisHash() {
        return this._genesisHash;
    }

    get startHeight() {
        return this._startHeight;
    }

    get totalWork() {
        return this._totalWork;
    }
}
Class.register(VersionMessage);
