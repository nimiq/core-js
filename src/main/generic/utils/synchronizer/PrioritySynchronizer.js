class PrioritySynchronizer extends Observable {
    /**
     * @param {number} numPriorities
     */
    constructor(numPriorities) {
        super();
        this._queues = [];
        for (let i = 0; i < numPriorities; i++) {
            this._queues[i] = [];
        }
        this._working = false;
    }

    /**
     * Push function to the Synchronizer for later, synchronous execution
     * @template T
     * @param {number} priority A discrete priority, 0 being highest.
     * @param {function():T} fn Function to be invoked later by this Synchronizer
     * @returns {Promise.<T>}
     */
    push(priority, fn) {
        Assert.that(priority >= 0 && priority < this._queues.length && Number.isInteger(priority), 'Invalid priority');

        return new Promise((resolve, reject) => {
            this._queues[priority].push({fn: fn, resolve: resolve, reject: reject});
            if (!this._working) {
                this._doWork().catch(Log.w.tag(PrioritySynchronizer));
            }
        });
    }

    /**
     * Reject all jobs in the queue and clear it.
     * @returns {void}
     */
    clear() {
        for (const queue of this._queues) {
            for (const job of queue) {
                if (job.reject) job.reject();
            }
        }
        this._queues = [];
    }

    async _doWork() {
        this._working = true;
        this.fire('work-start', this);

        for (const queue of this._queues) {
            while (queue.length > 0) {
                const job = queue.shift();
                try {
                    const result = await job.fn();
                    job.resolve(result);
                } catch (e) {
                    if (job.reject) job.reject(e);
                }
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
Class.register(PrioritySynchronizer);
