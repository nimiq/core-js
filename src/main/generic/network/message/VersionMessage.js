class VersionMessage extends Message {
    /**
     * @param {number} version
     * @param {PeerAddress} peerAddress
     * @param {Hash} genesisHash
     * @param {Hash} headHash
     */
    constructor(version, peerAddress, genesisHash, headHash) {
        super(Message.Type.VERSION);
        if (!NumberUtils.isUint32(version)) throw 'Malformed version';
        if (!(peerAddress instanceof PeerAddress)) throw 'Malformed peerAddress';
        if (!Hash.isHash(genesisHash)) throw 'Malformed genesisHash';
        if (!Hash.isHash(headHash)) throw 'Malformed headHash';

        /** @type {number} */
        this._version = version;
        /** @type {PeerAddress} */
        this._peerAddress = peerAddress;
        /** @type {Hash} */
        this._genesisHash = genesisHash;
        /** @type {Hash} */
        this._headHash = headHash;
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
        const headHash = Hash.unserialize(buf);
        return new VersionMessage(version, peerAddress, genesisHash, headHash);
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
        this._headHash.serialize(buf);
        super._setChecksum(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return super.serializedSize
            + /*version*/ 4
            + this._peerAddress.serializedSize
            + this._genesisHash.serializedSize
            + this._headHash.serializedSize;
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

    /** @type {Hash} */
    get headHash() {
        return this._headHash;
    }
}
Class.register(VersionMessage);
