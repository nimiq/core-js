class Consensus {
    static async test() {
        // Model
        const accounts = await Accounts.getPersistent();
        const blockchain = await Blockchain.getPersistent(accounts);
        const mempool = new Mempool(blockchain, accounts);

        // P2P
        const network = new P2PNetwork();
        const agent = new ConsensusP2PAgent(network.broadcastChannel, blockchain, mempool);

        // Wallet
        const wallet = await Wallet.getPersistent();

        // Miner
        const miner = new Miner(wallet.address, blockchain, mempool);

        return {
            accounts: accounts,
            blockchain: blockchain,
            mempool: mempool,
            network: network,
            wallet: wallet,
            miner: miner
        };
    }
}
