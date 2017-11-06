/**
 *
 */
class MinerWorkerPool extends IWorker.Pool(MinerWorker) {
    constructor(size = 1) {
        super((name) => IWorker.startWorkerForProxy(MinerWorker, name), 'miner', size);
        /** @type {boolean} */
        this._miningEnabled = false;
        /** @type {Array.<{minNonce: number, maxNonce: number}>} */
        this._activeNonces = [];
        /** @type {BlockHeader} */
        this._blockHeader = null;
        /** @type {number} */
        this._noncesPerRun = 256;
        /** @type {Observable} */
        this._observable = new Observable();
        /** @type {number} */
        this._shareCompact = Policy.BLOCK_TARGET_MAX;
    }
    
    get noncesPerRun() {
        return this._noncesPerRun;
    }
    
    set noncesPerRun(nonces) {
        this._noncesPerRun = nonces;
    }

    /**
     * @param {string} type
     * @param {Function} callback
     * @return {number}
     */
    on(type, callback) { this._observable.on(type, callback); }

    /**
     * @param {string} type
     * @param {number} id
     */
    off(type, id) { this._observable.off(type, id); }

    /**
     * @param {BlockHeader} blockHeader
     * @param {number} shareCompact target of a share, in compact format.
     */
    startMiningOnBlock(blockHeader, shareCompact = blockHeader.nBits) {
        this._blockHeader = blockHeader;
        this._shareCompact = shareCompact;
        if (!this._miningEnabled) {
            this._activeNonces = [];
            this._miningEnabled = true;
            for (let i = 0; i < this.poolSize; ++i) {
                this._startMiner();
            }
        }
    }

    async _updateToSize() {
        await super._updateToSize();
        while (this._miningEnabled && this._activeNonces.length < this.size) {
            this._startMiner();
        }
    }

    _startMiner() {
        const minNonce = this._activeNonces.length === 0 ? 0 : Math.max.apply(null, this._activeNonces.map((a) => a.maxNonce));
        const maxNonce = minNonce + this._noncesPerRun;
        const nonceRange = {minNonce, maxNonce};
        this._activeNonces.push(nonceRange);
        this._singleMiner(nonceRange);
    }

    /**
     * @param {{minNonce: number, maxNonce: number}} nonceRange
     * @return {Promise.<void>}
     * @private
     */
    async _singleMiner(nonceRange) {
        while (this._miningEnabled) {
            const blockHeader = BlockHeader.copy(this._blockHeader);
            const result = await this.multiMine(blockHeader.serialize(), this._shareCompact, nonceRange.minNonce, nonceRange.maxNonce);
            if (result) {
                const hash = new Hash(result.hash);
                this._observable.fire('share', {
                    blockHeader,
                    nonce: result.nonce,
                    hash
                });
                if (BlockUtils.isProofOfWork(hash, this._blockHeader.target)) {
                    this._miningEnabled = false;
                    return;
                }
            } else {
                this._observable.fire('no-share', {
                    nonce: nonceRange.maxNonce
                });
            }
            if (this._activeNonces.length > this.size) {
                this._activeNonces.splice(this._activeNonces.indexOf(nonce), 1);
                return;
            } else {
                const newMin = Math.max.apply(null, this._activeNonces.map((a) => a.maxNonce));
                const newRange = {minNonce: newMin, maxNonce: newMin + this._noncesPerRun};
                this._activeNonces.splice(this._activeNonces.indexOf(nonceRange), 1, newRange);
                nonceRange = newRange;
            }
        }
    }
}

Class.register(MinerWorkerPool);
