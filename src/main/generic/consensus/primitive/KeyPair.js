class KeyPair extends Primitive {
    constructor(arg) {
        super(arg, Crypto.keyPairType);
    }

    static async generate() {
        return new KeyPair(await Crypto.keyPairGenerate());
    }

    static async derive(privateKey) {
        return new KeyPair(await Crypto.keyPairDerive(privateKey._obj));
    }

    static unserialize(buf) {
        return new KeyPair(Crypto.keyPairDerive(Crypto.privateKeyUnserialize(buf.read(Crypto.privateKeySize))));
    }

    static fromHex(hexBuf) {
        return this.unserialize(BufferUtils.fromHex(hexBuf));
    }

    serialize(buf) {
        return this.privateKey.serialize(buf);
    }

    get privateKey() {
        return this._privateKey || (this._privateKey = new PrivateKey(Crypto.keyPairPrivate(this._obj)));
    }

    get publicKey() {
        return this._publicKey || (this._publicKey = new PublicKey(Crypto.keyPairPublic(this._obj)));
    }

    get serializedSize() {
        return this.privateKey.serializedSize;
    }

    equals(o) {
        return o instanceof KeyPair && super.equals(o);
    }
}

Class.register(KeyPair);
