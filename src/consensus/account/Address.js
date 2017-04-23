class Address extends Primitive {

	static get SERIALIZED_SIZE() {
		return 20;
	}

	constructor(arg) {
		super(arg, Address.SERIALIZED_SIZE);
	}

	static cast(o) {
		return ObjectUtils.cast(o, Address);
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

	equals(o) {
		return o instanceof Address
			&& super.equals(o);
	}
}
