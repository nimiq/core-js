class ChainData {
    /**
     * @param {ChainData} o
     * @returns {ChainData}
     */
    static copy(o) {
        if (!o) return o;
        const head = Block.unserialize(new SerialBuffer(o._head));
        head.header._pow = Hash.unserialize(new SerialBuffer(o._pow));
        const superBlockCounts = new SuperBlockCounts(o._superBlockCounts);
        return new ChainData(
            head,
            o._totalDifficulty,
            o._totalWork,
            superBlockCounts,
            o._onMainChain
        );
    }

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
            superBlockCounts.add(BlockUtils.getHashDepth(pow));
        }

        return new ChainData(block, block.difficulty, totalWork, superBlockCounts, true);
    }

    /**
     * @param {Block} head
     * @param {number} totalDifficulty
     * @param {number} totalWork
     * @param {SuperBlockCounts} superBlockCounts
     * @param {boolean} onMainChain
     */
    constructor(head, totalDifficulty, totalWork, superBlockCounts, onMainChain = false) {
        this._head = head;
        this._totalDifficulty = totalDifficulty;
        this._totalWork = totalWork;
        this._superBlockCounts = superBlockCounts;
        this._onMainChain = onMainChain;
        this._height = head.height;
    }

    stripDown() {
        Assert.that(this._head.header._pow instanceof Hash, 'Expected cached PoW hash');
        return {
            _head: this._head.serialize(),
            _totalDifficulty: this._totalDifficulty,
            _totalWork: this._totalWork,
            _superBlockCounts: this._superBlockCounts.array,
            _onMainChain: this._onMainChain,
            _height: this._height,
            _pow: this._head.header._pow.serialize()
        };
    }

    /**
     * @param {Block} block
     * @returns {Promise.<ChainData>}
     */
    async nextChainData(block) {
        Assert.that(this._totalDifficulty > 0);

        const pow = await block.pow();
        const totalDifficulty = this.totalDifficulty + block.difficulty;
        const totalWork = this.totalWork + BlockUtils.realDifficulty(pow);
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
        const totalDifficulty = this.totalDifficulty - this.head.difficulty;
        const totalWork = this.totalWork - BlockUtils.realDifficulty(pow);
        const superBlockCounts = this.superBlockCounts.copyAndSubtract(BlockUtils.getHashDepth(pow));
        return new ChainData(block, totalDifficulty, totalWork, superBlockCounts);
    }

    /** @type {Block} */
    get head() {
        return this._head;
    }

    /** @type {number} */
    get totalDifficulty() {
        return this._totalDifficulty;
    }

    /** @type {number} */
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

    /** @type {Array.<number>} */
    get array() {
        return this._arr;
    }
}
Class.register(SuperBlockCounts);
