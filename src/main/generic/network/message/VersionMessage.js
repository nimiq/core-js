class VersionMessage extends Message {
    /**
     * @param {number} version
     * @param {PeerAddress} peerAddress
     * @param {Hash} genesisHash
     * @param {number} startHeight
     * @param {number} totalWork
     */
    constructor(version, peerAddress, genesisHash, startHeight, totalWork) {
        super(Message.Type.VERSION);
        if (!NumberUtils.isUint32(version)) throw 'Malformed version';
        if (!peerAddress || !(peerAddress instanceof PeerAddress)) throw 'Malformed peerAddress';
        if (!Hash.isHash(genesisHash)) throw 'Malformed genesisHash';
        if (!NumberUtils.isUint32(startHeight)) throw 'Malformed startHeight';
        // TODO Validate that totalWork is a valid double.

        /** @type {number} */
        this._version = version;
        /** @type {PeerAddress} */
        this._peerAddress = peerAddress;
        /** @type {Hash} */
        this._genesisHash = genesisHash;
        /** @type {number} */
        this._startHeight = startHeight;
        /** @type {number} */
        this._totalWork = totalWork;
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {VersionMessage}
     */
    static unserialize(buf) {
        Message.unserialize(buf);
        const version = buf.readUint32();
        const peerAddress = PeerAddress.unserialize(buf);
        const genesisHash = Hash.unserialize(buf);
        const startHeight = buf.readUint32();
        const totalWork = buf.readFloat64();
        return new VersionMessage(version, peerAddress, genesisHash, startHeight, totalWork);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
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

    /** @type {number} */
    get serializedSize() {
        return super.serializedSize
            + /*version*/ 4
            + this._peerAddress.serializedSize
            + this._genesisHash.serializedSize
            + /*startHeight*/ 4
            + /*totalWork*/ 8;
    }

    /** @type {number} */
    get version() {
        return this._version;
    }

    /** @type {PeerAddress} */
    get peerAddress() {
        return this._peerAddress;
    }

    /** @type {Hash} */
    get genesisHash() {
        return this._genesisHash;
    }

    /** @type {number} */
    get startHeight() {
        return this._startHeight;
    }

    /** @type {number} */
    get totalWork() {
        return this._totalWork;
    }
}
Class.register(VersionMessage);
