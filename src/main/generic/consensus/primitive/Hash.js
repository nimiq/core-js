class Hash extends Primitive {
    constructor(arg) {
        if (arg === null) {
            arg = new Uint8Array(Crypto.hashSize);
        }
        super(arg, Crypto.hashType, Crypto.hashSize);
    }

    static async light(arr) {
        return new Hash(await Crypto.hashLight(arr));
    }

    static async hard(arr) {
        return new Hash(await Crypto.hashHard(arr));
    }

    static unserialize(buf) {
        return new Hash(buf.read(Crypto.hashSize));
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.write(this._obj);
        return buf;
    }

    subarray(begin, end) {
        return this._obj.subarray(begin, end);
    }

    get serializedSize() {
        return Crypto.hashSize;
    }

    equals(o) {
        return o instanceof Hash && super.equals(o);
    }

    static fromBase64(base64) {
        return new Hash(BufferUtils.fromBase64(base64));
    }

    static fromHex(hex) {
        return new Hash(BufferUtils.fromHex(hex));
    }

    static isHash(o) {
        return o instanceof Hash;
    }
}
Class.register(Hash);
