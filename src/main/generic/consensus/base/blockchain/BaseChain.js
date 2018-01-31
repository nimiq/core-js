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
     * @returns {Promise.<?Block>}
     */
    async getBlock(hash, includeForks = false) {
        const chainData = await this._store.getChainData(hash);
        return chainData && (chainData.onMainChain || includeForks) ? chainData.head : null;
    }

    /**
     * @param {number} height
     * @returns {Promise.<?Block>}
     */
    getBlockAt(height) {
        return this._store.getBlockAt(height) || null;
    }

    /**
     * Computes the target value for the block after the given block or the head of this chain if no block is given.
     * @param {Block} [block]
     * @returns {Promise.<number>}
     */
    async getNextTarget(block) {
        /** @type {ChainData} */
        let headData;
        if (block) {
            const hash = block.hash();
            headData = await this._store.getChainData(hash);
            Assert.that(!!headData);
        } else {
            block = this.head;
            headData = this._mainChain;
        }

        // Retrieve the timestamp of the block that appears DIFFICULTY_BLOCK_WINDOW blocks before the given block in the chain.
        // The block might not be on the main chain.
        const tailHeight = Math.max(block.height - Policy.DIFFICULTY_BLOCK_WINDOW, 1);
        /** @type {ChainData} */
        let tailData;
        if (headData.onMainChain) {
            tailData = await this._store.getChainDataAt(tailHeight);
        } else {
            let prevData = headData;
            for (let i = 0; i < Policy.DIFFICULTY_BLOCK_WINDOW && !prevData.onMainChain; i++) {
                prevData = await this._store.getChainData(prevData.head.prevHash);
                if (!prevData) {
                    // Not enough blocks are available to compute the next target, fail.
                    return -1;
                }
            }

            if (prevData.onMainChain && prevData.head.height > tailHeight) {
                tailData = await this._store.getChainDataAt(tailHeight);
            } else {
                tailData = prevData;
            }
        }

        if (!tailData || tailData.totalDifficulty < 1) {
            // Not enough blocks are available to compute the next target, fail.
            return -1;
        }

        const deltaTotalDifficulty = headData.totalDifficulty - tailData.totalDifficulty;
        return BlockUtils.getNextTarget(headData.head.header, tailData.head.header, deltaTotalDifficulty);
    }



    /* NIPoPoW Prover functions */

    /**
     * @returns {Promise.<ChainProof>}
     * @protected
     */
    async _getChainProof() {
        const snapshot = this._store.snapshot();
        const chain = new BaseChainSnapshot(snapshot, this.head);
        const proof = await chain._prove(Policy.M, Policy.K, Policy.DELTA);
        snapshot.abort().catch(Log.w.tag(BaseChain));
        return proof;
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
        const headPow = await head.pow();
        const headDepth = BlockUtils.getTargetDepth(BlockUtils.hashToTarget(headPow));
        if (headDepth >= depth) {
            blocks.push(head.toLight());
        }

        // Follow the interlink pointers back at the requested depth.
        let j = Math.max(depth - BlockUtils.getTargetDepth(head.target), 0);
        while (j < head.interlink.hashes.length && head.height > tailHeight) {
            head = await this.getBlock(head.interlink.hashes[j]); // eslint-disable-line no-await-in-loop
            if (!head) {
                // This can happen in the light/nano client if chain superquality is harmed.
                // Return a best-effort chain in this case.
                Log.w(BaseChain, `Failed to find block ${head.interlink.hashes[j]} while constructing SuperChain at depth ${depth} - returning truncated chain`);
                break;
            }
            blocks.push(head.toLight());

            j = Math.max(depth - BlockUtils.getTargetDepth(head.target), 0);
        }

        if ((blocks.length === 0 || blocks[blocks.length - 1].height > 1) && tailHeight === 1) {
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

    /**
     * @param {ChainProof} proof
     * @param {BlockHeader} header
     * @param {boolean} [failOnBadness]
     * @returns {Promise.<ChainProof>}
     * @protected
     */
    async _extendChainProof(proof, header, failOnBadness = true) {
        // Append new header to proof suffix.
        const suffix = proof.suffix.headers.slice();
        suffix.push(header);

        // If the suffix is not long enough (short chain), we're done.
        const prefix = proof.prefix.blocks.slice();
        if (suffix.length <= Policy.K) {
            return new ChainProof(new BlockChain(prefix), new HeaderChain(suffix));
        }

        // Cut the tail off the suffix.
        const suffixTail = suffix.shift();

        // Construct light block out of the old suffix tail.
        const interlink = await proof.prefix.head.getNextInterlink(suffixTail.target, suffixTail.version);
        const prefixHead = new Block(suffixTail, interlink);

        // Append old suffix tail block to prefix.
        prefix.push(prefixHead);

        // Extract layered superchains from prefix. Make a copy because we are going to change the chains array.
        const chains = (await proof.getSuperChains()).slice();

        // Append new prefix head to chains.
        const target = BlockUtils.hashToTarget(await prefixHead.pow());
        const depth = BlockUtils.getTargetDepth(target);
        for (let i = depth; i >= 0; i--) {
            // Append block. Don't modify the chain, create a copy.
            if (!chains[i]) {
                chains[i] = new BlockChain([prefixHead]);
            } else {
                chains[i] = new BlockChain([...chains[i].blocks, prefixHead]);
            }
        }

        // If the new header isn't a superblock, we're done.
        if (depth - BlockUtils.getTargetDepth(prefixHead.target) <= 0) {
            return new ChainProof(new BlockChain(prefix), new HeaderChain(suffix), chains);
        }

        // Prune unnecessary blocks if the chain is good.
        // Try to extend proof if the chain is bad.
        const deletedBlockHeights = new Set();
        for (let i = depth; i >= 0; i--) {
            const superchain = chains[i];
            if (superchain.length < Policy.M) {
                continue;
            }

            if (BaseChain._isGoodSuperChain(superchain, i, Policy.M, Policy.DELTA)) {
                // Remove all blocks in lower chains up to (including) superchain[-m].
                const referenceBlock = superchain.blocks[superchain.length - Policy.M];
                for (let j = i - 1; j >= 0; j--) {
                    let numBlocksToDelete = 0;
                    let candidateBlock = chains[j].blocks[numBlocksToDelete];
                    while (candidateBlock.height <= referenceBlock.height) {
                        const candidateTarget = BlockUtils.hashToTarget(await candidateBlock.pow());
                        const candidateDepth = BlockUtils.getTargetDepth(candidateTarget);
                        if (candidateDepth === j && candidateBlock.height > 1) {
                            deletedBlockHeights.add(candidateBlock.height);
                        }

                        numBlocksToDelete++;
                        candidateBlock = chains[j].blocks[numBlocksToDelete];
                    }

                    if (numBlocksToDelete > 0) {
                        // Don't modify the chain, create a copy.
                        chains[j] = new BlockChain(chains[j].blocks.slice(numBlocksToDelete));
                    }
                }
            } else {
                Log.w(BaseChain, `Chain quality badness detected at depth ${i}`);
                // TODO extend superchains at lower levels
                if (failOnBadness) {
                    return null;
                }
            }
        }

        // Remove all deleted blocks from prefix.
        const newPrefix = new BlockChain(prefix.filter(block => !deletedBlockHeights.has(block.height)));

        // Return the extended proof.
        return new ChainProof(newPrefix, new HeaderChain(suffix), chains);
    }


    /* NiPoPoW Verifier functions */

    /**
     * @param {ChainProof} proof1
     * @param {ChainProof} proof2
     * @param {number} m
     * @returns {boolean}
     */
    static async isBetterProof(proof1, proof2, m) {
        const lca = BlockChain.lowestCommonAncestor(proof1.prefix, proof2.prefix);
        const score1 = await NanoChain._getProofScore(proof1.prefix, lca, m);
        const score2 = await NanoChain._getProofScore(proof2.prefix, lca, m);
        return score1 === score2
            ? proof1.suffix.totalDifficulty() >= proof2.suffix.totalDifficulty()
            : score1 > score2;
    }

    /**
     *
     * @param {BlockChain} chain
     * @param {Block} lca
     * @param {number} m
     * @returns {Promise.<number>}
     * @protected
     */
    static async _getProofScore(chain, lca, m) {
        const counts = [];
        for (const block of chain.blocks) {
            if (block.height < lca.height) {
                continue;
            }

            const target = BlockUtils.hashToTarget(await block.pow()); // eslint-disable-line no-await-in-loop
            const depth = BlockUtils.getTargetDepth(target);
            counts[depth] = counts[depth] ? counts[depth] + 1 : 1;
        }

        let sum = 0;
        let depth;
        for (depth = counts.length - 1; sum < m && depth >= 0; depth--) {
            sum += counts[depth] ? counts[depth] : 0;
        }

        let maxScore = Math.pow(2, depth + 1) * sum;
        let length = sum;
        for (let i = depth; i >= 0; i--) {
            length += counts[i] ? counts[i] : 0;
            const score = Math.pow(2, i) * length;
            maxScore = Math.max(maxScore, score);
        }

        return maxScore;
    }
}
Class.register(BaseChain);

class BaseChainSnapshot extends BaseChain {
    /**
     * @param {ChainDataStore} store
     * @param {Block} head
     */
    constructor(store, head) {
        super(store);
        this._head = head;
    }

    /** @type {Block} */
    get head() {
        return this._head;
    }

    /** @type {number} */
    get height() {
        return this._head.height;
    }
}
Class.register(BaseChainSnapshot);
