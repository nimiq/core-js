class Consensus {
    constructor() {
        const network = new P2PNetwork();

        const accounts = Accounts.getPersistent();
        const blockchain = new BlockChain(accounts);
        const agent = new ConsensusP2PAgent(blockchain, network.broadcastChannel);

        blockchain.on('change', head => {
            // Notify others about new block.
            // Only do this if our local blockchain has caught up with the consensus height.
            network.broadcastChannel.inv([InvVector.fromBlock(head)]);
        });
    }
}
