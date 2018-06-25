class InvRequestManager {
    constructor() {
        /** @type {HashMap.<InvVector, {current: BaseConsensusAgent, waiting: Set.<BaseConsensusAgent>}>} */
        this._vectorsToRequest = new HashMap();
        /** @type {Timers} */
        this._timers = new Timers();
    }

    /**
     * @param {BaseConsensusAgent} agent
     * @param {InvVector} vector
     */
    askToRequestVector(agent, vector) {
        if (agent.syncing || this._vectorsToRequest.length > InvRequestManager.MAX_INV_MANAGED) {
            agent.requestVector(vector);
            return;
        }
        if (this._vectorsToRequest.contains(vector)) {
            const o = this._vectorsToRequest.get(vector);
            if (o.current.peer.channel.closed) {
                o.current = null;
            }
            if (o.current === null) {
                o.current = agent;
                this._request(vector);
            } else {
                o.waiting.add(agent);
            }
        } else {
            this._vectorsToRequest.put(vector, {current: agent, waiting: new Set()});
            this._request(vector);
        }
    }

    /**
     * @param {InvVector} vector
     * @private
     */
    _request(vector) {
        Assert.that(this._vectorsToRequest.contains(vector));
        const agent = this._vectorsToRequest.get(vector).current;
        Assert.that(agent);
        agent.requestVector(vector);
        this._timers.resetTimeout(vector.hash, () => this.noteVectorNotReceived(agent, vector), InvRequestManager.MAX_TIME_PER_VECTOR);
    }

    /**
     * @param {BaseConsensusAgent} agent
     * @param {InvVector} vector
     */
    noteVectorNotReceived(agent, vector) {
        if (this._vectorsToRequest.contains(vector)) {
            const o = this._vectorsToRequest.get(vector);
            if (o.current !== agent) {
                o.waiting.delete(agent);
            } else {
                this._timers.clearTimeout(vector.hash);
                o.current = null;
                if (o.waiting.size !== 0) {
                    o.current = o.waiting.values().next().value;
                    o.waiting.delete(o.current);
                    this._request(vector);
                }
                if (o.current === null) {
                    this._vectorsToRequest.remove(vector);
                }
            }
        }
    }

    noteVectorReceived(vector) {
        this._timers.clearTimeout(vector.hash);
        this._vectorsToRequest.remove(vector);
    }
}

InvRequestManager.MAX_TIME_PER_VECTOR = 10000;
InvRequestManager.MAX_INV_MANAGED = 10000;

Class.register(InvRequestManager);
