class Consensus {
    static async full() {
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

    static async nano() {
        /** @type {NanoChain} */
        const blockchain = new NanoChain();
        /** @type {Mempool} */
        const mempool = null; // TODO
        /** @type {Network} */
        const network = await new Network(blockchain);

        return new NanoConsensus(blockchain, mempool, network);
    }
}
Class.register(Consensus);
