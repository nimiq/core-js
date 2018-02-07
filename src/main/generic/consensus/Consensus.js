class Consensus {
    /**
     * @param {NetworkConfig} [netconfig]
     * @return {Promise.<FullConsensus>}
     */
    static async full(netconfig = NetworkConfig.getDefault()) {
        await Crypto.prepareSyncCryptoWorker();

        netconfig.services = new Services(Services.FULL, Services.FULL);
        await netconfig.initPersistent();

        /** @type {Time} */
        const time = new Time();
        /** @type {ConsensusDB} */
        const db = await ConsensusDB.getFull();
        /** @type {Accounts} */
        const accounts = await Accounts.getPersistent(db);
        /** @type {TransactionStore} */
        const transactionStore = await TransactionStore.getPersistent(db);
        /** @type {FullChain} */
        const blockchain = await FullChain.getPersistent(db, accounts, time, transactionStore);
        /** @type {Mempool} */
        const mempool = new Mempool(blockchain, accounts);
        /** @type {Network} */
        const network = new Network(blockchain, netconfig, time);

        return new FullConsensus(blockchain, mempool, network);
    }

    /**
     * @param {NetworkConfig} [netconfig]
     * @return {Promise.<LightConsensus>}
     */
    static async light(netconfig = NetworkConfig.getDefault()) {
        await Crypto.prepareSyncCryptoWorker();

        netconfig.services = new Services(Services.LIGHT, Services.LIGHT | Services.FULL);
        await netconfig.initPersistent();

        /** @type {Time} */
        const time = new Time();
        /** @type {ConsensusDB} */
        const db = await ConsensusDB.getLight();
        /** @type {Accounts} */
        const accounts = await Accounts.getPersistent(db);
        /** @type {LightChain} */
        const blockchain = await LightChain.getPersistent(db, accounts, time);
        /** @type {Mempool} */
        const mempool = new Mempool(blockchain, accounts);
        /** @type {Network} */
        const network = new Network(blockchain, netconfig, time);

        return new LightConsensus(blockchain, mempool, network);
    }

    /**
     * @param {NetworkConfig} [netconfig]
     * @return {Promise.<NanoConsensus>}
     */
    static async nano(netconfig = NetworkConfig.getDefault()) {
        await Crypto.prepareSyncCryptoWorker();

        netconfig.services = new Services(Services.NANO, Services.NANO | Services.LIGHT | Services.FULL);
        await netconfig.initPersistent();

        /** @type {Time} */
        const time = new Time();
        /** @type {NanoChain} */
        const blockchain = await new NanoChain(time);
        /** @type {NanoMempool} */
        const mempool = new NanoMempool(blockchain);
        /** @type {Network} */
        const network = new Network(blockchain, netconfig, time);

        return new NanoConsensus(blockchain, mempool, network);
    }

    /**
     * @param {NetworkConfig} [netconfig]
     * @return {Promise.<FullConsensus>}
     */
    static async volatileFull(netconfig = NetworkConfig.getDefault()) {
        await Crypto.prepareSyncCryptoWorker();

        netconfig.services = new Services(Services.FULL, Services.FULL);
        await netconfig.initVolatile();

        /** @type {Time} */
        const time = new Time();
        /** @type {Accounts} */
        const accounts = await Accounts.createVolatile();
        /** @type {TransactionStore} */
        const transactionStore = await TransactionStore.createVolatile();
        /** @type {FullChain} */
        const blockchain = await FullChain.createVolatile(accounts, time, transactionStore);
        /** @type {Mempool} */
        const mempool = new Mempool(blockchain, accounts);
        /** @type {Network} */
        const network = new Network(blockchain, netconfig, time);

        return new FullConsensus(blockchain, mempool, network);
    }

        /**
     * @param {NetworkConfig} [netconfig]
     * @return {Promise.<LightConsensus>}
     */
    static async volatileLight(netconfig = NetworkConfig.getDefault()) {
        await Crypto.prepareSyncCryptoWorker();

        netconfig.services = new Services(Services.LIGHT, Services.LIGHT | Services.FULL);
        await netconfig.initVolatile();

        /** @type {Time} */
        const time = new Time();
        /** @type {Accounts} */
        const accounts = await Accounts.createVolatile();
        /** @type {LightChain} */
        const blockchain = await LightChain.createVolatile(accounts, time);
        /** @type {Mempool} */
        const mempool = new Mempool(blockchain, accounts);
        /** @type {Network} */
        const network = new Network(blockchain, netconfig, time);

        return new LightConsensus(blockchain, mempool, network);
    }

    /**
     * @param {NetworkConfig} [netconfig]
     * @return {Promise.<NanoConsensus>}
     */
    static async volatileNano(netconfig = NetworkConfig.getDefault()) {
        await Crypto.prepareSyncCryptoWorker();

        netconfig.services = new Services(Services.NANO, Services.NANO | Services.LIGHT | Services.FULL);
        await netconfig.initVolatile();

        /** @type {Time} */
        const time = new Time();
        /** @type {NanoChain} */
        const blockchain = await new NanoChain(time);
        /** @type {NanoMempool} */
        const mempool = new NanoMempool(blockchain);
        /** @type {Network} */
        const network = new Network(blockchain, netconfig, time);

        return new NanoConsensus(blockchain, mempool, network);
    }
}

Class.register(Consensus);
