/**
 * @abstract
 */
class Primitive {
    /**
     * @param arg
     * @param type
     * @param {?number} length
     */
    constructor(arg, type, length) {
        if (type && !(arg instanceof type)) throw 'Primitive: Invalid type';
        if (length && arg.length && arg.length !== length) throw 'Primitive: Invalid length';
        this._obj = arg;
    }

    /**
     * @param {Primitive} o
     * @return {boolean}
     */
    equals(o) {
        return o instanceof Primitive && BufferUtils.equals(this.serialize(), o.serialize());
    }

    /**
     * @abstract
     * @param {SerialBuffer} [buf]
     */
    serialize(buf) {}

    /**
     * @return {string}
     */
    toString() {
        return this.toBase64();
    }

    /**
     * @return {string}
     */
    toBase64() {
        return BufferUtils.toBase64(this.serialize());
    }

    /**
     * @return {string}
     */
    toHex() {
        return BufferUtils.toHex(this.serialize());
    }
}
Class.register(Primitive);
