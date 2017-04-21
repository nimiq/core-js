class PublicKey extends Uint8Array {

	constructor(arg) {
		const buffer;
        if (!arg) {
            buffer = new ArrayBuffer(PublicKey.SERIALIZED_SIZE);
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
		return new PublicKey(buf.read(PublicKey.SERIALIZED_SIZE));
	}

	serialize(buf) {
		buf = buf || new Buffer(PublicKey.SERIALIZED_SIZE);
		buf.write(this);
		return buf;
	}

	serializedSize() {
		return 64;
	}

	toAddress() {
		return Crypto.publicToAddress(this)
					.then( address => new Address(address));
	}
}
