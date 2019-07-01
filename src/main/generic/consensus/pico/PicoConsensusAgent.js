class PicoConsensusAgent extends BaseMiniConsensusAgent {
    /**
     * @param {PicoConsensus} consensus
     * @param {Peer} peer
     * @param {Subscription} targetSubscription
     */
    constructor(consensus, peer, targetSubscription) {
        super(consensus.blockchain, consensus.mempool, consensus.network.time, peer, consensus.invRequestManager, targetSubscription);
        this._consensus = consensus;
    }

    /**
     * @param {Hash} hash
     * @param {Block} block
     * @returns {Promise.<void>}
     * @protected
     * @override
     */
    async _processBlock(hash, block) {
        if (this._peer.headHash.equals(hash)) {
            const result = await this._blockchain.pushBlock(block);
            if (result === PicoChain.ERR_INVALID) {
                this._peer.channel.close(CloseType.INVALID_BLOCK, 'received invalid block');
            } else if (result === PicoChain.ERR_INCONSISTENT) {
                this.fire('consensus-failed');
            } else if (this._syncing) {
                this._syncFinished();
            }
        } else {
            if (await this._blockchain.pushBlock(block) === PicoChain.ERR_INVALID) {
                this._peer.channel.close(CloseType.INVALID_BLOCK, 'received invalid block');
            }
        }
    }

    async syncBlockchain() {
        this._syncing = true;

        const headBlock = await this._getBlock(this._peer.headHash, /*includeForks*/ true);
        if (!headBlock) {
            try {
                const hash = this._peer.headHash;
                const block = await this.requestBlock(hash);
                await this._processBlock(hash, block);
            } catch (e) {
                this._peer.channel.close(CloseType.ABORTED_SYNC, 'aborted sync');
            }
        } else {
            this._syncFinished();
        }
    }

    /**
     * @returns {void}
     * @private
     */
    _syncFinished() {
        this._syncing = false;
        this._synced = true;

        this.requestMempool();

        this.fire('sync');
    }

    /**
     * @param {Hash} hash
     * @param {Transaction} transaction
     * @returns {Promise.<void>}
     * @protected
     * @override
     */
    async _processTransaction(hash, transaction) {
        await this._consensus.mempool.pushTransaction(transaction);
    }

    /**
     *
     * @param {Hash} hash
     * @param {boolean} [includeForks = false]
     * @param {boolean} [includeBody = false]
     * @returns {Promise.<?Block>}
     * @protected
     * @override
     */
    _getBlock(hash, includeForks = false, includeBody = false) {
        return this._blockchain.getBlock(hash, includeForks, includeBody);
    }

    /**
     * @param {Hash} hash
     * @param {boolean} [includeForks = false]
     * @returns {Promise.<?Uint8Array>}
     * @protected
     * @override
     */
    _getRawBlock(hash, includeForks = false) {
        return this._blockchain.getRawBlock(hash, includeForks);
    }

    /**
     * @param {Hash} hash
     * @returns {Transaction}
     * @protected
     * @override
     */
    _getTransaction(hash) {
        return this._consensus.mempool.getTransaction(hash);
    }
}

Class.register(PicoConsensusAgent);
