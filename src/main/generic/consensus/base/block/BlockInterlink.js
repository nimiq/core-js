class BlockInterlink {
    /**
     * @param {Array.<Hash>} hashes
     * @param {Hash} prevHash
     * @returns {{repeatBits: Uint8Array, compressed: Array.<Hash>}}
     * @protected
     */
    static _compress(hashes, prevHash) {
        const count = hashes.length;
        const repeatBitsSize = Math.ceil(count / 8);
        const repeatBits = new Uint8Array(repeatBitsSize);

        let lastHash = prevHash;
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
     * @param {Array.<Hash>} hashes
     * @param {Hash} [prevHash]
     * @param {Uint8Array} [repeatBits]
     * @param {Array.<Hash>} [compressed]
     */
    constructor(hashes, prevHash, repeatBits, compressed) {
        if (!Array.isArray(hashes) || !NumberUtils.isUint8(hashes.length)
            || hashes.some(it => !(it instanceof Hash))) throw new Error('Malformed hashes');
        if ((repeatBits || compressed) && !(repeatBits && compressed)) throw new Error('Malformed repeatBits/compressed');
        if (!prevHash && !repeatBits) throw new Error('Either prevHash or repeatBits/compressed required');

        if (!repeatBits) {
            ({repeatBits, compressed} = BlockInterlink._compress(hashes, prevHash));
        }

        /** @type {Array.<Hash>} */
        this._hashes = hashes;
        /** @type {Uint8Array} */
        this._repeatBits = repeatBits;
        /** @type {Array.<Hash>} */
        this._compressed = compressed;
    }

    /**
     * @param {SerialBuffer} buf
     * @param {Hash} prevHash
     * @returns {BlockInterlink}
     */
    static unserialize(buf, prevHash) {
        const count = buf.readUint8();
        const repeatBitsSize = Math.ceil(count / 8);
        const repeatBits = buf.read(repeatBitsSize);

        let hash = prevHash;
        const hashes = [];
        const compressed = [];
        for (let i = 0; i < count; i++) {
            const repeated = (repeatBits[Math.floor(i / 8)] & (0x80 >>> (i % 8))) !== 0;
            if (!repeated) {
                hash = Hash.unserialize(buf);
                compressed.push(hash);
            }
            hashes.push(hash);
        }

        return new BlockInterlink(hashes, prevHash, repeatBits, compressed);
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
     * @returns {Hash}
     */
    hash() {
        if (!this._hash) {
            this._hash = MerkleTree.computeRoot([this._repeatBits, GenesisConfig.GENESIS_HASH, ...this._compressed]);
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
