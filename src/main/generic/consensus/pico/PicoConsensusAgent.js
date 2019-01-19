class PicoConsensusAgent extends BaseMiniConsensusAgent {
    /**
     * @param {PicoConsensus} consensus
     * @param {Peer} peer
     * @param {Subscription} targetSubscription
     */
    constructor(consensus, peer, targetSubscription) {
        super(consensus.blockchain, consensus.network.time, peer, consensus.invRequestManager, targetSubscription);
        this._consensus = consensus;
    }

    onHeadUpdated() {
        super.onHeadUpdated();
        this.syncBlockchain();
    }

    async _processBlock(hash, block) {
        if (this._peer.headHash.equals(hash)) {
            const result = await this._blockchain.pushBlock(block);
            if (result === PicoChain.ERR_INVALID) {
                // TODO: Ban peer?
            } else if (result === PicoChain.ERR_INCONSISTENT) {
                this.fire('out-of-sync');
                this.fire('consensus-failed');
            } else if (this._syncing) {
                await this._syncFinished();
            }
        } else {
            if (await this._blockchain.pushBlock(block) === PicoChain.ERR_INVALID) {
                // TODO: Ban peer?
            }
        }
    }

    _preProcessBlockMessage(msg) {
        return new BlockMessage(msg.block.toLight());
    }

    async syncBlockchain() {
        this._syncing = true;

        const headBlock = await this._getBlock(this._peer.headHash);
        if (!headBlock) {
            this.requestVector(new InvVector(InvVector.Type.BLOCK, this._peer.headHash));
        } else {
            await this._syncFinished();
        }
    }

    /**
     * @returns {void}
     * @private
     */
    async _syncFinished() {
        this._syncing = false;
        this._synced = true;

        this.requestMempool();

        this.fire('sync');
    }

    _getBlock(hash, includeForks, includeBody) {
        return this._blockchain.getBlock(hash, includeForks);
    }

    _getRawBlock(hash, includeForks = false) {
        return this._blockchain.getRawBlock(hash, includeForks);
    }

    _getTransaction(hash) {
        // TODO: mempool
        return undefined;
    }
}

Class.register(PicoConsensusAgent);
