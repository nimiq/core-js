class Block {
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
        const interlink = BlockInterlink.unserialize(buf, header.prevHash);

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
     * @param {Time} time
     * @returns {Promise.<boolean>}
     */
    async verify(time) {
        if (this._valid === undefined) {
            if (this.isLight() || this.body.transactions.length < 150 || !IWorker.areWorkersAsync) {
                // worker overhead doesn't pay off for small transaction numbers
                this._valid = await this._verify(time.now());
            } else {
                const transactionValid = this.body.transactions.map(t => t._valid);
                const worker = await CryptoWorker.getInstanceAsync();
                const {valid, pow, interlinkHash, bodyHash} = await worker.blockVerify(this.serialize(),
                    transactionValid, time.now(), GenesisConfig.GENESIS_HASH.serialize(), GenesisConfig.NETWORK_ID);
                this._valid = valid;
                this.header._pow = Hash.unserialize(new SerialBuffer(pow));
                this.interlink._hash = Hash.unserialize(new SerialBuffer(interlinkHash));
                this.body._hash = Hash.unserialize(new SerialBuffer(bodyHash));
            }
        }
        return this._valid;
    }

    /**
     * @param {number} timeNow
     * @returns {Promise.<boolean>}
     */
    async _verify(timeNow) {
        // Check that the timestamp is not too far into the future.
        if (this._header.timestamp * 1000 > timeNow + Block.TIMESTAMP_DRIFT_MAX * 1000) {
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
        if (!this._verifyInterlink()) {
            return false;
        }

        // XXX Verify the body only if it is present.
        if (this.isFull() && !this._verifyBody()) {
            return false;
        }

        // Everything checks out.
        return true;
    }

    /**
     * @returns {boolean}
     * @private
     */
    _verifyInterlink() {
        // Skip check for genesis block due to the cyclic dependency (since the interlink hash contains the genesis block hash).
        if (this.height === 1 && this._header.interlinkHash.equals(new Hash(null))) {
            return true;
        }

        // Check that the interlinkHash given in the header matches the actual interlinkHash.
        const interlinkHash = this._interlink.hash();
        if (!this._header.interlinkHash.equals(interlinkHash)) {
            Log.w(Block, 'Invalid block - interlink hash mismatch');
            return false;
        }

        // Everything checks out.
        return true;
    }

    /**
     * @returns {boolean}
     * @private
     */
    _verifyBody() {
        // Check that the body is valid.
        if (!this._body.verify()) {
            return false;
        }

        // Check that bodyHash given in the header matches the actual body hash.
        const bodyHash = this._body.hash();
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
        if (!this._header.isImmediateSuccessorOf(predecessor.header)) {
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
            Log.v(Block, 'No interlink successor - height');
            return false;
        }

        // Check that the timestamp is greater or equal to the predecessor's timestamp.
        if (this._header.timestamp < predecessor.header.timestamp) {
            Log.v(Block, 'No interlink successor - timestamp');
            return false;
        }

        // Check that the predecessor is contained in this block's interlink and verify its position.
        const prevHash = predecessor.hash();
        if (!GenesisConfig.GENESIS_HASH.equals(prevHash)) {
            const prevPow = await predecessor.pow();
            const targetHeight = BlockUtils.getTargetHeight(this.target);
            let blockFound = false;

            let depth = 0;
            for (; depth < this._interlink.length; depth++) {
                if (prevHash.equals(this._interlink.hashes[depth])) {
                    blockFound = true;
                    if (!BlockUtils.isProofOfWork(prevPow, Math.pow(2, targetHeight - depth))) {
                        Log.v(Block, 'No interlink successor - invalid position in interlink');
                        return false;
                    }
                }
            }

            if (!blockFound) {
                Log.v(Block, 'No interlink successor - not in interlink');
                return false;
            }
        }

        // If the predecessor happens to be the immediate predecessor, check additionally:
        // - that the height of the successor is one higher
        // - that the interlink is correct.
        if (this._header.prevHash.equals(prevHash)) {
            if (this._header.height !== predecessor.header.height + 1) {
                Log.v(Block, 'No interlink successor - immediate height');
                return false;
            }

            const interlink = await predecessor.getNextInterlink(this.target, this.version);
            const interlinkHash = interlink.hash();
            if (!this._header.interlinkHash.equals(interlinkHash)) {
                Log.v(Block, 'No interlink successor - immediate interlink');
                return false;
            }
        }
        // Otherwise, if the prevHash doesn't match but the blocks should be adjacent according to their height fields,
        // this cannot be a valid successor of predecessor.
        else if (this._header.height === predecessor.height.height + 1) {
            Log.v(Block, 'No interlink successor - immediate height (2)');
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
                Log.v(Block, 'No interlink successor - too many new blocks');
                return false;
            }

            // Check that the interlink is not too short.
            const thisDepth = BlockUtils.getTargetDepth(this.target);
            const prevDepth = BlockUtils.getTargetDepth(predecessor.target);
            const depthDiff = thisDepth - prevDepth;
            if (this._interlink.length < predecessor.interlink.length - depthDiff) {
                Log.v(Block, 'No interlink successor - interlink too short');
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
                    Log.v(Block, 'No interlink successor - invalid common suffix');
                    return false;
                }
            }
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
        return (await this.isImmediateSuccessorOf(predecessor)) || (await this.isInterlinkSuccessorOf(predecessor));
    }

    /**
     * @param {BigNumber} nextTarget
     * @param {number} [nextVersion]
     * @returns {Promise.<BlockInterlink>}
     */
    async getNextInterlink(nextTarget, nextVersion = BlockHeader.CURRENT_VERSION) {
        /** @type {Array.<Hash>} */
        const hashes = [];
        const hash = this.hash();

        // Compute how many times this blockHash should be included in the next interlink.
        const thisPowDepth = BlockUtils.getHashDepth(await this.pow());
        const nextTargetDepth = BlockUtils.getTargetDepth(nextTarget);
        const numOccurrences = Math.max(thisPowDepth - nextTargetDepth + 1, 0);

        // Push this blockHash numOccurrences times onto the next interlink.
        for (let i = 0; i < numOccurrences; i++) {
            hashes.push(hash);
        }

        // Compute how many blocks to omit from the beginning of this interlink.
        const thisTargetDepth = BlockUtils.getTargetDepth(this.target);
        const targetOffset = nextTargetDepth - thisTargetDepth;
        const interlinkOffset = numOccurrences + targetOffset;

        // Push the remaining hashes from this interlink.
        for (let i = interlinkOffset; i < this.interlink.length; i++) {
            hashes.push(this.interlink.hashes[i]);
        }
        
        return new BlockInterlink(hashes, hash);
    }

    /**
     * @returns {Block}
     */
    shallowCopy() {
        return new Block(this._header, this._interlink, this._body);
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
     * @type {BigNumber}
     */
    get target() {
        return this._header.target;
    }

    /**
     * @type {BigNumber}
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
     * @returns {Hash}
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

    toString() {
        return `Block{height=${this.height},prev=${this.prevHash}}`;
    }

}
Block.TIMESTAMP_DRIFT_MAX = 600 /* seconds */; // 10 minutes
Class.register(Block);
