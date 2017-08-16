class HeaderChain {
    /**
     * @param {Array.<Block>} blocks
     */
    constructor(blocks) {
        if (!blocks || !NumberUtils.isUint16(blocks.length) || blocks.length === 0
            || blocks.some(it => !(it instanceof Block) || !it.isLight())) throw new Error('Malformed blocks');

        /** @type {Array.<BlockHeader>} */
        this._blocks = blocks;
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {HeaderChain}
     */
    static unserialize(buf) {
        const count = buf.readUint16();
        const blocks = [];
        for (let i = 0; i < count; i++) {
            blocks.push(Block.unserialize(buf));
        }
        return new HeaderChain(blocks);
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
     * @returns {string}
     */
    toString() {
        return `HeaderChain{length=${this.length}}`;
    }

    /** @type {Array.<Block>} */
    get blocks() {
        return this._blocks;
    }

    /** @type {number} */
    get length() {
        return this._blocks.length;
    }
}
Class.register(HeaderChain);
