class Synchronizer extends Observable {
    constructor() {
        super();
        this._queue = [];
        this._working = false;
    }

    /**
     * Push function to the Synchronizer for later, synchronous execution
     * @template T
     * @param {function():T} fn Function to be invoked later by this Synchronizer
     * @returns {Promise.<T>}
     */
    push(fn) {
        return new Promise((resolve, error) => {
            this._queue.push({fn: fn, resolve: resolve, error: error});
            if (!this._working) {
                this._doWork();
            }
        });
    }

    async _doWork() {
        this._working = true;
        this.fire('work-start', this);

        while (this._queue.length) {
            const job = this._queue.shift();
            try {
                const result = await job.fn();
                job.resolve(result);
            } catch (e) {
                if (job.error) job.error(e);
            }
        }

        this._working = false;
        this.fire('work-end', this);
    }

    /** @type {boolean} */
    get working() {
        return this._working;
    }
}
Class.register(Synchronizer);
