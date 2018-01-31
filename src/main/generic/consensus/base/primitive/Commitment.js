class Commitment extends Primitive {
    /**
     * @param {Commitment} o
     * @returns {Commitment}
     */
    static copy(o) {
        if (!o) return o;
        return new Commitment(new Uint8Array(o._obj));
    }

    /**
     * @param {Array.<Commitment>} commitments
     * @return {Commitment}
     */
    static sum(commitments) {
        return new Commitment(Crypto.aggregateCommitments(commitments.map(c => c._obj)));
    }

    /**
     * @param arg
     * @private
     */
    constructor(arg) {
        super(arg, Crypto.commitmentType, Crypto.commitmentSize);
    }

    /**
     * @param {SerialBuffer} buf
     * @return {Commitment}
     */
    static unserialize(buf) {
        return new Commitment(Crypto.commitmentUnserialize(buf.read(Crypto.commitmentSize)));
    }

    /**
     * @param {SerialBuffer} [buf]
     * @return {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.write(Crypto.commitmentSerialize(this._obj));
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return Crypto.commitmentSize;
    }

    /**
     * @param {Primitive} o
     * @return {boolean}
     */
    equals(o) {
        return o instanceof Commitment && super.equals(o);
    }
}

Class.register(Commitment);
