class Signature extends Primitive {

    static get SERIALIZED_SIZE() {
        return 64;
    }

    constructor(arg) {
        super(arg, Signature.SERIALIZED_SIZE);
    }

    static unserialize(buf) {
        return new Signature(buf.read(Signature.SERIALIZED_SIZE));
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.write(this);
        return buf;
    }

    get serializedSize() {
        return Signature.SERIALIZED_SIZE;
    }

    equals(o) {
        return o instanceof Signature
            && super.equals(o);
    }
}
Class.register(Signature);
