class Address extends Uint8Array {

	constructor(arg) {
		let buffer;
		if (!arg) {
			buffer = new ArrayBuffer(Address.SERIALIZED_SIZE);
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
		return new Address(buf.read(Address.SERIALIZED_SIZE));
	}

	serialize(buf) {
		buf = buf || new Buffer(Address.SERIALIZED_SIZE);
		buf.write(this);
		return buf;
	}

	serializedSize() {
		return 22;
	}
}
