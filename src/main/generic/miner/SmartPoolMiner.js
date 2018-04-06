class SmartPoolMiner extends BasePoolMiner {
    /**
     * @param {BaseChain} blockchain
     * @param {Accounts} accounts
     * @param {Mempool} mempool
     * @param {Time} time
     * @param {Address} address
     * @param {number} deviceId
     * @param {Uint8Array} [extraData=new Uint8Array(0)]
     */
    constructor(blockchain, accounts, mempool, time, address, deviceId, extraData = new Uint8Array(0)) {
        super(blockchain, accounts, mempool, time, address, deviceId, extraData);

        this.on('share', (block) => this._onBlockMined(block));
    }

    /**
     * @param {Block} block
     * @private
     */
    async _onBlockMined(block) {
        this._send({
            message: 'share',
            blockHeader: BufferUtils.toBase64(block.header.serialize()),
            minerAddrProof: BufferUtils.toBase64((await MerklePath.compute(block.body.getMerkleLeafs(), block.minerAddr)).serialize()),
            extraDataProof: BufferUtils.toBase64((await MerklePath.compute(block.body.getMerkleLeafs(), block.body.extraData)).serialize())
        });
    }

    _register() {
        this._send({
            message: 'register',
            mode: 'smart',
            address: this._ourAddress.toUserFriendlyAddress(),
            deviceId: this._deviceId,
            genesisHash: BufferUtils.toBase64(GenesisConfig.GENESIS_HASH.serialize())
        });
    }
}

Class.register(SmartPoolMiner);
