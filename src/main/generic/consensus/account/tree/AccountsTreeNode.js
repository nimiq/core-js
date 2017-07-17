class AccountsTreeNode {
    /**
     * @param {string} prefix
     * @param {Account} account
     * @returns {AccountsTreeNode}
     */
    static terminalNode(prefix, account) {
        return new AccountsTreeNode(AccountsTreeNode.TERMINAL, prefix, account);
    }

    /**
     * @param {string} prefix
     * @param {Array.<string>} children
     * @returns {AccountsTreeNode}
     */
    static branchNode(prefix, children) {
        return new AccountsTreeNode(AccountsTreeNode.BRANCH, prefix, children);
    }

    /**
     * @param type
     * @param {string} prefix
     * @param {Account|Array.<string>} arg
     */
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

    /**
     * @param type
     * @returns {boolean}
     */
    static isTerminalType(type) {
        return type === AccountsTreeNode.TERMINAL;
    }

    /**
     * @param type
     * @returns {boolean}
     */
    static isBranchType(type) {
        return type === AccountsTreeNode.BRANCH;
    }


    /**
     * @param {SerialBuffer} buf
     * @returns {AccountsTreeNode}
     */
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

    /** @type {number} */
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

    /**
     * @param {string} prefix
     * @returns {string}
     */
    getChild(prefix) {
        return this._children && this._children[this._getChildIndex(prefix)];
    }

    /**
     * @param {string} prefix
     * @param {string} child
     * @returns {AccountsTreeNode}
     */
    withChild(prefix, child) {
        let children = this._children.slice() || [];
        children[this._getChildIndex(prefix)] = child;
        return AccountsTreeNode.branchNode(this._prefix, children);
    }

    /**
     * @param {string} prefix
     * @returns {AccountsTreeNode}
     */
    withoutChild(prefix) {
        let children = this._children.slice() || [];
        delete children[this._getChildIndex(prefix)];
        return AccountsTreeNode.branchNode(this._prefix, children);
    }

    /**
     * @returns {boolean}
     */
    hasChildren() {
        return this._children && this._children.some(child => !!child);
    }

    /**
     * @returns {boolean}
     */
    hasSingleChild() {
        return this._children && this._children.reduce((count, val) => count + !!val, 0) === 1;
    }

    /**
     * @returns {?string}
     */
    getFirstChild() {
        if (!this._children) {
            return undefined;
        }
        return this._children.find(child => !!child);
    }

    /**
     * @returns {?Array.<string>}
     */
    getChildren() {
        if (!this._children) {
            return undefined;
        }
        return this._children.filter(child => !!child);
    }

    /** @type {Account} */
    get account() {
        return this._account;
    }

    /** @type {string} */
    get prefix() {
        return this._prefix;
    }

    /** @type {string} */
    set prefix(value) {
        this._prefix = value;
        this._hash = undefined;
    }

    /**
     * @param {Account} account
     * @returns {AccountsTreeNode}
     */
    withAccount(account) {
        return AccountsTreeNode.terminalNode(this._prefix, account);
    }

    /**
     * @returns {Promise.<string>}
     */
    async hash() {
        if (!this._hash) {
            this._hash = await Hash.light(this.serialize());
        }
        return this._hash;
    }

    /**
     * @returns {boolean}
     */
    isTerminal() {
        return AccountsTreeNode.isTerminalType(this._type);
    }

    /**
     * @returns {boolean}
     */
    isBranch() {
        return AccountsTreeNode.isBranchType(this._type);
    }

    /**
     * @param {string} prefix
     * @returns {number}
     * @private
     */
    _getChildIndex(prefix) {
        return parseInt(prefix[0], 16);
    }

    /**
     * @param {AccountsTreeNode} o
     * @returns {boolean}
     */
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
