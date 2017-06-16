class PublicKey extends Primitive {
    constructor(arg) {
        super(arg, Crypto.publicKeyType, Crypto.publicKeySize);
    }

    static async derive(privateKey) {
        return new PublicKey(await Crypto.publicKeyDerive(privateKey._obj));
    }

    static unserialize(buf) {
        return new PublicKey(Crypto.publicKeyUnserialize(buf.read(Crypto.publicKeySize)));
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.write(Crypto.publicKeySerialize(this._obj));
        return buf;
    }

    get serializedSize() {
        return Crypto.publicKeySize;
    }

    equals(o) {
        return o instanceof PublicKey && super.equals(o);
    }

    async toAddress() {
        return new Address((await Hash.light(this.serialize())).subarray(0, 20));
    }
}
Class.register(PublicKey);
