class Signature extends Serializable {
    /**
     * @param {Signature} o
     * @returns {Signature}
     */
    static copy(o) {
        if (!o) return o;
        // FIXME Move this to Crypto class.
        const obj = new Uint8Array(o._obj);
        return new Signature(obj);
    }

    /**
     * @param {Uint8Array} arg
     * @private
     */
    constructor(arg) {
        super();
        if (!(arg instanceof Uint8Array)) throw new Error('Primitive: Invalid type');
        if (arg.length !== Signature.SIZE) throw new Error('Primitive: Invalid length');
        this._obj = arg;
    }

    /**
     * @param {PrivateKey} privateKey
     * @param {PublicKey} publicKey
     * @param {Uint8Array} data
     * @return {Signature}
     */
    static create(privateKey, publicKey, data) {
        return new Signature(Signature._signatureCreate(privateKey._obj, publicKey._obj, data));
    }

    /**
     * @param {Commitment} commitment
     * @param {Array.<PartialSignature>} signatures
     * @return {Signature}
     */
    static fromPartialSignatures(commitment, signatures) {
        const raw = Signature._combinePartialSignatures(commitment.serialize(), signatures.map(s => s.serialize()));
        return new Signature(raw);
    }

    /**
     * @param {SerialBuffer} buf
     * @return {Signature}
     */
    static unserialize(buf) {
        return new Signature(buf.read(Signature.SIZE));
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
        return Signature.SIZE;
    }

    /**
     * @param {PublicKey} publicKey
     * @param {Uint8Array} data
     * @return {boolean}
     */
    verify(publicKey, data) {
        return Signature._signatureVerify(publicKey._obj, data, this._obj);
    }

    /**
     * @param {Serializable} o
     * @return {boolean}
     */
    equals(o) {
        return o instanceof Signature && super.equals(o);
    }

    /**
     * @param {Uint8Array} combinedCommitment
     * @param {Array.<Uint8Array>} partialSignatures
     * @returns {Uint8Array}
     */
    static _combinePartialSignatures(combinedCommitment, partialSignatures) {
        const combinedSignature = Signature._aggregatePartialSignatures(partialSignatures);
        return BufferUtils.concatTypedArrays(combinedCommitment, combinedSignature);
    }

    /**
     * @param {Array.<Uint8Array>} partialSignatures
     * @returns {Uint8Array}
     */
    static _aggregatePartialSignatures(partialSignatures) {
        return partialSignatures.reduce((sigA, sigB) => Signature._scalarsAdd(sigA, sigB));
    }

    /**
     * @param {Uint8Array} a
     * @param {Uint8Array} b
     * @returns {Uint8Array}
     */
    static _scalarsAdd(a, b) {
        if (a.byteLength !== PartialSignature.SIZE || b.byteLength !== PartialSignature.SIZE) {
            throw Error('Wrong buffer size.');
        }
        if (PlatformUtils.isNodeJs()) {
            const out = new Uint8Array(PartialSignature.SIZE);
            NodeNative.node_ed25519_add_scalars(out, new Uint8Array(a), new Uint8Array(b));
            return out;
        } else {
            let stackPtr;
            try {
                stackPtr = Module.stackSave();
                const wasmOutSum = Module.stackAlloc(PartialSignature.SIZE);
                const wasmInA = Module.stackAlloc(a.length);
                const wasmInB = Module.stackAlloc(b.length);
                new Uint8Array(Module.HEAPU8.buffer, wasmInA, a.length).set(a);
                new Uint8Array(Module.HEAPU8.buffer, wasmInB, b.length).set(b);
                Module._ed25519_add_scalars(wasmOutSum, wasmInA, wasmInB);
                const sum = new Uint8Array(PartialSignature.SIZE);
                sum.set(new Uint8Array(Module.HEAPU8.buffer, wasmOutSum, PartialSignature.SIZE));
                return sum;
            } catch (e) {
                Log.w(Signature, e);
                throw e;
            } finally {
                if (stackPtr !== undefined) Module.stackRestore(stackPtr);
            }
        }
    }

    /**
     * @param {Uint8Array} privateKey
     * @param {Uint8Array} publicKey
     * @param {Uint8Array} message
     * @returns {Uint8Array}
     */
    static _signatureCreate(privateKey, publicKey, message) {
        if (publicKey.byteLength !== PublicKey.SIZE
            || privateKey.byteLength !== PrivateKey.SIZE) {
            throw Error('Wrong buffer size.');
        }
        if (PlatformUtils.isNodeJs()) {
            const out = new Uint8Array(Signature.SIZE);
            NodeNative.node_ed25519_sign(out, new Uint8Array(message), new Uint8Array(publicKey), new Uint8Array(privateKey));
            return out;
        } else {
            let stackPtr;
            try {
                stackPtr = Module.stackSave();
                const wasmOutSignature = Module.stackAlloc(Signature.SIZE);
                const signatureBuffer = new Uint8Array(Module.HEAP8.buffer, wasmOutSignature, Signature.SIZE);
                const wasmInMessage = Module.stackAlloc(message.length);
                new Uint8Array(Module.HEAP8.buffer, wasmInMessage, message.length).set(message);
                const wasmInPubKey = Module.stackAlloc(publicKey.length);
                new Uint8Array(Module.HEAP8.buffer, wasmInPubKey, publicKey.length).set(publicKey);
                const wasmInPrivKey = Module.stackAlloc(privateKey.length);
                const privKeyBuffer = new Uint8Array(Module.HEAP8.buffer, wasmInPrivKey, privateKey.length);
                privKeyBuffer.set(privateKey);

                Module._ed25519_sign(wasmOutSignature, wasmInMessage, message.byteLength, wasmInPubKey, wasmInPrivKey);
                privKeyBuffer.fill(0);

                const signature = new Uint8Array(Signature.SIZE);
                signature.set(signatureBuffer);
                return signature;
            } catch (e) {
                Log.w(Signature, e);
                throw e;
            } finally {
                if (stackPtr !== undefined) Module.stackRestore(stackPtr);
            }
        }
    }

    /**
     * @param {Uint8Array} publicKey
     * @param {Uint8Array} message
     * @param {Uint8Array} signature
     * @returns {boolean}
     */
    static _signatureVerify(publicKey, message, signature) {
        if (PlatformUtils.isNodeJs()) {
            return !!NodeNative.node_ed25519_verify(new Uint8Array(signature), new Uint8Array(message), new Uint8Array(publicKey));
        } else {
            let stackPtr;
            try {
                stackPtr = Module.stackSave();
                const wasmInPubKey = Module.stackAlloc(publicKey.length);
                new Uint8Array(Module.HEAP8.buffer, wasmInPubKey, publicKey.length).set(publicKey);
                const wasmInMessage = Module.stackAlloc(message.length);
                new Uint8Array(Module.HEAP8.buffer, wasmInMessage, message.length).set(message);
                const wasmInSignature = Module.stackAlloc(signature.length);
                new Uint8Array(Module.HEAP8.buffer, wasmInSignature, signature.length).set(signature);

                return !!Module._ed25519_verify(wasmInSignature, wasmInMessage, message.byteLength, wasmInPubKey);
            } catch (e) {
                Log.w(Signature, e);
                throw e;
            } finally {
                if (stackPtr !== undefined) Module.stackRestore(stackPtr);
            }
        }
    }
}

Signature.SIZE = 64;

Class.register(Signature);
