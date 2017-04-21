class Primitive extends Uint8Array {
    constructor(arg, length) {
        let buffer;
        if (!arg) {
            buffer = new ArrayBuffer(length);
        } else if (typeof arg === 'string') {
            buffer = BufferUtils.fromBase64(arg);
        } else if (arg instanceof ArrayBuffer) {
            buffer = arg;
        } else if (arg instanceof Uint8Array) {
            buffer = arg.buffer;
        } else {
            throw 'Invalid argument';
        }

        if (buffer.byteLength !== length) {
            throw 'Invalid argument';
        }

        super(buffer);
    }
}
