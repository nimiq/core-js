class AccountsProof {
    /**
     * @param {SerialBuffer} buf
     * @returns {AccountsProof}
     */
    static unserialize(buf) {
        return null;
    }

    /**
     * @param {?SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);

        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return 0;
    }
}
Class.register(AccountsProof);
