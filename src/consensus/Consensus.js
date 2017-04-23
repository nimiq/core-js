class Consensus {
    constructor() {
        // Model
        const accounts = Accounts.getPersistent();
        const blockchain = Blockchain.getPersistent(accounts);

        // P2P
        const network = new P2PNetwork();
        const agent = new ConsensusP2PAgent(blockchain, network.broadcastChannel);
    }
}
