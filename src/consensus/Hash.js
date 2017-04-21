class Hash extends Uint8Array {

	constructor(arg) {
		const buffer;
        if (!arg) {
            buffer = new ArrayBuffer(Hash.SERIALIZED_SIZE);
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
		return new Hash(buf.read(Hash.SERIALIZED_SIZE));
	}

	serialize(buf) {
		buf = buf || new Buffer(Hash.SERIALIZED_SIZE);
		buf.write(this);
		return buf;
	}

    serializedSize() {
        return 32;
    }
}
