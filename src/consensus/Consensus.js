class Consensus {
    static async test() {
        // Model
        const accounts = await Accounts.getPersistent();
        const blockchain = await Blockchain.getPersistent(accounts);

        // P2P
        const network = new P2PNetwork();
        const agent = new ConsensusP2PAgent(blockchain, network.broadcastChannel);

        return {
            accounts: accounts,
            blockchain: blockchain,
            network: network,
            agent: agent
        };
    }
}
