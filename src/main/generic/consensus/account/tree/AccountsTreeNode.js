class AccountsTreeNode {
    static terminalNode(prefix, account) {
        return new AccountsTreeNode(AccountsTreeNode.TERMINAL, prefix, account);
    }

    static branchNode(prefix, children) {
        return new AccountsTreeNode(AccountsTreeNode.BRANCH, prefix, children);
    }

    constructor(type, prefix = '', arg) {
        this._type = type;
        this._prefix = prefix;
        if (this.isBranch()) {
            this._children = arg;
        } else if (this.isTerminal()){
            this._account = arg;
        } else {
            throw `Invalid AccountsTreeNode type: ${type}`;
        }
    }

    static isTerminalType(type) {
        return type === AccountsTreeNode.TERMINAL;
    }

    static isBranchType(type) {
        return type === AccountsTreeNode.BRANCH;
    }


    static unserialize(buf) {
        const type = buf.readUint8();
        const prefix = buf.readVarLengthString();

        if (AccountsTreeNode.isTerminalType(type)) {
            // Terminal node
            const account = Account.unserialize(buf);
            return AccountsTreeNode.terminalNode(prefix, account);
        } else if (AccountsTreeNode.isBranchType(type)) {
            // Branch node
            const children = [];
            const childCount = buf.readUint8();
            for (let i = 0; i < childCount; ++i) {
                const childIndex = buf.readUint8();
                const child = BufferUtils.toBase64(buf.read(/*keySize*/ 32));
                children[childIndex] = child;
            }
            return AccountsTreeNode.branchNode(prefix, children);
        } else {
            throw `Invalid AccountsTreeNode type: ${type}`;
        }
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.writeUint8(this._type);
        buf.writeVarLengthString(this._prefix);

        if (this.isTerminal()) {
            // Terminal node
            this._account.serialize(buf);
        } else {
            // Branch node
            const childCount = this._children.reduce((count, val) => count + !!val, 0);
            buf.writeUint8(childCount);
            for (let i = 0; i < this._children.length; ++i) {
                if (this._children[i]) {
                    buf.writeUint8(i);
                    buf.write(BufferUtils.fromBase64(this._children[i]));
                }
            }
        }
        return buf;
    }

    get serializedSize() {
        let payloadSize;
        if (this.isTerminal()) {
            payloadSize = this._account.serializedSize;
        } else {
            // The children array contains undefined values for non existing children.
            // Only count existing ones.
            const childrenSize = this._children.reduce((count, val) => count + !!val, 0)
                * (/*keySize*/ 32 + /*childIndex*/ 1);
            payloadSize = /*childCount*/ 1 + childrenSize;
        }

        return /*type*/ 1
            + /*extra byte varLengthString prefix*/ 1
            + this._prefix.length
            + payloadSize;
    }

    getChild(prefix) {
        return this._children && this._children[this._getChildIndex(prefix)];
    }

    withChild(prefix, child) {
        let children = this._children.slice() || [];
        children[this._getChildIndex(prefix)] = child;
        return AccountsTreeNode.branchNode(this._prefix, children);
    }

    withoutChild(prefix) {
        let children = this._children.slice() || [];
        delete children[this._getChildIndex(prefix)];
        return AccountsTreeNode.branchNode(this._prefix, children);
    }

    hasChildren() {
        return this._children && this._children.some(child => !!child);
    }

    hasSingleChild() {
        return this._children && this._children.reduce((count, val) => count + !!val, 0) === 1;
    }

    getFirstChild() {
        if (!this._children) {
            return undefined;
        }
        return this._children.find(child => !!child);
    }

    getChildren() {
        if (!this._children) {
            return undefined;
        }
        return this._children.filter(child => !!child);
    }

    get account() {
        return this._account;
    }

    get prefix() {
        return this._prefix;
    }

    set prefix(value) {
        this._prefix = value;
        this._hash = undefined;
    }

    withAccount(account) {
        return AccountsTreeNode.terminalNode(this._prefix, account);
    }

    async hash() {
        if (!this._hash) {
            this._hash = await Hash.light(this.serialize());
        }
        return this._hash;
    }

    isTerminal() {
        return AccountsTreeNode.isTerminalType(this._type);
    }

    isBranch() {
        return AccountsTreeNode.isBranchType(this._type);
    }

    _getChildIndex(prefix) {
        return parseInt(prefix[0], 16);
    }

    equals(o) {
        if (!(o instanceof AccountsTreeNode)) return false;
        if (!Object.is(this.prefix, o.prefix)) return false;
        if (this.isTerminal()) {
            return o.isTerminal() && o._account.equals(this._account);
        } else {
            if (!o.isBranch()) return false;
            for (let i = 0; i < this._children.length; ++i) {
                // hashes of child nodes
                const ourChild = this._children[i];
                const otherChild = o._children[i];
                if (ourChild) {
                    if (!otherChild || !Object.is(ourChild, otherChild)) return false;
                } else {
                    if (otherChild) return false;
                }
            }
        }
        return true;
    }
}
AccountsTreeNode.BRANCH = 0x00;
AccountsTreeNode.TERMINAL = 0xff;
Class.register(AccountsTreeNode);
