class PrivateKey extends Primitive {

    static get SERIALIZED_SIZE() {
        return 64;
    }

    constructor(arg) {
        super(arg, PrivateKey.SERIALIZED_SIZE);
    }

    static unserialize(buf) {
        return new PublicKey(buf.read(PrivateKey.SERIALIZED_SIZE));
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.write(this);
        return buf;
    }

    get serializedSize() {
        return PrivateKey.SERIALIZED_SIZE;
    }

    equals(o) {
        return o instanceof PrivateKey
            && super.equals(o);
    }
}

Class.register(PrivateKey);
