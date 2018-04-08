/**
 * @template V
 */
class UniqueQueue extends Queue {
    /**
     * @param {function(o: object): string} [fnHash]
     */
    constructor(fnHash) {
        super(fnHash);
    }

    /**
     * @param {*} args
     * @returns {LinkedList.<V|*>}
     * @protected
     * @override
     */
    _newQueue(...args) {
        return new UniqueLinkedList(...args);
    }

    /**
     * @param {V|*} value
     * @returns {boolean}
     */
    contains(value) {
        return this._queue.contains(value);
    }

    /**
     * @param {V|*} value
     * @returns {void}
     * @override
     */
    remove(value) {
        this._queue.remove(value);
    }

    /**
     * @param {V|*} value
     * @returns {void}
     */
    requeue(value) {
        this._queue.moveBack(value);
    }
}
Class.register(UniqueQueue);
