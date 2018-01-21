class Consensus {
    /**
     * @return {Promise.<FullConsensus>}
     */
    static async full(netconfig) {
        await Crypto.prepareSyncCryptoWorker();

        /** @type {NetworkConfig} */
        netconfig = netconfig || new NetworkConfig();

        /** @type {Services} */
        const services = new Services(Services.FULL, Services.FULL);
        netconfig.services = services;

        /** @type {ConsensusDB} */
        const db = await ConsensusDB.getFull();
        /** @type {Accounts} */
        const accounts = await Accounts.getPersistent(db);
        /** @type {FullChain} */
        const blockchain = await FullChain.getPersistent(db, accounts);
        /** @type {Mempool} */
        const mempool = new Mempool(blockchain, accounts);
        /** @type {Network} */
        const network = await new Network(blockchain, netconfig);

        return new FullConsensus(blockchain, mempool, network);
    }

    /**
     * @return {Promise.<LightConsensus>}
     */
    static async light(netconfig) {
        await Crypto.prepareSyncCryptoWorker();

        /** @type {NetworkConfig} */
        netconfig = netconfig || new NetworkConfig();

        /** @type {Services} */
        const services = new Services(Services.LIGHT, Services.LIGHT | Services.FULL);
        netconfig.services = services;

        /** @type {ConsensusDB} */
        const db = await ConsensusDB.getLight();
        /** @type {Accounts} */
        const accounts = await Accounts.getPersistent(db);
        /** @type {LightChain} */
        const blockchain = await LightChain.getPersistent(db, accounts);
        /** @type {Mempool} */
        const mempool = new Mempool(blockchain, accounts);
        /** @type {Network} */
        const network = await new Network(blockchain, netconfig);

        return new LightConsensus(blockchain, mempool, network);
    }

    /**
     * @return {Promise.<NanoConsensus>}
     */
    static async nano(netconfig) {
        await Crypto.prepareSyncCryptoWorker();

        /** @type {NetworkConfig} */
        netconfig = netconfig || new NetworkConfig();

        /** @type {Services} */
        const services = new Services(Services.NANO, Services.NANO | Services.LIGHT | Services.FULL);
        netconfig.services = services;

        /** @type {NanoChain} */
        const blockchain = await new NanoChain();
        /** @type {NanoMempool} */
        const mempool = new NanoMempool();
        /** @type {Network} */
        const network = await new Network(blockchain, netconfig);

        return new NanoConsensus(blockchain, mempool, network);
    }
}
Class.register(Consensus);
