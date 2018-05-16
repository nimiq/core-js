class SmartPoolMiner extends BasePoolMiner {
    /**
     * @param {BaseChain} blockchain
     * @param {Accounts} accounts
     * @param {Mempool} mempool
     * @param {Time} time
     * @param {Address} address
     * @param {number} deviceId
     * @param {object|null} deviceData
     * @param {Uint8Array} [extraData=new Uint8Array(0)]
     */
    constructor(blockchain, accounts, mempool, time, address, deviceId, deviceData, extraData = new Uint8Array(0)) {
        super(BasePoolMiner.Mode.SMART, blockchain, accounts, mempool, time, address, deviceId, extraData);

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
}

Class.register(SmartPoolMiner);
