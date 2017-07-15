class Account {
    constructor(balance) {
        if (!balance || !(balance instanceof Balance)) throw 'Malformed balance';
        /** @type {Balance} */
        this._balance = balance;
    }

    /**
     * Create Account object from binary form.
     * @param {SerialBuffer} buf Buffer to read from.
     * @return {Account} Newly created Account object.
     */
    static unserialize(buf) {
        // We currently only support one account type: Basic.
        const type = buf.readUint8();
        if (type !== Account.Type.BASIC) throw 'Malformed account type';

        const balance = Balance.unserialize(buf);
        return new Account(balance);
    }

    /**
     * Serialize this Account object into binary form.
     * @param {?SerialBuffer} buf Buffer to write to.
     * @return {SerialBuffer} Buffer from `buf` or newly generated one.
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.writeUint8(Account.Type.BASIC);
        this._balance.serialize(buf);
        return buf;
    }

    /**
     * @return {number}
     */
    get serializedSize() {
        return /*type*/ 1
            + this._balance.serializedSize;
    }

    /**
     * Check if two Accounts are the same.
     * @param {Account} o Object to compare with.
     * @return {boolean} Set if both objects describe the same data.
     */
    equals(o) {
        return o instanceof Account
            && this._balance.equals(o.balance);
    }

    toString() {
        return `BasicAccount{value=${this._balance.value}, nonce=${this._balance.nonce}}`;
    }

    /**
     * @return {Balance} Account balance
     */
    get balance() {
        return this._balance;
    }
}
Account.INITIAL = new Account(Balance.INITIAL);
/**
 * Enum for Account types.
 * @enum {number}
 */
Account.Type = {};
Account.Type.BASIC = 0;
Class.register(Account);
