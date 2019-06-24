class BlockProducer {

    constructor(blockchain, accounts, mempool, time) {
        /** @type {BaseChain} */
        this._blockchain = blockchain;
        /** @type {Accounts} */
        this._accounts = accounts;
        /** @type {Mempool} */
        this._mempool = mempool;
        /** @type {Time} */
        this._time = time;
    }


    /**
     * @param {Address} address
     * @param {Uint8Array} [extraData]
     * @return {Promise.<Block>}
     */
    async getNextBlock(address, extraData = new Uint8Array(0)) {
        const nextTarget = await this._blockchain.getNextTarget();
        const interlink = await this._getNextInterlink(nextTarget);
        const body = await this._getNextBody(interlink.serializedSize, address, extraData);
        const header = await this._getNextHeader(nextTarget, interlink, body);
        if (!(await this._blockchain.getNextTarget()).equals(nextTarget)) return this.getNextBlock(address, extraData);
        return new Block(header, interlink, body);
    }

    /**
     * @param {BigNumber} nextTarget
     * @param {BlockInterlink} interlink
     * @param {BlockBody} body
     * @return {Promise.<BlockHeader>}
     * @package
     */
    async _getNextHeader(nextTarget, interlink, body) {
        const prevHash = this._blockchain.headHash;
        const interlinkHash = interlink.hash();
        const height = this._blockchain.height + 1;

        // Compute next accountsHash.
        const accounts = await this._accounts.transaction();
        let accountsHash;
        try {
            await accounts.commitBlockBody(body, height, this._blockchain.transactionCache);
            accountsHash = await accounts.hash();
        } catch (e) {
            throw new Error(`Invalid block body: ${e.message}`);
        } finally {
            await accounts.abort();
        }

        const bodyHash = body.hash();
        const timestamp = this._getNextTimestamp();
        const nBits = BlockUtils.targetToCompact(nextTarget);
        const nonce = 0;
        return new BlockHeader(prevHash, interlinkHash, bodyHash, accountsHash, nBits, height, timestamp, nonce);
    }

    /**
     * @param {BigNumber} nextTarget
     * @returns {Promise.<BlockInterlink>}
     * @package
     */
    _getNextInterlink(nextTarget) {
        return this._blockchain.head.getNextInterlink(nextTarget);
    }

    /**
     * @param {number} interlinkSize
     * @param {Address} address
     * @param {Uint8Array} extraData
     * @return {BlockBody}
     * @package
     */
    async _getNextBody(interlinkSize, address, extraData) {
        const maxSize = Policy.BLOCK_SIZE_MAX
            - BlockHeader.SERIALIZED_SIZE
            - interlinkSize
            - BlockBody.getMetadataSize(extraData);
        const transactions = await this._mempool.getTransactionsForBlock(maxSize);
        const prunedAccounts = await this._accounts.gatherToBePrunedAccounts(transactions, this._blockchain.height + 1, this._blockchain.transactionCache);
        return new BlockBody(address, transactions, extraData, prunedAccounts);
    }

    /**
     * @return {number}
     * @package
     */
    _getNextTimestamp() {
        const now = Math.floor(this._time.now() / 1000);
        return Math.max(now, this._blockchain.head.timestamp + 1);
    }

}

Class.register(BlockProducer);
