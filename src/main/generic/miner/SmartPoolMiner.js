class SmartPoolMiner extends BasePoolMiner {
    /**
     * @param {BaseChain} blockchain
     * @param {Accounts} accounts
     * @param {Mempool} mempool
     * @param {Time} time
     * @param {Address} address
     * @param {number} deviceId
     * @param {Uint8Array} [extraData=new Uint8Array(0)]
     * @param {string} [deviceLabel]
     */
    constructor(blockchain, accounts, mempool, time, address, deviceId, extraData = new Uint8Array(0), deviceLabel) {
        super(blockchain, accounts, mempool, time, address, deviceId, extraData, deviceLabel);

        this.on('share', (block, fullValid) => this._onBlockMined(block, fullValid));
    }

    /**
     * @param {Block} block
     * @param {boolean} fullValid
     * @private
     */
    async _onBlockMined(block, fullValid) {
        this._send({
            message: 'share',
            blockHeader: BufferUtils.toBase64(block.header.serialize()),
            minerAddrProof: BufferUtils.toBase64((await MerklePath.compute(block.body.getMerkleLeafs(), block.minerAddr)).serialize()),
            extraDataProof: BufferUtils.toBase64((await MerklePath.compute(block.body.getMerkleLeafs(), block.body.extraData)).serialize()),
            block: fullValid ? BufferUtils.toBase64(block.serialize()) : undefined
        });
    }

    _register() {
        this._send({
            message: 'register',
            mode: 'smart',
            address: this._ourAddress.toUserFriendlyAddress(),
            deviceId: this._deviceId,
            deviceLabel: this._deviceLabel,
            genesisHash: BufferUtils.toBase64(GenesisConfig.GENESIS_HASH.serialize())
        });
    }
}

Class.register(SmartPoolMiner);
