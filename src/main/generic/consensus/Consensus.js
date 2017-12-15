class Consensus {
    /**
     * @param {NetworkConfig} [netconfig]
     * @return {Promise.<FullConsensus>}
     */
    static async full(netconfig) {
        await Crypto.prepareSyncCryptoWorker();

        if (netconfig) {
            netconfig.services.type = Services.FULL;
        } else {
            netconfig = new NetworkConfig();
        }

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
     * @param {NetworkConfig} [netconfig]
     * @return {Promise.<LightConsensus>}
     */
    static async light(netconfig) {
        await Crypto.prepareSyncCryptoWorker();

        if (netconfig) {
            netconfig.services.type = Services.LIGHT;
        } else {
            netconfig = new NetworkConfig(new Services(Services.LIGHT, Services.LIGHT | Services.FULL));
        }

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
     * @param {NetworkConfig} [netconfig]
     * @return {Promise.<NanoConsensus>}
     */
    static async nano(netconfig) {
        await Crypto.prepareSyncCryptoWorker();

        if (netconfig) {
            netconfig.services.type = Services.NANO;
        } else {
            netconfig = new NetworkConfig(new Services(Services.NANO, Services.NANO | Services.LIGHT | Services.FULL));
        }

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
