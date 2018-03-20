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
        return new Commitment(Commitment._commitmentsAggregate(commitments.map(c => c._obj)));
    }

    /**
     * @param {Uint8Array} arg
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

    /**
     * @param {Array.<Uint8Array>} commitments
     * @returns {Uint8Array}
     */
    static _commitmentsAggregate(commitments) {
        if (commitments.some(commitment => commitment.byteLength !== PublicKey.SIZE)) {
            throw Error('Wrong buffer size.');
        }
        const concatenatedCommitments = new Uint8Array(commitments.length * PublicKey.SIZE);
        for (let i = 0; i < commitments.length; ++i) {
            concatenatedCommitments.set(commitments[i], i * PublicKey.SIZE);
        }
        if (PlatformUtils.isNodeJs()) {
            const out = new Uint8Array(PublicKey.SIZE);
            NodeNative.node_ed25519_aggregate_commitments(out, concatenatedCommitments, commitments.length);
            return out;
        } else {
            let stackPtr;
            try {
                stackPtr = Module.stackSave();
                const wasmOut = Module.stackAlloc(PublicKey.SIZE);
                const wasmInCommitments = Module.stackAlloc(concatenatedCommitments.length);
                new Uint8Array(Module.HEAPU8.buffer, wasmInCommitments, concatenatedCommitments.length).set(concatenatedCommitments);
                Module._ed25519_aggregate_commitments(wasmOut, wasmInCommitments, commitments.length);
                const aggCommitments = new Uint8Array(PublicKey.SIZE);
                aggCommitments.set(new Uint8Array(Module.HEAPU8.buffer, wasmOut, PublicKey.SIZE));
                return aggCommitments;
            } catch (e) {
                Log.w(CryptoWorkerImpl, e);
                throw e;
            } finally {
                if (stackPtr !== undefined) Module.stackRestore(stackPtr);
            }
        }
    }
}

Commitment.SIZE = 32;

Class.register(Commitment);
