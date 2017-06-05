class Account {
    constructor(balance) {
        if (!balance || !(balance instanceof Balance)) throw 'Malformed balance';
        this._balance = balance;
    }

    static unserialize(buf) {
        // We currently only support one account type: Basic.
        const type = buf.readUint8();
        if (type !== Account.Type.BASIC) throw 'Malformed account type';

        const balance = Balance.unserialize(buf);
        return new Account(balance);
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.writeUint8(Account.Type.BASIC);
        this._balance.serialize(buf);
        return buf;
    }

    get serializedSize() {
        return /*type*/ 1
            + this._balance.serializedSize;
    }

    equals(o) {
        return o instanceof Account
            && this._balance.equals(o.balance);
    }

    toString() {
        return `BasicAccount{value=${this._balance.value}, nonce=${this._balance.nonce}}`;
    }

    get balance() {
        return this._balance;
    }
}
Account.INITIAL = new Account(Balance.INITIAL);
Account.Type = {};
Account.Type.BASIC = 0;
Class.register(Account);
