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
     * @param {boolean} [includeBody]
     * @returns {Promise.<?Block>}
     */
    async getBlock(hash, includeForks = false, includeBody = false) {
        const chainData = await this._store.getChainData(hash, includeBody);
        return chainData && (chainData.onMainChain || includeForks) ? chainData.head : null;
    }

    /**
     * @param {Hash} hash
     * @param {boolean} [includeForks]
     * @returns {Promise.<?Uint8Array>}
     */
    getRawBlock(hash, includeForks = false) {
        return this._store.getRawBlock(hash, includeForks);
    }

    /**
     * @param {number} height
     * @param {boolean} [includeBody]
     * @returns {Promise.<?Block>}
     */
    getBlockAt(height, includeBody = false) {
        return this._store.getBlockAt(height, includeBody) || null;
    }

    /**
     * @param {number} height
     * @param {boolean} [lower]
     * @returns {Promise.<?Block>}
     */
    getNearestBlockAt(height, lower = true) {
        return this._store.getNearestBlockAt(height, lower) || null;
    }

    /**
     * @param {Block} block
     * @returns {Promise<Array.<Block>>}
     */
    async getSuccessorBlocks(block) {
        return this._store.getSuccessorBlocks(block);
    }

    /**
     * @returns {Promise.<Array.<Hash>>}
     */
    async getBlockLocators() {
        // Push top 10 hashes first, then back off exponentially.
        /** @type {Array.<Hash>} */
        const locators = [this.headHash];

        let block = this.head;
        for (let i = Math.min(10, this.height) - 1; i > 0; i--) {
            if (!block) {
                break;
            }
            locators.push(block.prevHash);
            block = await this.getBlock(block.prevHash); // eslint-disable-line no-await-in-loop
        }

        let step = 2;
        for (let i = this.height - 10 - step; i > 0; i -= step) {
            block = await this.getBlockAt(i); // eslint-disable-line no-await-in-loop
            if (block) {
                locators.push(await block.hash()); // eslint-disable-line no-await-in-loop
            }
            step *= 2;
            // Respect max size for GetBlocksMessages
            if (locators.length >= GetBlocksMessage.LOCATORS_MAX_COUNT) break;
        }

        // Push the genesis block hash.
        if (locators.length === 0 || !locators[locators.length - 1].equals(GenesisConfig.GENESIS_HASH)) {
            // Respect max size for GetBlocksMessages, make space for genesis hash if necessary
            if (locators.length >= GetBlocksMessage.LOCATORS_MAX_COUNT) {
                locators.pop();
            }
            locators.push(GenesisConfig.GENESIS_HASH);
        }

        return locators;
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
     * MUST be synchronized with .pushBlock() and variants!
     * @returns {Promise.<ChainProof>}
     * @protected
     */
    _getChainProof() {
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

        /** @type {ChainData} */
        const headData = await this._store.getChainDataAt(Math.max(this.height - k, 1)); // C[-k]
        const maxDepth = headData.superBlockCounts.getCandidateDepth(m);

        // for mu = |C[-k].interlink| down to 0 do
        for (let depth = maxDepth; depth >= 0; depth--) {
            // alpha = C[:-k]{B:}|^mu
            /** @type {Array.<ChainData>} */
            const alpha = await this._getSuperChain(depth, headData, startHeight); // eslint-disable-line no-await-in-loop

            // pi = pi (union) alpha
            prefix = BlockChain.merge(prefix, new BlockChain(alpha.map(data => data.head.toLight())));

            // if good_(delta,m)(C, alpha, mu) then
            if (BaseChain._isGoodSuperChain(alpha, depth, m, delta)) {
                Assert.that(alpha.length >= m, `Good superchain expected to be at least ${m} long`);
                Log.v(BaseChain, () => `Found good superchain at depth ${depth} with length ${alpha.length} (#${startHeight} - #${headData.head.height})`);
                // B <- alpha[-m]
                startHeight = alpha[alpha.length - m].head.height;
            }
        }

        // X <- C[-k:]
        const suffix = await this._getHeaderChain(this.height - headData.head.height);

        // return piX
        return new ChainProof(prefix, suffix);
    }

    /**
     * @param {number} depth
     * @param {ChainData} headData
     * @param {number} [tailHeight]
     * @returns {Promise.<Array.<ChainData>>}
     * @private
     */
    async _getSuperChain(depth, headData, tailHeight = 1) {
        Assert.that(tailHeight >= 1, 'tailHeight must be >= 1');
        /** @type {Array.<ChainData>} */
        const chain = [];

        // Include head if it is at the requested depth or below.
        const headDepth = BlockUtils.getHashDepth(await headData.head.pow());
        if (headDepth >= depth) {
            chain.push(headData);
        }

        // Follow the interlink pointers back at the requested depth.
        /** @type {ChainData} */
        let chainData = headData;
        let j = Math.max(depth - BlockUtils.getTargetDepth(chainData.head.target), -1);
        while (j < chainData.head.interlink.hashes.length && chainData.head.height > tailHeight) {
            const reference = j < 0 ? chainData.head.prevHash : chainData.head.interlink.hashes[j];
            chainData = await this._store.getChainData(reference); // eslint-disable-line no-await-in-loop
            if (!chainData) {
                // This can happen in the light/nano client if chain superquality is harmed.
                // Return a best-effort chain in this case.
                Log.w(BaseChain, `Failed to find block ${reference} while constructing SuperChain at depth ${depth} - returning truncated chain`);
                break;
            }
            chain.push(chainData);

            j = Math.max(depth - BlockUtils.getTargetDepth(chainData.head.target), -1);
        }

        if ((chain.length === 0 || chain[chain.length - 1].head.height > 1) && tailHeight === 1) {
            chain.push(await ChainData.initial(GenesisConfig.GENESIS_BLOCK));
        }

        return chain.reverse();
    }

    /**
     * @param {Array.<ChainData>} superchain
     * @param {number} depth
     * @param {number} m
     * @param {number} delta
     * @returns {boolean}
     */
    static _isGoodSuperChain(superchain, depth, m, delta) {
        return BaseChain._hasSuperQuality(superchain, depth, m, delta)
            && BaseChain._hasMultiLevelQuality(superchain, depth, m, delta);
    }

    /**
     * @param {Array.<ChainData>} superchain
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
            const underlyingLength = superchain[superchain.length - 1].head.height - superchain[superchain.length - i].head.height + 1;
            if (!BaseChain._isLocallyGood(i, underlyingLength, depth, delta)) {
                return false;
            }
        }

        return true;
    }

    /**
     *
     * @param {Array.<ChainData>} superchain
     * @param {number} depth
     * @param {number} k1
     * @param {number} delta
     * @returns {boolean}
     * @private
     */
    static _hasMultiLevelQuality(superchain, depth, k1, delta) {
        if (depth <= 0) {
            return true;
        }

        for (let i = 0; i < superchain.length - k1; i++) {
            const tailData = superchain[i];
            const headData = superchain[i + k1];

            for (let mu = depth; mu >= 1; mu--) {
                const upperChainLength = headData.superBlockCounts.get(mu) - tailData.superBlockCounts.get(mu);

                switch (BaseChain.MULTILEVEL_STRATEGY) {
                    case BaseChain.MultilevelStrategy.STRICT: {
                        const lowerChainLength = headData.superBlockCounts.get(mu - 1) - tailData.superBlockCounts.get(mu - 1);

                        /*
                        // Original paper badness check:
                        if (lowerChainLength > Math.pow(1 + delta, 1 / depth) * 2 * upperChainLength) {
                            Log.d(BaseChain, `Chain badness detected at depth ${depth}, failing at ${mu}/${mu - 1}`
                                + ` with ${upperChainLength}/${Math.pow(1 + delta, 1 / depth) * 2 * upperChainLength}/${lowerChainLength} blocks`);
                            return false;
                        }
                        */

                        // Alternative badness check:
                        if (2 * upperChainLength < Math.pow(1 - delta, 1 / depth) * lowerChainLength) {
                            Log.d(BaseChain, `Chain badness detected at depth ${depth}, failing at ${mu}/${mu - 1}`
                                + ` with ${upperChainLength}/${Math.pow(1 - delta, 1 / depth) * lowerChainLength}/${lowerChainLength} blocks`);
                            return false;
                        }
                        break;
                    }

                    default:
                    case BaseChain.MultilevelStrategy.MODERATE: {
                        // Relaxed badness check:
                        for (let j = mu - 1; j >= 0; j--) {
                            const lowerChainLength = headData.superBlockCounts.get(j) - tailData.superBlockCounts.get(j);
                            if (!BaseChain._isLocallyGood(upperChainLength, lowerChainLength, mu - j, delta)) {
                                Log.d(BaseChain, `Chain badness detected at depth ${depth}[${i}:${i + k1}], failing at ${mu}/${j}`);
                                return false;
                            }
                        }
                        break;
                    }

                    case BaseChain.MultilevelStrategy.RELAXED: {
                        // Local goodness only:
                        const lowerChainLength = headData.superBlockCounts.get(mu - 1) - tailData.superBlockCounts.get(mu - 1);
                        const underlyingLength = headData.head.height - tailData.head.height + 1;
                        if (!BaseChain._isLocallyGood(lowerChainLength, underlyingLength, depth, delta)) {
                            Log.d(BaseChain, `Chain badness detected at depth ${depth}[${i}:${i + k1}], failing at ${mu}`);
                            return false;
                        }
                        break;
                    }
                }
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
        const chains = (await proof.prefix.getSuperChains()).slice();

        // Append new prefix head to chains.
        const depth = BlockUtils.getHashDepth(await prefixHead.pow());
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
            return new ChainProof(new BlockChain(prefix, chains), new HeaderChain(suffix));
        }

        // Prune unnecessary blocks if the chain is good.
        // Try to extend proof if the chain is bad.
        const deletedBlockHeights = new Set();
        for (let i = depth; i >= 0; i--) {
            const superchain = chains[i];
            if (superchain.length < Policy.M) {
                continue;
            }

            // XXX Hack: Convert BlockChain to array of pseudo-ChainData for the super quality check.
            const _superchain = superchain.blocks.map(block => ({ head: block }));
            if (!BaseChain._hasSuperQuality(_superchain, i, Policy.M, Policy.DELTA)) {
                Log.w(BaseChain, `Chain quality badness detected at depth ${i}`);
                // TODO extend superchains at lower levels
                if (failOnBadness) {
                    return null;
                }
                continue;
            }

            // Remove all blocks in lower chains up to (including) superchain[-m].
            const referenceBlock = superchain.blocks[superchain.length - Policy.M];
            for (let j = i - 1; j >= 0; j--) {
                let numBlocksToDelete = 0;
                let candidateBlock = chains[j].blocks[numBlocksToDelete];
                while (candidateBlock.height <= referenceBlock.height) {
                    // eslint-disable-next-line no-await-in-loop
                    const candidateDepth = BlockUtils.getHashDepth(await candidateBlock.pow());
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
        }

        // Remove all deleted blocks from prefix.
        const newPrefix = new BlockChain(prefix.filter(block => !deletedBlockHeights.has(block.height)), chains);

        // Return the extended proof.
        return new ChainProof(newPrefix, new HeaderChain(suffix));
    }

    /**
     * MUST be synchronized with .pushBlock() and variants!
     * @param {Block} blockToProve
     * @param {Block} knownBlock
     * @returns {Promise.<?BlockChain>}
     * @protected
     */
    async _getBlockProof(blockToProve, knownBlock) {
        /**
         * @param {Block} block
         * @param {number} depth
         * @returns {Hash}
         */
        const getInterlinkReference = (block, depth) => {
            const index = Math.min(depth - BlockUtils.getTargetDepth(block.target), block.interlink.length - 1);
            return index < 0 ? block.prevHash : block.interlink.hashes[index];
        };

        const blocks = [];
        const hashToProve = blockToProve.hash();

        const proveTarget = BlockUtils.hashToTarget(await blockToProve.pow());
        const proveDepth = BlockUtils.getTargetDepth(proveTarget);

        let depth = BlockUtils.getTargetDepth(knownBlock.target) + knownBlock.interlink.length - 1;
        let block = knownBlock;

        let reference = getInterlinkReference(block, depth);
        while (!hashToProve.equals(reference)) {
            const nextBlock = await this.getBlock(reference); // eslint-disable-line no-await-in-loop
            if (!nextBlock) {
                // This can happen in the light/nano client if the blockToProve is known but blocks between tailBlock
                // and blockToProve are missing.
                Log.w(BaseChain, `Failed to find block ${reference} while constructing inclusion proof`);
                return null;
            }

            if (nextBlock.height < blockToProve.height) {
                // We have gone past the blockToProve, but are already at proveDepth, fail.
                if (depth <= proveDepth) {
                    return null;
                }

                // Decrease depth and thereby step size.
                depth--;
                reference = getInterlinkReference(block, depth);
            } else if (nextBlock.height > blockToProve.height) {
                // We are still in front of blockToProve, add block to result and advance.
                blocks.push(nextBlock.toLight());

                block = nextBlock;
                reference = getInterlinkReference(block, depth);
            } else {
                // We found a reference to a different block than blockToProve at its height.
                Log.w(BaseChain, `Failed to prove block ${hashToProve} - different block ${reference} at its height ${block.height}`);
                return null;
            }
        }

        // Include the blockToProve in the result.
        blocks.push(blockToProve.toLight());

        return new BlockChain(blocks.reverse());
    }

    /**
     * @param {Array.<BlockHeader>} headers
     * @return {Promise.<void>}
     */
    static async manyPow(headers) {
        const worker = await CryptoWorker.getInstanceAsync();
        const size = worker.poolSize || 1;
        const partitions = [];
        let j = 0;
        for (let i = 0; i < size; ++i) {
            partitions.push([]);
            for (; j < ((i + 1) / size) * headers.length; ++j) {
                partitions[i].push(headers[j].serialize());
            }
        }
        const promises = [];
        for (const part of partitions) {
            promises.push(worker.computeArgon2dBatch(part));
        }
        const pows = (await Promise.all(promises)).reduce((a, b) => [...a, ...b], []);
        for(let i = 0; i < headers.length; ++i) {
            headers[i]._pow = new Hash(pows[i]);
        }
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
            ? proof1.suffix.totalDifficulty() > proof2.suffix.totalDifficulty()
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

            const depth = BlockUtils.getHashDepth(await block.pow()); // eslint-disable-line no-await-in-loop
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
BaseChain.MultilevelStrategy = {
    STRICT: 1,
    MODERATE: 2,
    RELAXED: 3
};
BaseChain.MULTILEVEL_STRATEGY = BaseChain.MultilevelStrategy.MODERATE;
Class.register(BaseChain);
