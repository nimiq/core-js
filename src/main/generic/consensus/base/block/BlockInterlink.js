class BlockInterlink {
    /**
     * @param {BlockInterlink} o
     * @returns {BlockInterlink}
     */
    static copy(o) {
        if (!o) return o;
        const hashes = o._hashes.map(it => Hash.copy(it));
        return new BlockInterlink(hashes);
    }

    /**
     * @param {Array.<Hash>} blockHashes
     */
    constructor(blockHashes) {
        if (!blockHashes || !Array.isArray(blockHashes) || blockHashes.some(it => !(it instanceof Hash))) throw 'Malformed blockHashes';
        /** @type {Array.<Hash>} */
        this._hashes = blockHashes;
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {BlockInterlink}
     */
    static unserialize(buf) {
        const count = buf.readUint8();
        const hashes = [];
        for (let i = 0; i < count; i++) {
            hashes.push(Hash.unserialize(buf));
        }
        return new BlockInterlink(hashes);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.writeUint8(this._hashes.length);
        for (const hash of this._hashes) {
            hash.serialize(buf);
        }
        return buf;
    }

    /**
     * @type {number}
     */
    get serializedSize() {
        let size = /*count*/ 1;
        for (const hash of this._hashes) {
            size += hash.serializedSize;
        }
        return size;
    }

    /**
     * @param {BlockInterlink|*} o
     * @returns {boolean}
     */
    equals(o) {
        return o instanceof BlockInterlink
            && this._hashes.length === o._hashes.length
            && this._hashes.every((hash, i) => hash.equals(o.hashes[i]));
    }

    /**
     * @returns {Promise.<Hash>}
     */
    hash() {
        return MerkleTree.computeRoot(this._hashes);
    }

    /**
     * @type {Array.<Hash>}
     */
    get hashes() {
        return this._hashes;
    }

    /**
     * @type {number}
     */
    get length() {
        return this._hashes.length;
    }
}
Class.register(BlockInterlink);
