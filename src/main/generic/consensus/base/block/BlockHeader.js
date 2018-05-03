class BlockHeader {
    /**
     * @param {Hash} prevHash
     * @param {Hash} interlinkHash
     * @param {Hash} bodyHash
     * @param {Hash} accountsHash
     * @param {number} nBits
     * @param {number} height
     * @param {number} timestamp
     * @param {number} nonce
     * @param {number} version
     */
    constructor(prevHash, interlinkHash, bodyHash, accountsHash, nBits, height, timestamp, nonce, version = BlockHeader.CURRENT_VERSION) {
        if (!NumberUtils.isUint16(version)) throw 'Malformed version';
        if (!Hash.isHash(prevHash)) throw 'Malformed prevHash';
        if (!Hash.isHash(interlinkHash)) throw 'Malformed interlinkHash';
        if (!Hash.isHash(bodyHash)) throw 'Malformed bodyHash';
        if (!Hash.isHash(accountsHash)) throw 'Malformed accountsHash';
        if (!NumberUtils.isUint32(nBits) || !BlockUtils.isValidCompact(nBits)) throw 'Malformed nBits';
        if (!NumberUtils.isUint32(height)) throw 'Invalid height';
        if (!NumberUtils.isUint32(timestamp)) throw 'Malformed timestamp';
        if (!NumberUtils.isUint32(nonce)) throw 'Malformed nonce';

        /** @type {number} */
        this._version = version;
        /** @type {Hash} */
        this._prevHash = prevHash;
        /** @type {Hash} */
        this._interlinkHash = interlinkHash;
        /** @type {Hash} */
        this._bodyHash = bodyHash;
        /** @type {Hash} */
        this._accountsHash = accountsHash;
        /** @type {number} */
        this._nBits = nBits;
        /** @type {number} */
        this._height = height;
        /** @type {number} */
        this._timestamp = timestamp;
        /** @type {number} */
        this._nonce = nonce;
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {BlockHeader}
     */
    static unserialize(buf) {
        const version = buf.readUint16();
        if (!BlockHeader.SUPPORTED_VERSIONS.includes(version)) throw new Error(`Unsupported block version ${version}`);
        const prevHash = Hash.unserialize(buf);
        const interlinkHash = Hash.unserialize(buf);
        const bodyHash = Hash.unserialize(buf);
        const accountsHash = Hash.unserialize(buf);
        const nBits = buf.readUint32();
        const height = buf.readUint32();
        const timestamp = buf.readUint32();
        const nonce = buf.readUint32();
        return new BlockHeader(prevHash, interlinkHash, bodyHash, accountsHash, nBits, height, timestamp, nonce, version);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.writeUint16(this._version);
        this._prevHash.serialize(buf);
        this._interlinkHash.serialize(buf);
        this._bodyHash.serialize(buf);
        this._accountsHash.serialize(buf);
        buf.writeUint32(this._nBits);
        buf.writeUint32(this._height);
        buf.writeUint32(this._timestamp);
        buf.writeUint32(this._nonce);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return /*version*/ 2
            + this._prevHash.serializedSize
            + this._interlinkHash.serializedSize
            + this._bodyHash.serializedSize
            + this._accountsHash.serializedSize
            + /*nBits*/ 4
            + /*height*/ 4
            + /*timestamp*/ 4
            + /*nonce*/ 4;
    }

    /**
     * @param {SerialBuffer} [buf]
     * @return {Promise.<boolean>}
     */
    async verifyProofOfWork(buf) {
        const pow = await this.pow(buf);
        return BlockUtils.isProofOfWork(pow, this.target);
    }

    /**
     * @param {BlockHeader} prevHeader
     * @returns {boolean}
     */
    isImmediateSuccessorOf(prevHeader) {
        // Check that the height is one higher than the previous height.
        if (this.height !== prevHeader.height + 1) {
            return false;
        }

        // Check that the timestamp is greater or equal to the predecessor's timestamp.
        if (this.timestamp < prevHeader.timestamp) {
            return false;
        }

        // Check that the hash of the predecessor block equals prevHash.
        const prevHash = prevHeader.hash();
        if (!this.prevHash.equals(prevHash)) {
            return false;
        }

        // Everything checks out.
        return true;
    }

    /**
     * @param {SerialBuffer} [buf]
     * @return {Hash}
     */
    hash(buf) {
        this._hash = this._hash || Hash.light(this.serialize(buf));
        return this._hash;
    }
    
    /**
     * @param {SerialBuffer} [buf]
     * @return {Promise.<Hash>}
     */
    async pow(buf) {
        this._pow = this._pow || await Hash.hard(this.serialize(buf));
        return this._pow;
    }

    /**
     * @param {BlockHeader|*} o
     * @returns {boolean}
     */
    equals(o) {
        return o instanceof BlockHeader
            && this._prevHash.equals(o.prevHash)
            && this._interlinkHash.equals(o.interlinkHash)
            && this._bodyHash.equals(o.bodyHash)
            && this._accountsHash.equals(o.accountsHash)
            && this._nBits === o.nBits
            && this._height === o.height
            && this._timestamp === o.timestamp
            && this._nonce === o.nonce;
    }

    /**
     * @returns {string}
     */
    toString() {
        return 'BlockHeader{'
            + `prevHash=${this._prevHash}, `
            + `interlinkHash=${this._interlinkHash}, `
            + `bodyHash=${this._bodyHash}, `
            + `accountsHash=${this._accountsHash}, `
            + `nBits=${this._nBits.toString(16)}, `
            + `height=${this._height}, `
            + `timestamp=${this._timestamp}, `
            + `nonce=${this._nonce}`
            + '}';
    }

    /** @type {number} */
    get version() {
        return this._version;
    }

    /** @type {Hash} */
    get prevHash() {
        return this._prevHash;
    }

    /** @type {Hash} */
    get interlinkHash() {
        return this._interlinkHash;
    }

    /** @type {Hash} */
    get bodyHash() {
        return this._bodyHash;
    }

    /** @type {Hash} */
    get accountsHash() {
        return this._accountsHash;
    }

    /** @type {number} */
    get nBits() {
        return this._nBits;
    }

    /** @type {BigNumber} */
    get target() {
        return BlockUtils.compactToTarget(this._nBits);
    }

    /** @type {BigNumber} */
    get difficulty() {
        return BlockUtils.compactToDifficulty(this._nBits);
    }

    /** @type {number} */
    get height() {
        return this._height;
    }

    /** @type {number} */
    get timestamp() {
        return this._timestamp;
    }

    /** @type {number} */
    get nonce() {
        return this._nonce;
    }

    // XXX The miner changes the nonce of an existing BlockHeader during the
    // mining process.
    /** @type {number} */
    set nonce(n) {
        this._nonce = n;
        this._hash = null;
        this._pow = null;
    }
}
// FIXME: Clean up for mainnet.
BlockHeader.Version = {
    V1: 1
};
BlockHeader.CURRENT_VERSION = BlockHeader.Version.V1;
BlockHeader.SUPPORTED_VERSIONS = [
    BlockHeader.Version.V1
];
BlockHeader.SERIALIZED_SIZE = 146;
Class.register(BlockHeader);
