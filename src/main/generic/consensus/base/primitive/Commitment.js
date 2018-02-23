class Commitment extends Serializable {
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
        return new Commitment(Crypto.workerSync().commitmentsAggregate(commitments.map(c => c._obj)));
    }

    /**
     * @param arg
     * @private
     */
    constructor(arg) {
        super();
        if (!(arg instanceof Uint8Array)) throw new Error('Primitive: Invalid type');
        if (arg.length !== Commitment.SIZE) throw new Error('Primitive: Invalid length');
        this._obj = arg;
    }

    /**
     * @param {SerialBuffer} buf
     * @return {Commitment}
     */
    static unserialize(buf) {
        return new Commitment(buf.read(Commitment.SIZE));
    }

    /**
     * @param {SerialBuffer} [buf]
     * @return {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.write(this._obj);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return Commitment.SIZE;
    }

    /**
     * @param {Serializable} o
     * @return {boolean}
     */
    equals(o) {
        return o instanceof Commitment && super.equals(o);
    }
}

Commitment.SIZE = 32;

Class.register(Commitment);
