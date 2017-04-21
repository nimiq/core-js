class Primitive extends Uint8Array {
    constructor(arg, length) {
        if (!arg) {
            super(length);
        } else if (typeof arg === 'string') {
            const buffer = BufferUtils.fromBase64(arg);
            if (buffer.byteLength !== length) throw 'Invalid argument';
            super(buffer);
        } else if (arg instanceof ArrayBuffer) {
            if (arg.byteLength !== length) throw 'Invalid argument';
            super(arg);
        } else if (arg instanceof Uint8Array) {
            if (arg.byteLength !== length) throw 'Invalid argument';
            super(arg.buffer, arg.byteOffset, arg.byteLength);
        } else {
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
