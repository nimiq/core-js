class Consensus {
    static async test() {
        // Model
        const accounts = await Accounts.createVolatile();
        const blockchain = await Blockchain.createVolatile(accounts);

        // P2P
        const network = new P2PNetwork();
        const agent = new ConsensusP2PAgent(blockchain, network.broadcastChannel);

        // Miner
        const miner = new Miner(blockchain, new Address('hymMwvMfunMYHqKp5u8Q3OIe2V4'));

        return {
            accounts: accounts,
            blockchain: blockchain,
            network: network,
            agent: agent,
            miner: miner
        };
    }
}
