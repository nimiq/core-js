class Hash extends Primitive {

	static get SERIALIZED_SIZE() {
		return 32;
	}

	constructor(arg) {
		super(arg, Hash.SERIALIZED_SIZE);
	}

	static unserialize(buf) {
		return new Hash(buf.read(Hash.SERIALIZED_SIZE));
	}

	serialize(buf) {
		buf = buf || new Buffer(this.serializedSize);
		buf.write(this);
		return buf;
	}

    get serializedSize() {
        return Hash.SERIALIZED_SIZE;
    }

	equals(o) {
		return o instanceof Hash
			&& super.equals(o);
	}

	static fromBase64(base64) {
		return new Hash(BufferUtils.fromBase64(base64));
	}

	static isHash(o) {
		return o instanceof Hash;
	}
}
