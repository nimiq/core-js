class InterlinkChainMessage extends Message {
    /**
     * @param {InterlinkChain} interlinkChain
     */
    constructor(interlinkChain) {
        super(Message.Type.INTERLINK_CHAIN);
        if (!interlinkChain|| !(interlinkChain instanceof InterlinkChain)) throw 'Malformed interlinkChain';
        /** @type {InterlinkChain} */
        this._interlinkChain = interlinkChain;
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {InterlinkChainMessage}
     */
    static unserialize(buf) {
        Message.unserialize(buf);
        const interlinkChain = InterlinkChain.unserialize(buf);
        return new InterlinkChainMessage(interlinkChain);
    }

    /**
     * @param {?SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        this._interlinkChain.serialize(buf);
        super._setChecksum(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return super.serializedSize
            + this._interlinkChain.serializedSize;
    }

    /** @type {InterlinkChain} */
    get interlinkChain() {
        return this._interlinkChain;
    }
}
Class.register(InterlinkChainMessage);
