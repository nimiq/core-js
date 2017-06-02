class Primitive {
    constructor(arg, type, length) {
        if (type && !(arg instanceof type)) throw 'Primitive: Invalid type';
        if (length && arg.length && arg.length !== length) throw 'Primitive: Invalid length';
        this._obj = arg;
    }

    equals(o) {
        return o instanceof Primitive && BufferUtils.equals(this.serialize(), o.serialize());
    }

    serialize() {
        throw 'Primitive: serialize() not implemented';
    }

    toString() {
        return this.toBase64();
    }

    toBase64() {
        return BufferUtils.toBase64(this.serialize());
    }

    toHex() {
        return BufferUtils.toHex(this.serialize());
    }
}
Class.register(Primitive);
