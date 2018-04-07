class Synchronizer extends Observable {
    /**
     * @param {number} [throttleAfter]
     * @param {number} [throttleWait]
     */
    constructor(throttleAfter, throttleWait) {
        super();

        /** @type {LinkedList.<object>} */
        this._queue = new LinkedList();
        /** @type {boolean} */
        this._working = false;
        /** @type {?number} */
        this._throttleAfter = throttleAfter;
        /** @type {?number} */
        this._throttleWait = throttleWait;
        /** @type {number} */
        this._elapsed = 0;
        /** @type {number} */
        this._totalElapsed = 0;
        /** @type {number} */
        this._totalJobs = 0;
        /** @type {number} */
        this._totalThrottles = 0;
    }

    /**
     * Push function to the Synchronizer for later, synchronous execution
     * @template T
     * @param {function():T} fn Function to be invoked later by this Synchronizer
     * @returns {Promise.<T>}
     */
    push(fn) {
        return new Promise((resolve, reject) => {
            this._queue.push({fn: fn, resolve: resolve, reject: reject});
            if (!this._working) {
                this.fire('work-start', this);
                this._doWork().catch(Log.w.tag(Synchronizer));
            }
        });
    }

    /**
     * Reject all jobs in the queue and clear it.
     * @returns {void}
     */
    clear() {
        for (const job of this._queue) {
            if (job.reject) job.reject();
        }
        this._queue.clear();
    }

    async _doWork() {
        this._working = true;

        while (this._queue.length > 0) {
            const start = Date.now();

            const job = this._queue.shift();
            try {
                const result = await job.fn();
                job.resolve(result);
            } catch (e) {
                if (job.reject) job.reject(e);
            }

            this._totalJobs++;

            if (this._throttleAfter !== undefined) {
                this._elapsed += Date.now() - start;
                if (this._elapsed >= this._throttleAfter) {
                    this._totalElapsed += this._elapsed;
                    this._totalThrottles++;
                    this._elapsed = 0;
                    setTimeout(this._doWork.bind(this), this._throttleWait);
                    return;
                }
            }
        }

        this._working = false;
        this._totalElapsed += this._elapsed;
        this._elapsed = 0;
        this.fire('work-end', this);
    }

    /** @type {boolean} */
    get working() {
        return this._working;
    }

    /** @type {number} */
    get length() {
        return this._queue.length;
    }

    /** @type {number} */
    get totalElapsed() {
        return this._totalElapsed;
    }

    /** @type {number} */
    get totalJobs() {
        return this._totalJobs;
    }

    /** @type {number} */
    get totalThrottles() {
        return this._totalThrottles;
    }
}
Class.register(Synchronizer);
