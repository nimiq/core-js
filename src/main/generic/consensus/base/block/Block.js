class Block {
    /**
     * @param {Block} o
     * @returns {Block}
     */
    static copy(o) {
        if (!o) return o;

        // FIXME Remove version switch for mainnet.
        let interlink = null;
        switch (o._header.version) {
            case BlockHeader.Version.LUNA_V1:
                interlink = BlockInterlinkLegacyV1.copy(o._interlink);
                break;
            case BlockHeader.Version.LUNA_V2:
                interlink = BlockInterlinkLegacyV2.copy(o._interlink);
                break;
            default:
                interlink = BlockInterlink.copy(o._interlink);
        }

        return new Block(
            BlockHeader.copy(o._header),
            interlink,
            BlockBody.copy(o._body)
        );
    }

    /**
     * @param {BlockHeader} header
     * @param {BlockInterlink} interlink
     * @param {BlockBody} [body]
     */
    constructor(header, interlink, body) {
        if (!(header instanceof BlockHeader)) throw 'Malformed header';
        if (!(interlink instanceof BlockInterlink)) throw 'Malformed interlink';
        if (body && !(body instanceof BlockBody)) throw 'Malformed body';

        /** @type {BlockHeader} */
        this._header = header;
        /** @type {BlockInterlink} */
        this._interlink = interlink;
        /** @type {BlockBody} */
        this._body = body;
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {Block}
     */
    static unserialize(buf) {
        const header = BlockHeader.unserialize(buf);

        // FIXME: Remove version switch for mainnet.
        let interlink = null;
        switch (header.version) {
            case BlockHeader.Version.LUNA_V1:
                interlink = BlockInterlinkLegacyV1.unserialize(buf, header.prevHash);
                break;
            case BlockHeader.Version.LUNA_V2:
                interlink = BlockInterlinkLegacyV2.unserialize(buf, header.prevHash);
                break;
            default:
                interlink = BlockInterlink.unserialize(buf, header.prevHash);
        }

        let body = undefined;
        const bodyPresent = buf.readUint8();
        if (bodyPresent) {
            body = BlockBody.unserialize(buf);
        }

        return new Block(header, interlink, body);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        this._header.serialize(buf);
        this._interlink.serialize(buf);

        if (this._body) {
            buf.writeUint8(1);
            this._body.serialize(buf);
        } else {
            buf.writeUint8(0);
        }

        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return this._header.serializedSize
            + this._interlink.serializedSize
            + /*bodyPresent*/ 1
            + (this._body ? this._body.serializedSize : 0);
    }

    /**
     * @returns {Promise.<boolean>}
     */
    async verify() {
        // Check that the timestamp is not too far into the future.
        if (this._header.timestamp * 1000 > Time.now() + Block.TIMESTAMP_DRIFT_MAX * 1000) {
            Log.w(Block, 'Invalid block - timestamp too far in the future');
            return false;
        }

        // Check that the header hash matches the difficulty.
        if (!(await this._header.verifyProofOfWork())) {
            Log.w(Block, 'Invalid block - PoW verification failed');
            return false;
        }

        // Check that the maximum block size is not exceeded.
        if (this.serializedSize > Policy.BLOCK_SIZE_MAX) {
            Log.w(Block, 'Invalid block - max block size exceeded');
            return false;
        }

        // Verify that the interlink is valid.
        if (!(await this._verifyInterlink())) {
            return false;
        }

        // XXX Verify the body only if it is present.
        if (this.isFull() && !(await this._verifyBody())) {
            return false;
        }

        // Everything checks out.
        return true;
    }

    /**
     * @returns {Promise.<boolean>}
     * @private
     */
    async _verifyInterlink() {
        // The genesis block has an empty interlink. Skip all interlink checks for it.
        if (this.height === 1) {
            return true;
        }

        // Check that the interlink contains at least one block.
        if (this._interlink.length === 0) {
            Log.w(Block, 'Invalid block - empty interlink');
            return false;
        }

        // Check that the interlinkHash given in the header matches the actual interlinkHash.
        const interlinkHash = await this._interlink.hash();
        if (!this._header.interlinkHash.equals(interlinkHash)) {
            Log.w(Block, 'Invalid block - interlink hash mismatch');
            return false;
        }

        // Everything checks out.
        return true;
    }

    /**
     * @returns {Promise.<boolean>}
     * @private
     */
    async _verifyBody() {
        // Check that the body is valid.
        if (!(await this._body.verify())) {
            return false;
        }

        // Check that bodyHash given in the header matches the actual body hash.
        const bodyHash = await this._body.hash();
        if (!this._header.bodyHash.equals(bodyHash)) {
            Log.w(Block, 'Invalid block - body hash mismatch');
            return false;
        }

        // Everything checks out.
        return true;
    }

    /**
     * @param {Block} predecessor
     * @returns {Promise.<boolean>}
     */
    async isImmediateSuccessorOf(predecessor) {
        // Check the header.
        if (!(await this._header.isImmediateSuccessorOf(predecessor.header))) {
            return false;
        }

        // Check that the interlink is correct.
        const interlink = await predecessor.getNextInterlink(this.target, this.version);
        if (!this._interlink.equals(interlink)) {
            return false;
        }

        // Everything checks out.
        return true;
    }

    /**
     * @param {Block} predecessor
     * @returns {Promise.<boolean>}
     */
    async isInterlinkSuccessorOf(predecessor) {
        // Check that the height is higher than the predecessor's.
        if (this._header.height <= predecessor.header.height) {
            Log.v(Block, 'No interlink predecessor - height');
            return false;
        }

        // Check that the timestamp is greater or equal to the predecessor's timestamp.
        if (this._header.timestamp < predecessor.header.timestamp) {
            Log.v(Block, 'No interlink predecessor - timestamp');
            return false;
        }

        // Check that the predecessor is contained in this block's interlink and verify its position.
        const prevHash = await predecessor.hash();
        if (!Block.GENESIS.HASH.equals(prevHash)) {
            const prevPow = await predecessor.pow();
            const targetHeight = BlockUtils.getTargetHeight(this.target);
            let blockFound = false;

            // Legacy behavior: Don't verify position of the 0'th interlink element for block versions 1, 2
            let depth = this.version > BlockHeader.Version.LUNA_V2 ? 0 : 1;
            for (; depth < this._interlink.length; depth++) {
                if (prevHash.equals(this._interlink.hashes[depth])) {
                    blockFound = true;
                    if (!BlockUtils.isProofOfWork(prevPow, Math.pow(2, targetHeight - depth))) {
                        Log.v(Block, 'No interlink predecessor - invalid position in interlink');
                        return false;
                    }
                }
            }

            if (!blockFound) {
                Log.v(Block, 'No interlink predecessor - not in interlink');
                return false;
            }
        }

        // If the predecessor happens to be the immediate predecessor, check additionally:
        // - that the height of the successor is one higher
        // - that the interlink is correct.
        if (this._header.prevHash.equals(prevHash)) {
            if (this._header.height !== predecessor.header.height + 1) {
                Log.v(Block, 'No interlink predecessor - immediate height');
                return false;
            }

            const interlink = await predecessor.getNextInterlink(this.target, this.version);
            const interlinkHash = await interlink.hash();
            if (!this._header.interlinkHash.equals(interlinkHash)) {
                Log.v(Block, 'No interlink predecessor - immediate interlink');
                return false;
            }
        }
        // Otherwise, if the prevHash doesn't match but the blocks should be adjacent according to their height fields,
        // this cannot be a valid successor of predecessor.
        else if (this._header.height === predecessor.height.height + 1) {
            Log.v(Block, 'No interlink predecessor - immediate height (2)');
            return false;
        }
        // Otherwise, check that the interlink construction is valid given the information we have.
        else {
            // TODO Take different targets into account.

            // The number of new blocks in the interlink is bounded by the height difference.
            /** @type {HashSet.<Hash>} */
            const hashes = new HashSet();
            hashes.addAll(this._interlink.hashes);
            hashes.removeAll(predecessor.interlink.hashes);
            if (hashes.length > this._header.height - predecessor.header.height) {
                Log.v(Block, 'No interlink predecessor - too many new blocks');
                return false;
            }

            // Check that the interlink is not too short.
            const thisDepth = BlockUtils.getTargetDepth(this.target);
            const prevDepth = BlockUtils.getTargetDepth(predecessor.target);
            const depthDiff = thisDepth - prevDepth;
            if (this._interlink.length < predecessor.interlink.length - depthDiff) {
                Log.v(Block, 'No interlink predecessor - interlink too short');
                return false;
            }

            // If the same block is found in both interlinks, all blocks at lower depths must be the same in both interlinks.
            let commonBlock = false;
            const thisInterlink = this._interlink.hashes;
            const prevInterlink = predecessor.interlink.hashes;
            for (let i = 1; i < prevInterlink.length && i - depthDiff < thisInterlink.length; i++) {
                if (prevInterlink[i].equals(thisInterlink[i - depthDiff])) {
                    commonBlock = true;
                }
                else if (commonBlock) {
                    Log.v(Block, 'No interlink predecessor - invalid common suffix');
                    return false;
                }
            }
        }

        // Check that the target adjustment between the blocks does not exceed the theoretical limit.
        const adjustmentFactor = this._header.target / predecessor.header.target;
        const heightDiff = this._header.height - predecessor.header.height;
        if (adjustmentFactor > Math.pow(Policy.DIFFICULTY_MAX_ADJUSTMENT_FACTOR, heightDiff)
                || adjustmentFactor < Math.pow(Policy.DIFFICULTY_MAX_ADJUSTMENT_FACTOR, -heightDiff)) {
            Log.v(Block, 'No interlink predecessor - target adjustment out of bounds');
            return false;
        }

        // Everything checks out.
        return true;
    }

    /**
     * @param {Block} predecessor
     * @returns {Promise.<boolean>}
     */
    async isSuccessorOf(predecessor) {
        // TODO Improve this! Lots of duplicate checks.
        return await this.isImmediateSuccessorOf(predecessor) || this.isInterlinkSuccessorOf(predecessor);
    }

    /**
     * @param {number} nextTarget
     * @param {number} [nextVersion]
     * @returns {Promise.<BlockInterlink>}
     */
    async getNextInterlink(nextTarget, nextVersion = BlockHeader.CURRENT_VERSION) {
        // Compute the depth of this block relative to the next target.
        const pow = await this.pow();
        const thisPowDepth = BlockUtils.getTargetDepth(BlockUtils.hashToTarget(pow));
        const nextTargetDepth = BlockUtils.getTargetDepth(nextTarget);
        let depth = thisPowDepth - nextTargetDepth;

        // Start constructing the next interlink.
        /** @type {Array.<Hash>} */
        const hashes = [];
        const hash = await this.hash();

        // FIXME Remove version switch for mainnet.
        if (nextVersion > BlockHeader.Version.LUNA_V2) {
            // Push the current blockHash depth + 1 times onto the next interlink. If depth < 0, it won't be pushed.
            for (let i = 0; i <= depth; i++) {
                hashes.push(hash);
            }
        } else {
            // Legacy behavior: Always push current blockHash once (prevHash),
            // then push the current blockHash depth times onto the next interlink.
            hashes.push(hash);
            for (let i = 0; i < depth; i++) {
                hashes.push(hash);
            }

            // Don't include the level 0 hash from the previous interlink.
            depth = Math.max(depth, 0);
        }

        // Push the remaining hashes from the current interlink. If the target depth increases (i.e. the difficulty
        // increases), we omit the block(s) at the beginning of the current interlink as they are not eligible for
        // inclusion anymore.
        const thisTargetDepth = BlockUtils.getTargetDepth(this.target);
        const offset = nextTargetDepth - thisTargetDepth;
        for (let j = depth + offset + 1; j < this.interlink.length; j++) {
            hashes.push(this.interlink.hashes[j]);
        }

        // Return the correct interlink version.
        // FIXME Remove version switch for mainnet.
        switch (nextVersion) {
            case BlockHeader.Version.LUNA_V1:
                return new BlockInterlinkLegacyV1(hashes);
            case BlockHeader.Version.LUNA_V2:
                return new BlockInterlinkLegacyV2(hashes);
            default:
                return new BlockInterlink(hashes, hash);
        }
    }

    /**
     * @param {Block|*} o
     * @returns {boolean}
     */
    equals(o) {
        return o instanceof Block
            && this._header.equals(o._header)
            && this._interlink.equals(o._interlink)
            && (this._body ? this._body.equals(o._body) : !o._body);
    }

    /**
     * @returns {boolean}
     */
    isLight() {
        return !this._body;
    }

    /**
     * @returns {boolean}
     */
    isFull() {
        return !!this._body;
    }

    /**
     * @returns {Block}
     */
    toLight() {
        return this.isLight() ? this : new Block(this._header, this._interlink);
    }

    /**
     * @param {BlockBody} body
     * @returns {Block}
     */
    toFull(body) {
        return this.isFull() ? this : new Block(this._header, this._interlink, body);
    }

    /**
     * @type {BlockHeader}
     */
    get header() {
        return this._header;
    }

    /**
     * @type {BlockInterlink}
     */
    get interlink() {
        return this._interlink;
    }

    /**
     * @type {BlockBody}
     */
    get body() {
        if (this.isLight()) {
            throw 'Cannot access body of light block';
        }
        return this._body;
    }

    /**
     * @returns {number}
     */
    get version() {
        return this._header.version;
    }

    /**
     * @type {Hash}
     */
    get prevHash() {
        return this._header.prevHash;
    }

    /**
     * @type {Hash}
     */
    get bodyHash() {
        return this._header.bodyHash;
    }

    /**
     * @type {Hash}
     */
    get accountsHash() {
        return this._header.accountsHash;
    }

    /**
     * @type {number}
     */
    get nBits() {
        return this._header.nBits;
    }

    /**
     * @type {number}
     */
    get target() {
        return this._header.target;
    }

    /**
     * @type {number}
     */
    get difficulty() {
        return this._header.difficulty;
    }

    /**
     * @type {number}
     */
    get height() {
        return this._header.height;
    }
    
    /**
     * @type {number}
     */
    get timestamp() {
        return this._header.timestamp;
    }

    /**
     * @type {number}
     */
    get nonce() {
        return this._header.nonce;
    }

    /**
     * @type {Address}
     */
    get minerAddr() {
        return this._body.minerAddr;
    }

    /**
     * @type {Array.<Transaction>}
     */
    get transactions() {
        return this._body.transactions;
    }

    /**
     * @type {number}
     */
    get transactionCount() {
        return this._body.transactionCount;
    }

    /**
     * @param {SerialBuffer} [buf]
     * @returns {Promise.<Hash>}
     */
    hash(buf) {
        return this._header.hash(buf);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @returns {Promise.<Hash>}
     */
    pow(buf) {
        return this._header.pow(buf);
    }

}
Block.TIMESTAMP_DRIFT_MAX = 600 /* seconds */; // 10 minutes
Class.register(Block);

/* Genesis Block */
Block.GENESIS = new Block(
    new BlockHeader(
        new Hash(null),
        Hash.fromBase64('DldRwCblQ7Loqy6wYJnaodHl30d3j3eH+qtFzfEv46g='),
        Hash.fromBase64('z2Qp5kzePlvq/ABN31K1eUAQ5Dn8rpeZQU0PTQn9pH0='),
        Hash.fromBase64('kOLoEJXYHiciZb/QkswXk0GPhhg7pmHy+L1NmTbilPM='),
        BlockUtils.difficultyToCompact(1),
        1,
        0,
        66958,
        BlockHeader.Version.LUNA_V1),
    new BlockInterlinkLegacyV1([]),
    new BlockBody(Address.fromBase64('9KzhefhVmhN0pOSnzcIYnlVOTs0='), [])
);
// Store hash for synchronous access
Block.GENESIS.HASH = Hash.fromBase64('K3Id+E/rgqR8SB8pV0X9Fxv4FxkC5eePu/oXVaj6ZO4=');
