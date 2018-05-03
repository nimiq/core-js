class ChainData {
    /**
     * @param {Block} block
     * @param {SuperBlockCounts} [superBlockCounts]
     * @returns {Promise.<ChainData>}
     */
    static async initial(block, superBlockCounts) {
        const pow = await block.pow();
        const totalWork = BlockUtils.realDifficulty(pow);

        const depth = BlockUtils.getHashDepth(pow);
        if (superBlockCounts) {
            superBlockCounts = superBlockCounts.copyAndAdd(depth);
        } else {
            superBlockCounts = new SuperBlockCounts();
            superBlockCounts.add(depth);
        }

        return new ChainData(block, block.difficulty, totalWork, superBlockCounts, true);
    }

    /**
     * @param {Block} head
     * @param {BigNumber} totalDifficulty
     * @param {BigNumber} totalWork
     * @param {SuperBlockCounts} superBlockCounts
     * @param {boolean} [onMainChain]
     * @param {Hash} [mainChainSuccessor]
     */
    constructor(head, totalDifficulty, totalWork, superBlockCounts, onMainChain = false, mainChainSuccessor = null) {
        this._head = head;
        this._totalDifficulty = totalDifficulty;
        this._totalWork = totalWork;
        this._superBlockCounts = superBlockCounts;
        this._onMainChain = onMainChain;
        this._mainChainSuccessor = mainChainSuccessor;
        this._height = head.height;
    }

    /**
     * @returns {{_head: SerialBuffer, _totalDifficulty: string, _totalWork: string, _superBlockCounts: Array.<number>, _onMainChain: boolean, _mainChainSuccessor: ?SerialBuffer, _height: number, _pow: SerialBuffer}}
     */
    toObj() {
        Assert.that(this._head.header._pow instanceof Hash, 'Expected cached PoW hash');
        return {
            _head: this._head.toLight().serialize(),
            _totalDifficulty: this._totalDifficulty.toString(),
            _totalWork: this._totalWork.toString(),
            _superBlockCounts: this._superBlockCounts.array,
            _onMainChain: this._onMainChain,
            _mainChainSuccessor: this._mainChainSuccessor ? this._mainChainSuccessor.serialize() : null,
            _height: this._head.height,
            _pow: this._head.header._pow.serialize()
        };
    }

    /**
     * @param {{_head: Uint8Array, _totalDifficulty: string, _totalWork: string, _superBlockCounts: Array.<number>, _onMainChain: boolean, _mainChainSuccessor: ?Uint8Array, _height: number, _pow: Uint8Array}} obj
     * @param {string} [hashBase64]
     * @returns {ChainData}
     */
    static fromObj(obj, hashBase64) {
        if (!obj) return null;
        const head = Block.unserialize(new SerialBuffer(obj._head));
        head.header._pow = Hash.unserialize(new SerialBuffer(obj._pow));
        head.header._hash = hashBase64 ? Hash.fromBase64(hashBase64) : null;
        const superBlockCounts = new SuperBlockCounts(obj._superBlockCounts);
        const successor = obj._mainChainSuccessor ? Hash.unserialize(new SerialBuffer(obj._mainChainSuccessor)) : null;
        return new ChainData(
            head,
            new BigNumber(obj._totalDifficulty),
            new BigNumber(obj._totalWork),
            superBlockCounts,
            obj._onMainChain,
            successor
        );
    }

    /**
     * @returns {ChainData}
     */
    shallowCopy() {
        return new ChainData(this.head.shallowCopy(), this.totalDifficulty, this.totalWork, this.superBlockCounts, this.onMainChain, this.mainChainSuccessor);
    }

    /**
     * @param {Block} block
     * @returns {Promise.<ChainData>}
     */
    async nextChainData(block) {
        Assert.that(this._totalDifficulty > 0);

        const pow = await block.pow();
        const totalDifficulty = this.totalDifficulty.plus(block.difficulty);
        const totalWork = this.totalWork.plus(BlockUtils.realDifficulty(pow));
        const superBlockCounts = this.superBlockCounts.copyAndAdd(BlockUtils.getHashDepth(pow));
        return new ChainData(block, totalDifficulty, totalWork, superBlockCounts);
    }

    /**
     * @param {Block} block
     * @returns {Promise.<ChainData>}
     */
    async previousChainData(block) {
        Assert.that(this._totalDifficulty > 0);

        const pow = await this.head.pow();
        const totalDifficulty = this.totalDifficulty.minus(this.head.difficulty);
        const totalWork = this.totalWork.minus(BlockUtils.realDifficulty(pow));
        const superBlockCounts = this.superBlockCounts.copyAndSubtract(BlockUtils.getHashDepth(pow));
        return new ChainData(block, totalDifficulty, totalWork, superBlockCounts);
    }

    /** @type {Block} */
    get head() {
        return this._head;
    }

    /** @type {BigNumber} */
    get totalDifficulty() {
        return this._totalDifficulty;
    }

    /** @type {BigNumber} */
    get totalWork() {
        return this._totalWork;
    }

    /** @type {SuperBlockCounts} */
    get superBlockCounts() {
        return this._superBlockCounts;
    }

    /** @type {boolean} */
    get onMainChain() {
        return this._onMainChain;
    }

    /** @type {boolean} */
    set onMainChain(onMainChain) {
        this._onMainChain = onMainChain;
    }

    /** @type {Hash} */
    get mainChainSuccessor() {
        return this._mainChainSuccessor;
    }

    /** @type {Hash} */
    set mainChainSuccessor(mainChainSuccessor) {
        this._mainChainSuccessor = mainChainSuccessor;
    }
}
Class.register(ChainData);

class SuperBlockCounts {
    /**
     * @constructor
     * @param {Array.<number>} array
     */
    constructor(array = []) {
        this._arr = array;
    }

    /**
     * @param {number} depth
     */
    add(depth) {
        Assert.that(NumberUtils.isUint8(depth));
        for (let i = 0; i <= depth; i++) {
            this._arr[i] = this.get(i) + 1;
        }
    }

    /**
     * @param {number} depth
     */
    subtract(depth) {
        Assert.that(NumberUtils.isUint8(depth));
        for (let i = 0; i <= depth; i++) {
            this._arr[i]--;
            Assert.that(this._arr[i] >= 0);
        }
    }

    /**
     * @param {number} depth
     * @returns {SuperBlockCounts}
     */
    copyAndAdd(depth) {
        const copy = new SuperBlockCounts(this._arr.slice());
        copy.add(depth);
        return copy;
    }

    /**
     * @param {number} depth
     * @returns {SuperBlockCounts}
     */
    copyAndSubtract(depth) {
        const copy = new SuperBlockCounts(this._arr.slice());
        copy.subtract(depth);
        return copy;
    }

    /**
     * @param {number} depth
     * @returns {number}
     */
    get(depth) {
        Assert.that(NumberUtils.isUint8(depth));
        return this._arr[depth] || 0;
    }

    /**
     * @param {number} m
     * @returns {number}
     */
    getCandidateDepth(m) {
        for (let i = this._arr.length - 1; i >= 0; i--) {
            if (this._arr[i] >= m) {
                return i;
            }
        }
        return 0;
    }

    /** @type {number} */
    get length() {
        return this._arr.length;
    }

    /** @type {Array.<number>} */
    get array() {
        return this._arr;
    }
}
Class.register(SuperBlockCounts);
