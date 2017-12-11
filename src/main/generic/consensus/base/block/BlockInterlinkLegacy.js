class BlockInterlinkLegacy extends BlockInterlink {
    /**
     * @param {BlockInterlink} o
     * @returns {BlockInterlinkLegacy}
     */
    static copy(o) {
        if (!o) return o;
        const hashes = o._hashes.map(it => Hash.copy(it));
        return new BlockInterlinkLegacy(hashes);
    }

    /**
     * @param {Array.<Hash>} blockHashes
     */
    constructor(blockHashes) {
        super(blockHashes);
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {BlockInterlinkLegacy}
     */
    static unserialize(buf) {
        const count = buf.readUint8();
        const hashes = [];
        for (let i = 0; i < count; i++) {
            hashes.push(Hash.unserialize(buf));
        }
        return new BlockInterlinkLegacy(hashes);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @returns {SerialBuffer}
     * @override
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
     * @override
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
     * @override
     */
    hash() {
        return MerkleTree.computeRoot(this._hashes);
    }
}
Class.register(BlockInterlinkLegacy);
