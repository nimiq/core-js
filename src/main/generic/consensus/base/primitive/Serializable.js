/**
 * @abstract
 */
class Serializable {
    /**
     * @param {Serializable} o
     * @return {boolean}
     */
    equals(o) {
        return o instanceof Serializable && BufferUtils.equals(this.serialize(), o.serialize());
    }

    /**
     * @param {Serializable} o
     * @return {number} negative if this is smaller than o, positive if this is larger than o, zero if equal.
     */
    compare(o) {
        return BufferUtils.compare(this.serialize(), o.serialize());
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

Class.register(Serializable);
