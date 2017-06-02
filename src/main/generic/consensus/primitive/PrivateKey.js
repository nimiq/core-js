class PrivateKey extends Primitive {
    constructor(arg) {
        super(arg, Crypto.privateKeyType, Crypto.privateKeySize);
    }

    static async generate() {
        return new PrivateKey(await Crypto.privateKeyGenerate());
    }

    static unserialize(buf) {
        return new PrivateKey(Crypto.privateKeyUnserialize(buf.read(Crypto.privateKeySize)));
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.write(Crypto.privateKeySerialize(this._obj));
        return buf;
    }

    get serializedSize() {
        return Crypto.privateKeySize;
    }

    equals(o) {
        return o instanceof PrivateKey && super.equals(o);
    }
}

Class.register(PrivateKey);
