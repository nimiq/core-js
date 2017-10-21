class NanoChain extends IBlockchain {
    constructor() {
        super();

        this._proof = new ChainProof(new Chain([Block.GENESIS.toLight()]), new Chain([]));

        this._headHash = Block.GENESIS.HASH;

        this._blockIndex = new HashMap();
        this._blockIndex.put(Block.GENESIS.HASH, Block.GENESIS.toLight());

        this._synchronizer = new Synchronizer();
    }

    /**
     * @param {ChainProof} proof
     * @returns {Promise.<boolean>}
     */
    pushProof(proof) {
        return this._synchronizer.push(() => {
            return this._pushProof(proof);
        });
    }

    /**
     * @param {ChainProof} proof
     * @returns {Promise.<boolean>}
     * @private
     */
    async _pushProof(proof) {
        // TODO !!! verify difficulty !!!

        // Check that the proof is valid.
        if (!(await proof.verify())) {
            Log.w(NanoChain, 'Rejecting proof - verification failed');
            return false;
        }

        // Check that the suffix is long enough.
        if (proof.suffix.length !== Policy.K && proof.suffix.length !== proof.head.height - 1) {
            Log.w(NanoChain, 'Rejecting proof - suffix not long enough');
            return false;
        }

        // Add proof blocks to index.
        for (const block of proof.prefix.blocks) {
            const hash = await block.hash(); // eslint-disable-line no-await-in-loop
            this._blockIndex.put(hash, block);
        }
        for (const block of proof.suffix.blocks) {
            const hash = await block.hash(); // eslint-disable-line no-await-in-loop
            this._blockIndex.put(hash, block);
        }

        // If the given proof is better than our current proof, adopt the given proof as the new best proof.
        if (await NanoChain._isBetterProof(proof, this._proof, Policy.M)) {
            this._proof = proof;
            this._headHash = await proof.head.hash();
            this.fire('head-changed', this._proof.head);
        }

        return true;
    }

    /**
     * @param {ChainProof} proof1
     * @param {ChainProof} proof2
     * @param {number} m
     * @returns {boolean}
     * @private
     */
    static async _isBetterProof(proof1, proof2, m) {
        const lca = Chain.lowestCommonAncestor(proof1.prefix, proof2.prefix);
        const score1 = await NanoChain._getProofScore(proof1.prefix, lca, m);
        const score2 = await NanoChain._getProofScore(proof2.prefix, lca, m);
        return score1 === score2
            ? proof1.suffix.totalDifficulty() >= proof2.suffix.totalDifficulty()
            : score1 > score2;
    }

    /**
     *
     * @param {Chain} chain
     * @param {Block} lca
     * @param {number} m
     * @returns {Promise.<number>}
     * @private
     */
    static async _getProofScore(chain, lca, m) {
        const counts = [];
        for (const block of chain.blocks) {
            if (block.height < lca.height) {
                continue;
            }

            const target = BlockUtils.hashToTarget(await block.hash()); // eslint-disable-line no-await-in-loop
            const depth = BlockUtils.getTargetDepth(target);
            counts[depth] = counts[depth] ? counts[depth] + 1 : 1;
        }

        let sum = 0;
        let depth;
        for (depth = counts.length - 1; depth >= 0; depth--) {
            sum += counts[depth] ? counts[depth] : 0;
            if (sum >= m) {
                break;
            }
        }

        return Math.pow(2, Math.max(depth, 0)) * sum;
    }

    /**
     * @param {BlockHeader} header
     * @returns {Promise.<number>}
     */
    pushHeader(header) {
        return this._synchronizer.push(() => {
            return this._pushHeader(header);
        });
    }

    /**
     * @param {BlockHeader} header
     * @returns {Promise.<number>}
     * @private
     */
    async _pushHeader(header) {
        const hash = await header.hash();

        // TODO ...
        return NanoChain.OK_EXTENDED;
    }

    /**
     * @param {Hash} hash
     * @returns {?Block}
     */
    getBlock(hash) {
        return this._blockIndex.get(hash);
    }

    /** @type {Block} */
    get head() {
        return this._proof.head;
    }

    /** @type {Hash} */
    get headHash() {
        return this._headHash;
    }

    /** @type {number} */
    get height() {
        return this._proof.head.height;
    }
}
NanoChain.ERR_INVALID = -1;
NanoChain.OK_EXTENDED = 1;
Class.register(NanoChain);
