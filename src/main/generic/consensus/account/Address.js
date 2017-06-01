class Address extends Primitive {

    static get SERIALIZED_SIZE() {
        return 20;
    }

    constructor(arg) {
        super(arg, Uint8Array, Address.SERIALIZED_SIZE);
    }

    static unserialize(buf) {
        return new Address(buf.read(Address.SERIALIZED_SIZE));
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
        return Address.SERIALIZED_SIZE;
    }

    equals(o) {
        return o instanceof Address
            && super.equals(o);
    }
}
Class.register(Address);
