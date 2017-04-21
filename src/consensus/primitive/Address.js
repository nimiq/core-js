class Address extends Uint8Array {

	static get SERIALIZED_SIZE() {
		return 22;
	}

	constructor(arg) {
		super(arg, Address.SERIALIZED_SIZE);
	}

	static unserialize(buf) {
		return new Address(buf.read(Address.SERIALIZED_SIZE));
	}

	serialize(buf) {
		buf = buf || new Buffer(this.serializedSize);
		buf.write(this);
		return buf;
	}

	get serializedSize() {
		return Address.SERIALIZED_SIZE;
	}
}
