class PrivateKey extends Uint8Array {

	constructor(arg) {
		const buffer;
        if (!arg) {
            buffer = new ArrayBuffer(PrivateKey.SERIALIZED_SIZE);
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
		return new PublicKey(buf.read(PrivateKey.SERIALIZED_SIZE));
	}

	serialize(buf) {
		buf = buf || new Buffer(PrivateKey.SERIALIZED_SIZE);
		buf.write(this);
		return buf;
	}

	serializedSize() {
		return 64;
	}
}
