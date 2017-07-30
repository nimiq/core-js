class InterlinkChain {
    /**
     * @param {Array.<Block>} blocks
     */
    constructor(blocks) {
        if (!blocks || !NumberUtils.isUint16(blocks.length) || blocks.length  === 0
            || blocks.some(it => !(it instanceof Block) || !it.isLight())) throw 'Malformed blocks';
        /** @type {Array.<Block>} */
        this._blocks = blocks;
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {InterlinkChain}
     */
    static unserialize(buf) {
        const count = buf.readUint16();
        const blocks = [];
        for (let i = 0; i < count; i++) {
            blocks.push(Block.unserialize(buf));
        }
        return new InterlinkChain(blocks);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.writeUint16(this._blocks.length);
        for (const block of this._blocks) {
            block.serialize(buf);
        }
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return /*count*/ 2
            + this._blocks.reduce((sum, block) => sum + block.serializedSize, 0);
    }

    /**
     * @returns {Promise.<boolean>}
     */
    async verify() {
        // Check that all blocks in the interlink chain are valid interlink successors of one another.
        for (let i = this._blocks.length - 1; i >= 1; i--) {
            if (!(await this._blocks[i].isInterlinkSuccessorOf(this._blocks[i - 1]))) { // eslint-disable-line no-await-in-loop
                return false;
            }
        }
        return true;
    }

    /**
     * Prepends a block to the interlink chain.
     * @param {Block} block
     * @returns {void}
     */
    prepend(block) {
        if (!block.isLight()) throw 'InterlinkChain only accepts light blocks';

        // TODO unshift() is inefficient. We should build the array with push()
        // instead and iterate over it in reverse order.
        this._blocks.unshift(block);
    }

    /**
     * @returns {Promise.<boolean>}
     */
    async isDense() {
        // XXX Re-use the same buffer for repeated hashing.
        const buf = new SerialBuffer(Crypto.hashSize);

        for (let i = this._blocks.length - 1; i >= 1; i--) {
            const prevHash = await this._blocks[i - 1].hash(buf); // eslint-disable-line no-await-in-loop
            if (!prevHash.equals(this._blocks[i].prevHash)) {
                return false;
            }
            buf.reset();
        }
        return true;
    }

    /**
     * @returns {Promise.<boolean>}
     */
    async isRooted() {
        return Block.GENESIS.HASH.equals(await this.tail.hash());
    }

    /** @type {number} */
    get length() {
        return this._blocks.length;
    }

    /** @type {Array.<Block>} */
    get blocks() {
        return this._blocks;
    }

    /** @type {Block} */
    get head() {
        return this._blocks[this.length - 1];
    }

    /** @type {Block} */
    get tail() {
        return this._blocks[0];
    }
}
Class.register(InterlinkChain);
