class NanoPoolMiner extends BasePoolMiner {
    /**
     * @param {BaseChain} blockchain
     * @param {Time} time
     * @param {Address} address
     * @param {number} deviceId
     */
    constructor(blockchain, time, address, deviceId) {
        super(blockchain, null, null, time, address, deviceId);

        this.on('share', (block) => this._onBlockMined(block));
    }

    /**
     * @param {Block} block
     * @private
     */
    _onBlockMined(block) {
        this._send({
            message: 'share',
            block: BufferUtils.toBase64(block.serialize())
        });
    }

    _onMessage(msg) {
        if (msg && msg.message === 'new-block') {
            this._handleNewBlock(msg);
        } else {
            super._onMessage(msg);
        }
    }

    async _handleNewBlock(msg) {
        /** @type {Block} */
        const previousBlock = Block.unserialize(BufferUtils.fromBase64(msg.previousBlock));
        Log.d(NanoPoolMiner, `New base block from pool server, on top of ${previousBlock.hash()}`);
        let knownBlock;
        if (this._blockchain.headHash.equals(previousBlock.hash())) {
            // We are on the same head, that's great.
            this._poolNextTarget = await this._blockchain.getNextTarget();
        } else if (this._blockchain.headHash.equals(previousBlock.prevHash)) {
            // We don't know the new block yet, make sure it's kinda valid.
            if (!(await previousBlock.isImmediateSuccessorOf(this._blockchain.head))) {
                Log.w(NanoPoolMiner, `${previousBlock.hash()} (from pool) is not an immediate successor of ${this._blockchain.headHash}, but is announced as such.`);
                this.stopWork();
                return;
            }
            this._poolNextTarget = await this._blockchain.getNextTarget(this._blockchain.head, previousBlock);
        } else if (this._blockchain.head.prevHash.equals(previousBlock.hash())) {
            // Pool does not know the new block yet, waiting for it.
            this.stopWork();
            return;
        } else if (this._blockchain.height === previousBlock.height && (knownBlock = await this._blockchain.getBlock(previousBlock.prevHash))) {
            // Pool is on a different fork of length 1 and we want to please our pool
            if (!(await previousBlock.isImmediateSuccessorOf(knownBlock))) {
                Log.w(NanoPoolMiner, `${previousBlock.hash()} (from pool) is not an immediate successor of ${knownBlock}, but is announced as such.`);
                this.stopWork();
                return;
            }
        } else if ((knownBlock = await this._blockchain.getBlock(previousBlock.prevHash, true))) {
            // Pool mines a fork
            Log.w(NanoPoolMiner, `${previousBlock.hash()} (from pool) is a known fork, we don't mine on forks.`);
            this.stopWork();
            return;
        } else {
            Log.w(NanoPoolMiner, `${previousBlock.hash()} (from pool) is unknown and not a successor of the head`);
            this.stopWork();
            return;
        }
        /** @type {BlockInterlink} */
        this._poolNextInterlink = await previousBlock.getNextInterlink(this._poolNextTarget);
        /** @type {Block} */
        this._poolPrevBlock = previousBlock;
        /** @type {Hash} */
        this._poolAccountsHash = Hash.unserialize(BufferUtils.fromBase64(msg.accountsHash));
        /** @type {Hash} */
        this._poolBodyHash = Hash.unserialize(BufferUtils.fromBase64(msg.bodyHash));

        // Start with a new block
        if (this.working) {
            this._startWork().catch(Log.w.tag(Miner));
        } else {
            this.startWork();
        }
    }

    getNextBlock() {
        if (!this._poolPrevBlock) {
            return null;
        }
        return new Block(
            new BlockHeader(
                this._poolPrevBlock.hash(),
                this._poolNextInterlink.hash(),
                this._poolBodyHash,
                this._poolAccountsHash,
                BlockUtils.targetToCompact(this._poolNextTarget),
                this._poolPrevBlock.height + 1,
                this._getNextTimestamp(),
                0),
            this._poolNextInterlink);
    }

    _register() {
        this._send({
            message: 'register',
            mode: 'nano',
            address: this._ourAddress.toUserFriendlyAddress(),
            deviceId: this._deviceId,
        });
    }

    _turnPoolOff() {
        super._turnPoolOff();
        this.stopWork();
    }
}

Class.register(NanoPoolMiner);
