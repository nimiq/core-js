class Consensus {
    /**
     * @return {Promise.<FullConsensus>}
     */
    static async full() {
        await Crypto.prepareSyncCryptoWorker();

        /** @type {ConsensusDB} */
        const db = await ConsensusDB.getFull();
        /** @type {Accounts} */
        const accounts = await Accounts.getPersistent(db);
        /** @type {FullChain} */
        const blockchain = await FullChain.getPersistent(db, accounts);
        /** @type {Mempool} */
        const mempool = new Mempool(blockchain, accounts);
        /** @type {Services} */
        const services = new Services(Services.FULL, Services.FULL);
        /** @type {Network} */
        const network = await new Network(blockchain, services);

        return new FullConsensus(blockchain, mempool, network);
    }

    /**
     * @return {Promise.<LightConsensus>}
     */
    static async light() {
        await Crypto.prepareSyncCryptoWorker();

        /** @type {ConsensusDB} */
        const db = await ConsensusDB.getLight();
        /** @type {Accounts} */
        const accounts = await Accounts.getPersistent(db);
        /** @type {LightChain} */
        const blockchain = await LightChain.getPersistent(db, accounts);
        /** @type {Mempool} */
        const mempool = new Mempool(blockchain, accounts);
        /** @type {Services} */
        const services = new Services(Services.LIGHT, Services.LIGHT | Services.FULL);
        /** @type {Network} */
        const network = await new Network(blockchain, services);

        return new LightConsensus(blockchain, mempool, network);
    }

    /**
     * @return {Promise.<NanoConsensus>}
     */
    static async nano() {
        await Crypto.prepareSyncCryptoWorker();

        /** @type {NanoChain} */
        const blockchain = await new NanoChain();
        /** @type {NanoMempool} */
        const mempool = new NanoMempool();
        /** @type {Services} */
        const services = new Services(Services.NANO, Services.NANO | Services.LIGHT | Services.FULL);
        /** @type {Network} */
        const network = await new Network(blockchain, services);

        return new NanoConsensus(blockchain, mempool, network);
    }
}
Class.register(Consensus);
