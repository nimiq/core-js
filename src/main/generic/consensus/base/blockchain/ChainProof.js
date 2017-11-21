class ChainProof {
    /**
     * @param {BlockChain} prefix
     * @param {HeaderChain} suffix
     */
    constructor(prefix, suffix) {
        if (!(prefix instanceof BlockChain) || !prefix.length) throw new Error('Malformed prefix');
        if (!(suffix instanceof HeaderChain)) throw new Error('Malformed suffix');

        /** @type {BlockChain} */
        this._prefix = prefix;
        /** @type {HeaderChain} */
        this._suffix = suffix;
    }

    static unserialize(buf) {
        const prefix = BlockChain.unserialize(buf);
        const suffix = HeaderChain.unserialize(buf);
        return new ChainProof(prefix, suffix);
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        this._prefix.serialize(buf);
        this._suffix.serialize(buf);
        return buf;
    }

    get serializedSize() {
        return this._prefix.serializedSize
            + this._suffix.serializedSize;
    }

    /**
     * @returns {Promise.<boolean>}
     */
    async verify() {
        // Check that the prefix chain is anchored.
        if (!this._prefix.isAnchored()) {
            return false;
        }

        // Check that both prefix and suffix are valid chains.
        if (!(await this._prefix.verify()) || !(await this._suffix.verify())) {
            return false;
        }

        // Check that the suffix connects to the prefix.
        if (this._suffix.length > 0 && !(await this._suffix.tail.isImmediateSuccessorOf(this._prefix.head.header))) {
            return false;
        }

        // Verify the block targets where possible.
        if (!(await this._verifyDifficulty())) {
            return false;
        }

        // Everything checks out.
        return true;
    }

    /**
     * @returns {Promise.<boolean>}
     * @private
     */
    async _verifyDifficulty() {
        // Extract the dense suffix of the prefix.
        let denseSuffix = await this.prefix.denseSuffix();
        /** Array.<BlockHeader> */
        denseSuffix = denseSuffix.map(block => block.header);
        /** Array.<BlockHeader> */
        const denseChain = denseSuffix.concat(this.suffix.headers);

        // Compute totalDifficulty for each block of the dense chain.
        let totalDifficulty = 0;
        const totalDifficulties = [];
        for (let i = 0; i < denseChain.length; i++) {
            totalDifficulty += denseChain[i].difficulty;
            totalDifficulties[i] = totalDifficulty;
        }

        let headIndex = denseChain.length - 2;
        let tailIndex = headIndex - Policy.DIFFICULTY_BLOCK_WINDOW;
        while (tailIndex >= 0 && headIndex >= 0) {
            const headBlock = denseChain[headIndex];
            const tailBlock = denseChain[tailIndex];
            const deltaTotalDifficulty = totalDifficulties[headIndex] - totalDifficulties[tailIndex];
            const target = BlockUtils.getNextTarget(headBlock, tailBlock, deltaTotalDifficulty);
            const nBits = BlockUtils.targetToCompact(target);

            /** @type {BlockHeader} */
            const checkBlock = denseChain[headIndex + 1];
            if (checkBlock.nBits !== nBits) {
                Log.w(ChainProof, `Block target mismatch: expected=${nBits}, got=${checkBlock.nBits}`);
                return false;
            }

            --headIndex;
            if (tailIndex !== 0 || tailBlock.height !== 1) {
                --tailIndex;
            }
        }

        return true;
    }

    /**
     * @param {BlockHeader} header
     * @returns {Promise.<void>}
     */
    async extend(header) {
        const suffixTail = this._suffix.headers.shift();
        this._suffix.headers.push(header);

        const interlink = await this._prefix.head.getNextInterlink(suffixTail.target);
        const prefixHead = new Block(suffixTail, interlink);
        this._prefix.blocks.push(prefixHead);

        // TODO prune unnecessary blocks from proof

        /*
        const target = BlockUtils.hashToTarget(await prefixHead.hash());
        const depth = BlockUtils.getTargetDepth(target);

        this._chains = this._chains || this._getSuperChains();
        for (let i = depth; i >= 0; i++) {
            if (this._chains[i]) {
                this._chains[i].blocks.push(prefixHead);
            } else {
                this._chains[i] = {blocks: [prefixHead], start: this._prefix.length - 1};
            }
        }

        if (depth - BlockUtils.getTargetDepth(prefixHead.target) <= 0) {
            return;
        }

        for (let i = depth; i>= 0; i++) {
            const superchain = new BlockChain(this._chains[i].blocks);
            if (BaseChain.isGoodSuperChain(superchain, i, Policy.M, Policy.DELTA)) {

            }
        }
        */
    }

    /**
     * @returns {Promise.<Array<{blocks: Array.<Block>, start: number}>>}
     * @private
     */
    async _getSuperChains() {
        const chains = [];
        for (let i = 0; i < this._prefix.length; i++) {
            const block = this._prefix.blocks[i];
            const target = BlockUtils.hashToTarget(await block.pow());
            const depth = BlockUtils.getTargetDepth(target);

            if (chains[depth]) {
                if (chains[depth].start < 0) {
                    chains[depth].start = i;
                }
                chains[depth].blocks.push(block);
            } else if (!chains[depth]) {
                chains[depth] = {blocks: [block], start: i};
            }

            for (let j = depth - 1; j >= 0; j--) {
                if (chains[j]) {
                    chains[j].blocks.push(block);
                } else {
                    chains[j] = {blocks: [block], start: -1};
                }
            }
        }
        return chains;
    }



    /**
     * @returns {string}
     */
    toString() {
        return `ChainProof{prefix=${this._prefix.length}, suffix=${this._suffix.length}, height=${this.head.height}}`;
    }

    /** @type {BlockChain} */
    get prefix() {
        return this._prefix;
    }

    /** @type {HeaderChain} */
    get suffix() {
        return this._suffix;
    }

    /** @type {BlockHeader} */
    get head() {
        return this._suffix.length > 0 ? this._suffix.head : this._prefix.head.header;
    }
}
