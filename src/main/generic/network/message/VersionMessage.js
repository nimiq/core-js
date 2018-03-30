class VersionMessage extends Message {
    /**
     * @param {number} version
     * @param {PeerAddress} peerAddress
     * @param {Hash} genesisHash
     * @param {Hash} headHash
     * @param {Uint8Array} challengeNonce
     */
    constructor(version, peerAddress, genesisHash, headHash, challengeNonce) {
        super(Message.Type.VERSION);
        if (!NumberUtils.isUint32(version)) throw new Error('Malformed version');
        if (!(peerAddress instanceof PeerAddress)) throw new Error('Malformed peerAddress');
        if (!Hash.isHash(genesisHash)) throw new Error('Malformed genesisHash');
        if (!Hash.isHash(headHash)) throw new Error('Malformed headHash');
        if (!(challengeNonce instanceof Uint8Array) || challengeNonce.byteLength !== 32) throw new Error('Malformed challenge nonce');

        /** @type {number} */
        this._version = version;
        /** @type {PeerAddress} */
        this._peerAddress = peerAddress;
        /** @type {Hash} */
        this._genesisHash = genesisHash;
        /** @type {Hash} */
        this._headHash = headHash;
        /** @type {Uint8Array} */
        this._challengeNonce = challengeNonce;
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
        const challengeNonce = buf.read(VersionMessage.CHALLENGE_SIZE);
        return new VersionMessage(version, peerAddress, genesisHash, headHash, challengeNonce);
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
        buf.write(this._challengeNonce);
        super._setChecksum(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return super.serializedSize
            + /*version*/ 4
            + this._peerAddress.serializedSize
            + this._genesisHash.serializedSize
            + this._headHash.serializedSize
            + VersionMessage.CHALLENGE_SIZE;
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

    /** @type {Uint8Array} */
    get challengeNonce() {
        return this._challengeNonce;
    }

    toString() {
        return `VersionMessage{version=${this._version}, peer=${this._peerAddress}, genesis=${this._genesisHash}, head=${this._headHash}}`;
    }
}

VersionMessage.CHALLENGE_SIZE = 32;
Class.register(VersionMessage);
