class BlockInterlink {
    /**
     * @param {Array.<Hash>} blockHashes
     */
    constructor(blockHashes) {
        if (!blockHashes || blockHashes.length === 0 || blockHashes.some(it => !(it instanceof Hash))) throw 'Malformed blockHashes';
        /** @type {Array.<Hash>} */
        this._path = blockHashes;
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
        buf.writeUint8(this._path.length);
        for (const hash of this._path) {
            hash.serialize(buf);
        }
        return buf;
    }

    /**
     * @type {number}
     */
    get serializedSize() {
        let size = /*count*/ 1;
        for (const hash of this._path) {
            size += hash.serializedSize;
        }
        return size;
    }

    equals(o) {
        return o instanceof BlockInterlink
            && this._path.length === o._path.length
            && this._path.every((hash, i) => hash.equals(o.hashes[i]));
    }

    /**
     * @returns {Promise.<Hash>}
     */
    hash() {
        return MerkleTree.computeRoot(this._path);
    }

    /**
     * @type {Array.<Hash>}
     */
    get hashes() {
        return this._path;
    }

    /**
     * @type {number}
     */
    get length() {
        return this._path.length;
    }
}
Class.register(BlockInterlink);
