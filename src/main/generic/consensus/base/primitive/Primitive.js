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
     * @param {Primitive} o
     * @return {number} negative if this is smaller than o, positive if this is larger than o, zero if equal.
     */
    compare(o) {
        if (typeof this._obj.compare === 'function') {
            return this._obj.compare(o._obj);
        } else if (this._obj.prototype === o._obj.prototype) {
            return BufferUtils.compare(this.serialize(), o.serialize());
        }

        throw new Error(`Incomparable types: ${this._obj.constructor.name} and ${o._obj.constructor.name}`);
    }

    hashCode() {
        return this.toBase64();
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
