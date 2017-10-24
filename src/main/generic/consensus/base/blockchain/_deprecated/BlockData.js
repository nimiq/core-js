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
Class.register(BlockData);

class SparseBlockData extends BlockData {
    /**
     * @param {Hash|null} predecessor
     * @param {number} totalWork
     * @param {boolean} onMainChain
     */
    constructor(predecessor, totalWork, length, onMainChain = false) {
        super(predecessor, totalWork, onMainChain);
        this._length = length;
    }

    /** @type {number} */
    get length() {
        return this._length;
    }

    /** @type {number} */
    set length(length) {
        this._length = length;
    }
}
Class.register(SparseBlockData);
