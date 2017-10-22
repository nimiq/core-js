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
     * @param {Array.<Hash>} children
     * @returns {AccountsTreeNode}
     */
    static branchNode(prefix, children) {
        return new AccountsTreeNode(AccountsTreeNode.BRANCH, prefix, children);
    }

    /**
     * @param {{_type, _prefix, ?_children, ?_account}} o
     * @returns {AccountsTreeNode}
     */
    static copy(o) {
        if (!o) return o;
        let arg;
        if (AccountsTreeNode.isBranchType(o._type)) {
            arg = o._children.map(it => Hash.copy(it));
        } else {
            arg = Account.copy(o._account);
        }
        return new AccountsTreeNode(o._type, o._prefix, arg);
    }

    /**
     * @param type
     * @param {string} prefix
     * @param {Account|Array.<Hash>} arg
     */
    constructor(type, prefix = '', arg) {
        this._type = type;
        this._prefix = prefix;
        if (this.isBranch()) {
            /** @type {Array.<Hash>} */
            this._children = arg;
        } else if (this.isTerminal()) {
            /** @type {Account} */
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
                const child = Hash.unserialize(buf);
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
            const childCount = this._children.reduce((count, child) => count + !!child, 0);
            buf.writeUint8(childCount);
            for (let i = 0; i < this._children.length; ++i) {
                if (this._children[i]) {
                    buf.writeUint8(i);
                    this._children[i].serialize(buf);
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
            const childrenSize = this._children.reduce((sum, child) => sum + (child ? child.serializedSize + /*childIndex*/ 1 : 0), 0);
            payloadSize = /*childCount*/ 1 + childrenSize;
        }

        return /*type*/ 1
            + /*extra byte varLengthString prefix*/ 1
            + this._prefix.length
            + payloadSize;
    }

    /**
     * @param {string} prefix
     * @returns {Hash}
     */
    getChildHash(prefix) {
        return this._children && this._children[this._getChildIndex(prefix)];
    }

    /**
     * @param {string} prefix
     * @returns {string|boolean}
     */
    getChild(prefix) {
        if (this._children && this._children[this._getChildIndex(prefix)]) {
            return prefix.substr(0, this.prefix.length + 1);
        }
        return false;
    }

    /**
     * @param {string} prefix
     * @param {Hash} child
     * @returns {AccountsTreeNode}
     */
    withChild(prefix, child) {
        const children = this._children.slice() || [];
        children[this._getChildIndex(prefix)] = child;
        return AccountsTreeNode.branchNode(this._prefix, children);
    }

    /**
     * @param {string} prefix
     * @returns {AccountsTreeNode}
     */
    withoutChild(prefix) {
        const children = this._children.slice() || [];
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
        return this._children && this._children.reduce((count, child) => count + !!child, 0) === 1;
    }

    /**
     * @returns {?string}
     */
    getFirstChild() {
        if (!this._children) {
            return undefined;
        }
        return this.prefix + this._children.findIndex(child => !!child).toString(16);
    }

    /**
     * @returns {?Array.<string>}
     */
    getChildren() {
        if (!this._children) {
            return undefined;
        }
        return this._children.map((child, index) => !!child ? this.prefix + index.toString(16) : undefined)
            .filter(child => !!child);
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
     * @returns {Promise.<Hash>}
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
        Assert.that(prefix.substr(0, this.prefix.length) === this.prefix, 'Prefix is not a child of the current node');
        return parseInt(prefix[this.prefix.length], 16);
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
                    if (!otherChild || !ourChild.equals(otherChild)) return false;
                } else {
                    if (otherChild) return false;
                }
            }
        }
        return true;
    }

    /**
     * @return {AccountsTreeNode}
     */
    clone() {
        return AccountsTreeNode.unserialize(this.serialize());
    }
}
AccountsTreeNode.BRANCH = 0x00;
AccountsTreeNode.TERMINAL = 0xff;
Class.register(AccountsTreeNode);
