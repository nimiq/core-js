class BlockInterlink {
    /**
     * @param {Array.<Hash>} blockHashes
     */
    constructor(blockHashes) {
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
     * @returns {number}
     */
    get serializedSize() {
        let size = /*count*/ 1;
        for (const hash of this._hashes) {
            size += hash.serializedSize;
        }
        return size;
    }

    /**
     * @returns {Promise.<Hash>}
     */
    hash() {
        return MerkleTree.computeRoot(this._hashes);
    }
}
