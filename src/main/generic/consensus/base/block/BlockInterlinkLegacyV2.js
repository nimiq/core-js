class BlockInterlinkLegacyV2 extends BlockInterlink {
    /**
     * @param {BlockInterlink} o
     * @returns {BlockInterlinkLegacyV2}
     */
    static copy(o) {
        if (!o) return o;
        const hashes = o._hashes.map(it => Hash.copy(it));
        const repeatBits = new Uint8Array(o._repeatBits);
        const compressed = o._compressed.map(it => Hash.copy(it));
        return new BlockInterlinkLegacyV2(hashes, repeatBits, compressed);
    }

    /**
     * @param {Array.<Hash>} hashes
     * @param {Uint8Array} [repeatBits]
     * @param {Array.<Hash>} [compressed]
     */
    constructor(hashes, repeatBits, compressed) {
        if (!Array.isArray(hashes) || !NumberUtils.isUint8(hashes.length)
            || hashes.some(it => !(it instanceof Hash))) throw new Error('Malformed hashes');
        if ((repeatBits || compressed) && !(repeatBits && compressed)) throw 'Malformed repeatBits/compressed';

        if (!repeatBits) {
            ({repeatBits, compressed} = BlockInterlink._compress([Block.GENESIS.HASH, ...hashes.slice(1)], null));
        }

        super(hashes, undefined, repeatBits, compressed);
    }

    /**
     * @param {SerialBuffer} buf
     * @param {Hash} prevHash
     * @returns {BlockInterlinkLegacyV2}
     */
    static unserialize(buf, prevHash) {
        const count = buf.readUint8();
        const repeatBitsSize = Math.ceil(count / 8);
        const repeatBits = buf.read(repeatBitsSize);

        // Special case: Genesis block has an empty interlink.
        if (count === 0) {
            return new BlockInterlinkLegacyV2([], new Uint8Array(0), []);
        }

        // Use prevHash as first interlink element.
        const hashes = [prevHash];
        const compressed = [];

        // Ignore the genesis hash but retain it in the compressed representation.
        let hash = Hash.unserialize(buf);
        //Assert.that(Block.GENESIS.HASH.equals(hash), 'Invalid genesis block in BlockInterlinkLegacyV2');
        compressed.push(hash);

        for (let i = 1; i < count; i++) {
            const repeated = (repeatBits[Math.floor(i / 8)] & (0x80 >>> (i % 8))) !== 0;
            if (!repeated) {
                hash = Hash.unserialize(buf);
                compressed.push(hash);
            }
            hashes.push(hash);
        }

        return new BlockInterlinkLegacyV2(hashes, repeatBits, compressed);
    }

    /**
     * @returns {Promise.<Hash>}
     * @override
     */
    async hash() {
        if (!this._hash) {
            this._hash = await MerkleTree.computeRoot([this._repeatBits, ...this._compressed]);
        }
        return this._hash;
    }
}
Class.register(BlockInterlinkLegacyV2);
