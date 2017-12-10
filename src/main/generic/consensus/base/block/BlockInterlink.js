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
     * @param {Array.<Hash>} hashes
     * @returns {{repeatBits: Uint8Array, hashes: Array.<Hash>}}
     * @private
     */
    static _compress(hashes) {
        const count = hashes.length;
        const repeatBitsSize = Math.ceil(count / 8);
        const repeatBits = new Uint8Array(repeatBitsSize);

        let lastHash = null;
        const compressed = [];
        for (let i = 0; i < count; i++) {
            const hash = hashes[i];
            if (!hash.equals(lastHash)) {
                compressed.push(hash);
                lastHash = hash;
            } else {
                repeatBits[Math.floor(i / 8)] |= 0x80 >>> (i % 8);
            }
        }

        return {repeatBits, hashes: compressed};
    }

    /**
     * @param {Array.<Hash>} blockHashes
     */
    constructor(blockHashes) {
        if (!Array.isArray(blockHashes) || !NumberUtils.isUint8(blockHashes.length)
            || blockHashes.some(it => !(it instanceof Hash))) throw 'Malformed blockHashes';

        /** @type {Array.<Hash>} */
        this._hashes = blockHashes;
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {BlockInterlink}
     */
    static unserialize(buf) {
        const count = buf.readUint8();
        const repeatBitsSize = Math.ceil(count / 8);
        const repeatBits = buf.read(repeatBitsSize);

        let hash = null;
        const hashes = [];
        for (let i = 0; i < count; i++) {
            const repeated = (repeatBits[Math.floor(i / 8)] & (0x80 >>> (i % 8))) !== 0;
            if (!repeated || !hash) {
                hash = Hash.unserialize(buf);
            }
            hashes.push(hash);
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
        const {repeatBits, hashes} = BlockInterlink._compress(this._hashes);
        buf.write(repeatBits);
        for (const hash of hashes) {
            hash.serialize(buf);
        }
        return buf;
    }

    /**
     * @type {number}
     */
    get serializedSize() {
        const {repeatBits, hashes} = BlockInterlink._compress(this._hashes);
        return /*count*/ 1
            + repeatBits.length
            + hashes.reduce((sum, hash) => sum + hash.serializedSize, 0);
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
    async hash() {
        if (!this._hash) {
            const {repeatBits, hashes} = BlockInterlink._compress(this._hashes);
            this._hash = await MerkleTree.computeRoot([repeatBits, ...hashes]);
        }
        return this._hash;
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
