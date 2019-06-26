class PrunedAccount {
    /**
     * @param {Address} address
     * @param {Account} account
     */
    constructor(address, account) {
        if (!(address instanceof Address)) throw new Error('Malformed address');

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
     * @param {PrunedAccount|object} o
     * @returns {PrunedAccount}
     */
    static fromAny(o) {
        if (o instanceof PrunedAccount) return o;
        return PrunedAccount.fromPlain(o);
    }

    /**
     * @param {object} plain
     */
    static fromPlain(plain) {
        return new PrunedAccount(Address.fromAny(plain.address), Account.fromAny(plain.account));
    }

    /**
     * @param {PrunedAccount} o
     * @return {number} negative if this is smaller than o, positive if this is larger than o, zero if equal.
     */
    compare(o) {
        return this._address.compare(o._address);
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

    /**
     * @returns {number}
     */
    get serializedSize() {
        return this._address.serializedSize + this._account.serializedSize;
    }

    /**
     * @returns {string}
     */
    hashCode() {
        return this._address.hashCode();
    }

    /**
     * @returns {object}
     */
    toPlain() {
        return {
            address: this.address.toPlain(),
            account: this.account.toPlain()
        };
    }
}

Class.register(PrunedAccount);
