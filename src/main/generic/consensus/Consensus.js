class Consensus {
    static async full() {
        Services.configureServices(Services.FULL);
        Services.configureServiceMask(Services.FULL);

        /** @type {ConsensusDB} */
        const db = await ConsensusDB.get();
        /** @type {Accounts} */
        const accounts = await Accounts.getPersistent(db);
        /** @type {FullChain} */
        const blockchain = await FullChain.getPersistent(db, accounts);
        /** @type {Mempool} */
        const mempool = new Mempool(blockchain, accounts);
        /** @type {Network} */
        const network = await new Network(blockchain);

        return new FullConsensus(blockchain, mempool, network);
    }

    static async light() {
        Services.configureServices(Services.LIGHT);
        Services.configureServiceMask(Services.LIGHT | Services.FULL);

        /** @type {ConsensusDB} */
        const db = await ConsensusDB.get();
        /** @type {Accounts} */
        const accounts = await Accounts.getPersistent(db);
        /** @type {FullChain} */
        const blockchain = await LightChain.getPersistent(db, accounts);
        /** @type {Mempool} */
        const mempool = new Mempool(blockchain, accounts);
        /** @type {Network} */
        const network = await new Network(blockchain);

        return new LightConsensus(blockchain, mempool, network);
    }

    static async nano() {
        Services.configureServices(Services.NANO);
        Services.configureServiceMask(Services.NANO | Services.LIGHT | Services.FULL);

        /** @type {NanoChain} */
        const blockchain = await new NanoChain();
        /** @type {Mempool} */
        const mempool = null; // TODO
        /** @type {Network} */
        const network = await new Network(blockchain);

        return new NanoConsensus(blockchain, mempool, network);
    }
}
Class.register(Consensus);
