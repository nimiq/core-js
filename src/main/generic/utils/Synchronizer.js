class Synchronizer {
    constructor() {
        this._queue = [];
        this._working = false;
    }

    push(fn, resolve, error) {
        this._queue.push({fn: fn, resolve: resolve, error: error});
        if (!this._working) {
            this._doWork();
        }
    }

    async _doWork() {
        this._working = true;
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
    }
}
Class.register(Synchronizer);