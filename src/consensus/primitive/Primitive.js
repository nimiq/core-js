class Primitive extends Uint8Array {
    constructor(arg, length) {
        if (!arg) {
            super(length);
        } else if (typeof arg === 'string') {
            const buffer = BufferUtils.fromBase64(arg);
            Primitive._enforceLength(buffer, length);
            super(buffer);
        } else if (arg instanceof ArrayBuffer) {
            Primitive._enforceLength(arg, length);
            super(arg);
        } else if (arg instanceof Uint8Array) {
            Primitive._enforceLength(arg, length);
            super(arg.buffer, arg.byteOffset, arg.byteLength);
        } else {
            throw 'Invalid argument';
        }
    }

    static _enforceLength(buffer, length) {
        if (length !== undefined && buffer.byteLength !== length) {
            throw 'Invalid argument';
        }
    }

    equals(o) {
        return o instanceof Primitive
            && BufferUtils.equals(this, o);
    }

    toBase64() {
        return BufferUtils.toBase64(this);
    }
}
