class ChainProof {
    constructor(prefix, suffix) {
        if (!(prefix instanceof Chain) || !prefix.length) throw new Error('Malformed prefix');
        if (!(suffix instanceof Chain)) throw new Error('Malformed suffix');

        /** @type {Chain} */
        this._prefix = prefix;
        /** @type {Chain} */
        this._suffix = suffix;
    }

    static unserialize(buf) {
        const prefix = Chain.unserialize(buf);
        const suffix = Chain.unserialize(buf);
        return new ChainProof(prefix, suffix);
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        this._prefix.serialize(buf);
        this._suffix.serialize(buf);
        return buf;
    }

    get serializedSize() {
        return this._prefix.serializedSize
            + this._suffix.serializedSize;
    }

    /**
     * @returns {Promise.<boolean>}
     */
    async verify() {
        // Check that the prefix chain is anchored.
        if (!this._prefix.isAnchored()) {
            return false;
        }

        // Check that both prefix and suffix are valid chains.
        if (!(await this._prefix.verify()) || !(await this._suffix.verify())) {
            return false;
        }

        // Check that the suffix is dense.
        if (!(await this._suffix.isDense())) {
            return false;
        }

        // Check that the suffix connects to the prefix.
        if (this._suffix.length > 0 && !(await this._suffix.tail.isImmediateSuccessorOf(this._prefix.head))) {
            return false;
        }

        // Everything checks out.
        return true;
    }

    /**
     * @returns {string}
     */
    toString() {
        return `ChainProof{prefix=${this._prefix.length}, suffix=${this._suffix.length}, height=${this.head.height}}`;
    }

    /** @type {Chain} */
    get prefix() {
        return this._prefix;
    }

    /** @type {Chain} */
    get suffix() {
        return this._suffix;
    }

    /** @type {Block} */
    get head() {
        return this._suffix.length > 0 ? this._suffix.head : this._prefix.head;
    }

    /** @type {Block} */
    get tail() {
        return this._prefix.tail;
    }
}
