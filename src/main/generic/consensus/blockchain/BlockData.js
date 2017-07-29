class BlockData {
    /**
     * @param {Hash|null} predecessor
     * @param {number} totalWork
     * @param {boolean} onMainChain
     */
    constructor(predecessor, totalWork, onMainChain = false) {
        this._predecessor = predecessor;
        this._totalWork = totalWork;
        this._onMainChain = onMainChain;

        /** @type {HashSet.<Hash>} */
        this._successors = new HashSet();
    }

    /** @type {Hash} */
    get predecessor() {
        return this._predecessor;
    }

    /** @type {Hash} */
    set predecessor(predecessor) {
        if (this._predecessor) throw 'BlockData.predecessor already set';
        this._predecessor = predecessor;
    }

    /** @type {HashSet.<Hash>} */
    get successors() {
        return this._successors;
    }

    /** @type {number} */
    get totalWork() {
        return this._totalWork;
    }

    /** @type {number} */
    set totalWork(totalWork) {
        this._totalWork = totalWork;
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
