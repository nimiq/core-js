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
     * @param {Array.<string>} childrenSuffixes
     * @param {Array.<Hash>} childrenHashes
     * @returns {AccountsTreeNode}
     */
    static branchNode(prefix, childrenSuffixes = [], childrenHashes = []) {
        if (childrenSuffixes.length !== childrenHashes.length) {
            throw new Error('Invalid list of children for branch node');
        }
        return new AccountsTreeNode(AccountsTreeNode.BRANCH, prefix, childrenSuffixes, childrenHashes);
    }

    /**
     * @param type
     * @param {string} prefix
     * @param {Account|Array.<string>} arg
     * @param {Array.<Hash>} [arg2]
     */
    constructor(type, prefix = '', arg, arg2 = []) {
        this._type = type;
        /** @type {string} */
        this._prefix = prefix;
        if (this.isBranch()) {
            /** @type {Array.<string>} */
            this._childrenSuffixes = arg;
            /** @type {Array.<Hash>} */
            this._childrenHashes = arg2;
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
            const childrenSuffixes = [], childrenHashes = [];
            const childCount = buf.readUint8();
            for (let i = 0; i < childCount; ++i) {
                const childSuffix = buf.readVarLengthString();
                const childHash = Hash.unserialize(buf);
                const childIndex = parseInt(childSuffix[0], 16);
                childrenSuffixes[childIndex] = childSuffix;
                childrenHashes[childIndex] = childHash;
            }
            return AccountsTreeNode.branchNode(prefix, childrenSuffixes, childrenHashes);
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
            const childCount = this._childrenSuffixes.reduce((count, child) => count + !!child, 0);
            buf.writeUint8(childCount);
            for (let i = 0; i < this._childrenSuffixes.length; ++i) {
                if (this._childrenHashes[i]) {
                    buf.writeVarLengthString(this._childrenSuffixes[i]);
                    this._childrenHashes[i].serialize(buf);
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
            const childrenSize = this._childrenHashes.reduce((sum, child, i) => {
                return sum + (child ? child.serializedSize + SerialBuffer.varLengthStringSize(this._childrenSuffixes[i]) : 0);
            }, 0);
            payloadSize = /*childCount*/ 1 + childrenSize;
        }

        return /*type*/ 1
            + SerialBuffer.varLengthStringSize(this._prefix)
            + payloadSize;
    }

    /**
     * @param {string} prefix
     * @returns {?Hash}
     */
    getChildHash(prefix) {
        return this._childrenHashes && this._childrenHashes[this._getChildIndex(prefix)];
    }

    /**
     * @param {string} prefix
     * @returns {?string}
     */
    getChild(prefix) {
        const suffix = this._childrenSuffixes && this._childrenSuffixes[this._getChildIndex(prefix)];
        if (suffix) {
            return this.prefix + suffix;
        }
        return suffix;
    }

    /**
     * @param {string} prefix
     * @param {Hash} childHash
     * @returns {AccountsTreeNode}
     */
    withChild(prefix, childHash) {
        const childrenSuffixes = this._childrenSuffixes.slice() || [];
        const childrenHashes = this._childrenHashes.slice() || [];
        childrenSuffixes[this._getChildIndex(prefix)] = prefix.substr(this.prefix.length);
        childrenHashes[this._getChildIndex(prefix)] = childHash;
        return AccountsTreeNode.branchNode(this._prefix, childrenSuffixes, childrenHashes);
    }

    /**
     * @param {string} prefix
     * @returns {AccountsTreeNode}
     */
    withoutChild(prefix) {
        const childrenSuffixes = this._childrenSuffixes.slice() || [];
        const childrenHashes = this._childrenHashes.slice() || [];
        delete childrenSuffixes[this._getChildIndex(prefix)];
        delete childrenHashes[this._getChildIndex(prefix)];
        return AccountsTreeNode.branchNode(this._prefix, childrenSuffixes, childrenHashes);
    }

    /**
     * @returns {boolean}
     */
    hasChildren() {
        return this._childrenSuffixes && this._childrenSuffixes.some(child => !!child);
    }

    /**
     * @returns {boolean}
     */
    hasSingleChild() {
        return this._childrenSuffixes && this._childrenSuffixes.reduce((count, child) => count + !!child, 0) === 1;
    }

    /**
     * @returns {?string}
     */
    getFirstChild() {
        if (!this._childrenSuffixes) {
            return undefined;
        }
        const suffix = this._childrenSuffixes.find(child => !!child);
        return suffix ? this.prefix + suffix : undefined;
    }

    /**
     * @returns {?string}
     */
    getLastChild() {
        if (!this._childrenSuffixes) {
            return undefined;
        }
        for (let i = this._childrenSuffixes.length - 1; i >= 0; --i) {
            if (this._childrenSuffixes[i]) {
                return this.prefix + this._childrenSuffixes[i];
            }
        }
        return undefined;
    }

    /**
     * @returns {?Array.<string>}
     */
    getChildren() {
        if (!this._childrenSuffixes) {
            return undefined;
        }
        return this._childrenSuffixes.filter(child => !!child).map(child => this.prefix + child);
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
     * @returns {Hash}
     */
    hash() {
        if (!this._hash) {
            this._hash = Hash.light(this.serialize());
        }
        return this._hash;
    }

    /**
     * Tests if this node is a child of some other node.
     * @param {AccountsTreeNode} parent
     * @returns {boolean}
     */
    isChildOf(parent) {
        return parent.getChildren() && parent.getChildren().includes(this._prefix);
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
        Assert.that(prefix.substr(0, this.prefix.length) === this.prefix, `Prefix ${prefix} is not a child of the current node ${this.prefix}`);
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
            if (this._childrenSuffixes.length !== o._childrenSuffixes.length) return false;
            if (o._childrenSuffixes.length !== o._childrenHashes.length) return false;
            for (let i = 0; i < this._childrenSuffixes.length; ++i) {
                // hashes of child nodes
                const ourChild = this._childrenHashes[i];
                const otherChild = o._childrenHashes[i];
                if (ourChild) {
                    if (!otherChild || !ourChild.equals(otherChild)) return false;
                } else {
                    if (otherChild) return false;
                }
                if (this._childrenSuffixes[i] !== o._childrenSuffixes[i]) return false;
            }
        }
        return true;
    }
}
AccountsTreeNode.BRANCH = 0x00;
AccountsTreeNode.TERMINAL = 0xff;
Class.register(AccountsTreeNode);
