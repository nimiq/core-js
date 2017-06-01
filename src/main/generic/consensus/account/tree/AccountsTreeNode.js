class AccountsTreeNode {
    static terminalNode(prefix, account) {
        return new AccountsTreeNode(AccountsTreeNode.TERMINAL, prefix, account);
    }

    static branchNode(prefix, children) {
        return new AccountsTreeNode(AccountsTreeNode.BRANCH, prefix, children);
    }


    constructor(type, prefix, arg) {
        this._type = type;
        this.prefix = prefix;
        if (type === AccountsTreeNode.BRANCH) {
            this._children = arg;
        } else {
            this._account = arg;
        }
    }

    static cast(o) {
        if (!o) return o;
        ObjectUtils.cast(o, AccountsTreeNode);
        Account.cast(o._account);
        return o;
    }

    static unserialize(buf) {
        const type = buf.readUint8();
        const prefixLength = buf.readUint8();
        const prefix = buf.read(prefixLength);

        if (type === AccountsTreeNode.TERMINAL) {
            // Terminal node
            const account = Account.unserialize(buf);
            return AccountsTreeNode.terminalNode(prefix, account);
        } else if (type === AccountsTreeNode.BRANCH) {
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
        buf.writeUint8(this.prefix.byteLength);
        buf.write(this.prefix);

        if (this._type === AccountsTreeNode.TERMINAL) {
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
        if (this._type === AccountsTreeNode.TERMINAL) {
            payloadSize = this._account.serializedSize;
        } else {
            // The children array contains undefined values for non existing children.
            // Only count existing ones.
            const childrenSize = this._children.reduce((count, val) => count + !!val, 0)
                * (/*keySize*/ 32 + /*childIndex*/ 1);
            payloadSize = /*childCount*/ 1 + childrenSize;
        }

        return /*type*/ 1
            + /*prefixLength*/ 1
            + this.prefix.byteLength
            + payloadSize;
    }

    getChild(prefix) {
        return this._children && this._children[prefix[0]];
    }

    putChild(prefix, child) {
        this._children = this._children || [];
        this._children[prefix[0]] = child;
    }

    removeChild(prefix) {
        if (this._children) delete this._children[prefix[0]];
    }

    hasChildren() {
        return this._children && this._children.some(child => !!child);
    }

    hash() {
        return Crypto.sha256(this.serialize());
    }
}
AccountsTreeNode.BRANCH = 0x00;
AccountsTreeNode.TERMINAL = 0xff;
Class.register(AccountsTreeNode);
