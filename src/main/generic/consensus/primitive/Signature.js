class Signature extends Primitive {
    constructor(arg) {
        super(arg, Crypto.signatureType, Crypto.signatureSize);
    }

    static async create(privateKey, data) {
        return new Signature(await Crypto.signatureCreate(privateKey._obj, data));
    }

    static unserialize(buf) {
        return new Signature(Crypto.signatureUnserialize(buf.read(Crypto.signatureSize)));
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.write(Crypto.signatureSerialize(this._obj));
        return buf;
    }

    get serializedSize() {
        return Crypto.signatureSize;
    }

    verify(publicKey, data) {
        return Crypto.signatureVerify(publicKey._obj, data, this._obj);
    }

    equals(o) {
        return o instanceof Signature && super.equals(o);
    }
}
Class.register(Signature);
