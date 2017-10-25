/**
 * @abstract
 */
class BaseChain extends IBlockchain {
    /**
     * @param {ChainDataStore} store
     */
    constructor(store) {
        super();
        this._store = store;
    }

    /**
     * @param {Hash} hash
     * @param {boolean} [includeForks]
     * @returns {Promise.<Block>}
     */
    async getBlock(hash, includeForks = false) {
        const chainData = await this._store.getChainData(hash);
        return chainData && (chainData.onMainChain || includeForks) ? chainData.head : undefined;
    }

    /**
     * @param {number} height
     * @returns {Promise.<Block>}
     */
    getBlockAt(height) {
        return this._store.getBlockAt(height);
    }

    /**
     * Computes the target value for the block after the given block or the head of this chain if no block is given.
     * @param {Block} [block]
     * @returns {Promise.<number>}
     */
    async getNextTarget(block) {
        let chainData;
        if (block) {
            const hash = await block.hash();
            chainData = await this._store.getChainData(hash);
            Assert.that(!!chainData);
        } else {
            block = this.head;
            chainData = this._mainChain;
        }

        // Retrieve the timestamp of the block that appears DIFFICULTY_BLOCK_WINDOW blocks before the given block in the chain.
        // The block might not be on the main chain.
        const startHeight = Math.max(block.height - Policy.DIFFICULTY_BLOCK_WINDOW, 1);
        /** @type {Block} */
        let startBlock;
        if (chainData.onMainChain) {
            startBlock = await this._store.getBlockAt(startHeight);
        } else {
            let prevData = chainData;
            for (let i = 0; i < Policy.DIFFICULTY_BLOCK_WINDOW && !prevData.onMainChain; i++) {
                prevData = await this._store.getChainData(prevData.head.prevHash);
                if (!prevData) {
                    // Not enough blocks are available to compute the next target, fail.
                    return -1;
                }
            }

            if (prevData.onMainChain && prevData.head.height > startHeight) {
                startBlock = await this._store.getBlockAt(startHeight);
            } else {
                startBlock = prevData.head;
            }
        }

        if (!startBlock) {
            // Not enough blocks are available to compute the next target, fail.
            return -1;
        }

        return BlockUtils.getNextTarget(block.header, startBlock.header);
    }



    /* NIPoPoW functions */

    /**
     * @returns {Promise.<ChainProof>}
     */
    getChainProof() {
        return this._prove(Policy.M, Policy.K, Policy.DELTA);
    }

    /**
     * The "Prove" algorithm from the NIPoPow paper.
     * @param {number} m
     * @param {number} k
     * @param {number} delta
     * @returns {Promise.<ChainProof>}
     * @private
     */
    async _prove(m, k, delta) {
        Assert.that(m >= 1, 'm must be >= 1');
        Assert.that(delta > 0, 'delta must be > 0');
        let prefix = new BlockChain([]);

        // B <- C[0]
        let startHeight = 1;

        const head = await this.getBlockAt(Math.max(this.height - k, 1)); // C[-k]
        const maxDepth = Math.max(BlockUtils.getTargetDepth(head.target) + head.interlink.length - 1, 0); // |C[-k].interlink|
        // for mu = |C[-k].interlink| down to 0 do
        for (let depth = maxDepth; depth >= 0; depth--) {
            // alpha = C[:-k]{B:}|^mu
            const alpha = await this._getSuperChain(depth, head, startHeight); // eslint-disable-line no-await-in-loop
            // pi = pi (union) alpha
            prefix = BlockChain.merge(prefix, alpha);

            // if good_(delta,m)(C, alpha, mu) then
            if (BaseChain._isGoodSuperChain(alpha, depth, m, delta)) {
                Assert.that(alpha.length >= m, `Good superchain expected to be at least ${m} long`);
                Log.v(BaseChain, `Found good superchain at depth ${depth} with length ${alpha.length} (#${startHeight} - #${head.height})`);
                // B <- alpha[-m]
                startHeight = alpha.blocks[alpha.length - m].height;
            }
        }

        // X <- C[-k:]
        const suffix = await this._getHeaderChain(this.height - head.height);

        // return piX
        return new ChainProof(prefix, suffix);
    }


    /**
     * @param {number} depth
     * @param {Block} [head]
     * @param {number} [tailHeight]
     * @returns {Promise.<BlockChain>}
     * @private
     */
    async _getSuperChain(depth, head = this.head, tailHeight = 1) {
        Assert.that(tailHeight >= 1, 'tailHeight must be >= 1');
        const blocks = [];

        // Include head if it is at the requested depth or below.
        const headHash = await head.hash();
        const headDepth = BlockUtils.getTargetDepth(BlockUtils.hashToTarget(headHash));
        if (headDepth >= depth) {
            blocks.push(head.toLight());
        }

        // Follow the interlink pointers back at the requested depth.
        let references = [head.prevHash, ...head.interlink.hashes.slice(1)];
        let j = Math.max(depth - BlockUtils.getTargetDepth(head.target), 0);
        while (j < references.length && head.height > tailHeight) {
            head = await this.getBlock(references[j]); // eslint-disable-line no-await-in-loop
            Assert.that(!!head, `Corrupted store: Failed to load block ${references[j]} while constructing SuperChain`);
            blocks.push(head.toLight());

            references = [head.prevHash, ...head.interlink.hashes.slice(1)];
            j = Math.max(depth - BlockUtils.getTargetDepth(head.target), 0);
        }

        if (blocks[blocks.length - 1].height > 1 && tailHeight === 1) {
            blocks.push(Block.GENESIS.toLight());
        }

        return new BlockChain(blocks.reverse());
    }

    /**
     * @param {BlockChain} superchain
     * @param {number} depth
     * @param {number} m
     * @param {number} delta
     * @returns {boolean}
     * @private
     */
    static _isGoodSuperChain(superchain, depth, m, delta) {
        // TODO multilevel quality
        return BaseChain._hasSuperQuality(superchain, depth, m, delta);
    }

    /**
     * @param {BlockChain} superchain
     * @param {number} depth
     * @param {number} m
     * @param {number} delta
     * @returns {boolean}
     * @private
     */
    static _hasSuperQuality(superchain, depth, m, delta) {
        Assert.that(m >= 1, 'm must be >= 1');
        if (superchain.length < m) {
            return false;
        }

        for (let i = m; i <= superchain.length; i++) {
            const underlyingLength = superchain.head.height - superchain.blocks[superchain.length - i].height + 1;
            if (!BaseChain._isLocallyGood(i, underlyingLength, depth, delta)) {
                return false;
            }
        }

        return true;
    }

    /**
     * @param {number} superLength
     * @param {number} underlyingLength
     * @param {number} depth
     * @param {number} delta
     * @returns {boolean}
     * @private
     */
    static _isLocallyGood(superLength, underlyingLength, depth, delta) {
        // |C'| > (1 - delta) * 2^(-mu) * |C|
        return superLength > (1 - delta) * Math.pow(2, -depth) * underlyingLength;
    }

    /**
     * @param {number} length
     * @param {Block} [head]
     * @returns {Promise.<HeaderChain>}
     * @private
     */
    async _getHeaderChain(length, head = this.head) {
        const headers = [];
        while (head && headers.length < length) {
            headers.push(head.header);
            head = await this.getBlock(head.prevHash); // eslint-disable-line no-await-in-loop
        }
        return new HeaderChain(headers.reverse());
    }
}
Class.register(BaseChain);
