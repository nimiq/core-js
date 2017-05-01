class Address extends Primitive {

	static get SERIALIZED_SIZE() {
		return 20;
	}

	constructor(arg) {
		super(arg, Address.SERIALIZED_SIZE);
	}

	static unserialize(buf) {
		return new Address(buf.read(Address.SERIALIZED_SIZE));
	}

	serialize(buf) {
		buf = buf || new SerialBuffer(this.serializedSize);
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
Class.register(Address);
