class Signature extends Uint8Array {

	constructor(arg) {
        const buffer;
        if (!arg) {
            buffer = new ArrayBuffer(Signature.SERIALIZED_SIZE);
        }
        else if (typeof arg === 'String') {
            buffer = BufferUtils.fromBase64(arg);
        }
        else if (typeof arg === 'ArrayBuffer'
                || typeof arg === 'Uint8Array') {
            buffer = arg;
        }
        else {
            throw 'Invalid argument';
        }
		super(buffer);
	}

	static unserialize(buf) {
		return new Signature(buf.read(Signature.SERIALIZED_SIZE));
	}

	serialize(buf) {
		buf = buf || new Buffer(Signature.SERIALIZED_SIZE);
		buf.write(this);
		return buf;
	}

    serializedSize() {
        return 64;
    }
}
