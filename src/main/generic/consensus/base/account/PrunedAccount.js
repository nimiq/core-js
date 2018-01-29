class PrunedAccount {
    /**
     * @param {Address} address
     * @param {Account} account
     */
    constructor(address, account) {
        /** @type {Address} */
        this._address = address;
        /** @type {Account} */
        this._account = account;
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {PrunedAccount}
     */
    static unserialize(buf) {
        return new PrunedAccount(Address.unserialize(buf), Account.unserialize(buf));
    }

    /**
     * @returns {Address}
     */
    get address() {
        return this._address;
    }

    /**
     * @returns {Account}
     */
    get account() {
        return this._account;
    }

    /**
     * @param buf
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        this._address.serialize(buf);
        this._account.serialize(buf);
        return this;
    }

    get serializedSize() {
        return this._address.serializedSize + this._account.serializedSize;
    }
}

Class.register(PrunedAccount);
