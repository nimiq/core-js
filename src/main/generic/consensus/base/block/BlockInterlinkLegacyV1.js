class BlockInterlinkLegacyV1 extends BlockInterlink {
    /**
     * @param {BlockInterlink} o
     * @returns {BlockInterlinkLegacyV1}
     */
    static copy(o) {
        if (!o) return o;
        const hashes = o._hashes.map(it => Hash.copy(it));
        return new BlockInterlinkLegacyV1(hashes);
    }

    /**
     * @param {Array.<Hash>} hashes
     */
    constructor(hashes) {
        super(hashes, undefined, new Uint8Array(0), []);
    }

    /**
     * @param {SerialBuffer} buf
     * @param {Hash} prevHash
     * @returns {BlockInterlinkLegacyV1}
     */
    static unserialize(buf, prevHash) {
        const count = buf.readUint8();
        const hashes = [];

        // If this is not the genesis interlink (count > 0), ignore the genesis hash and add prevHash as first
        // interlink element.
        if (count > 0) {
            const genesisHash = Hash.unserialize(buf);
            //Assert.that(Block.GENESIS.HASH.equals(genesisHash), 'Invalid genesis block in BlockInterlinkLegacyV1');
            hashes.push(prevHash);
        }

        for (let i = 1; i < count; i++) {
            hashes.push(Hash.unserialize(buf));
        }

        return new BlockInterlinkLegacyV1(hashes);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @returns {SerialBuffer}
     * @override
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.writeUint8(this._hashes.length);

        // If this is not the genesis interlink, write the genesis hash as the first interlink element.
        if (this._hashes.length > 0) {
            Block.GENESIS.HASH.serialize(buf);
        }

        // Skip the first element of the interlink.
        for (let i = 1; i < this._hashes.length; i++) {
            this._hashes[i].serialize(buf);
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
    async hash() {
        if (!this._hash) {
            const hashes = this.length > 0 ? [Block.GENESIS.HASH, ...this._hashes.slice(1)] : [];
            this._hash = await MerkleTree.computeRoot(hashes);
        }
        return this._hash;
    }
}
Class.register(BlockInterlinkLegacyV1);
