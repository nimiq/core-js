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
     * @returns {{repeatBits: Uint8Array, compressed: Array.<Hash>}}
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

        return {repeatBits, compressed};
    }

    /**
     * @param {Array.<Hash>} blockHashes
     * @param {Uint8Array} [repeatBits]
     * @param {Array.<Hash>} [compressed]
     */
    constructor(blockHashes, repeatBits, compressed) {
        if (!Array.isArray(blockHashes) || !NumberUtils.isUint8(blockHashes.length)
            || blockHashes.some(it => !(it instanceof Hash))) throw 'Malformed blockHashes';
        if ((repeatBits || compressed) && !(repeatBits && compressed)) throw 'Malformed repeatBits/compressed';

        if (!repeatBits) {
            ({repeatBits, compressed} = BlockInterlink._compress(blockHashes));
        }

        /** @type {Array.<Hash>} */
        this._hashes = blockHashes;
        /** @type {Uint8Array} */
        this._repeatBits = repeatBits;
        /** @type {Array.<Hash>} */
        this._compressed = compressed;
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
        const compressed = [];
        for (let i = 0; i < count; i++) {
            const repeated = (repeatBits[Math.floor(i / 8)] & (0x80 >>> (i % 8))) !== 0;
            if (!repeated || !hash) {
                hash = Hash.unserialize(buf);
                compressed.push(hash);
            }
            hashes.push(hash);
        }

        return new BlockInterlink(hashes, repeatBits, compressed);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.writeUint8(this._hashes.length);
        buf.write(this._repeatBits);
        for (const hash of this._compressed) {
            hash.serialize(buf);
        }
        return buf;
    }

    /**
     * @type {number}
     */
    get serializedSize() {
        return /*count*/ 1
            + this._repeatBits.length
            + this._compressed.reduce((sum, hash) => sum + hash.serializedSize, 0);
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
            this._hash = await MerkleTree.computeRoot([this._repeatBits, ...this._compressed]);
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
