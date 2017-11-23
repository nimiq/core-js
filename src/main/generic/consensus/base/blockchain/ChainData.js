class ChainData {
    /**
     * @param {ChainData} o
     * @returns {ChainData}
     */
    static copy(o) {
        if (!o) return o;
        return new ChainData(
            Block.copy(o._head),
            o._totalDifficulty,
            o._totalWork,
            o._onMainChain
        );
    }

    /**
     * @param {Block} head
     * @param {number} totalDifficulty
     * @param {number} totalWork
     * @param {boolean} onMainChain
     */
    constructor(head, totalDifficulty, totalWork, onMainChain = false) {
        this._head = head;
        this._totalDifficulty = totalDifficulty;
        this._totalWork = totalWork;
        this._onMainChain = onMainChain;
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
