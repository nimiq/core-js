class AccountAddress extends Primitive {

	static get SERIALIZED_SIZE() {
		return 20;
	}

	constructor(arg) {
		super(arg, AccountAddress.SERIALIZED_SIZE);
	}

	static unserialize(buf) {
		return new AccountAddress(buf.read(AccountAddress.SERIALIZED_SIZE));
	}

	serialize(buf) {
		buf = buf || new Buffer(this.serializedSize);
		buf.write(this);
		return buf;
	}

	get serializedSize() {
		return AccountAddress.SERIALIZED_SIZE;
	}

	equals(o) {
		return o instanceof AccountAddress
			&& super.equals(o);
	}
}
