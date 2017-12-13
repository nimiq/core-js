describe('TransactionsProofMessage', () => {
    const blockHash = Hash.fromBase64(Dummy.hash1);
    let proof;


    beforeAll((done) => {
        (async () => {
            const account1 = new BasicAccount(25, 3);
            const account2 = new BasicAccount(1, 925);
            const account3 = new BasicAccount(1322, 532);
            const account4 = new BasicAccount(93, 11);

            const t1 = AccountsTreeNode.terminalNode('0011111111111111111111111111111111111111', account1);
            const t1Hash = await t1.hash();

            const t2 = AccountsTreeNode.terminalNode('0033333333333333333333333333333333333333', account2);
            const t2Hash = await t2.hash();

            const t3 = AccountsTreeNode.terminalNode('0020000000000000000000000000000000000000', account3);
            const t3Hash = await t3.hash();

            const t4 = AccountsTreeNode.terminalNode('0022222222222222222222222222222222222222', account4);
            const t4Hash = await t4.hash();

            const b2 = AccountsTreeNode.branchNode('002', ['0000000000000000000000000000000000000', undefined, '2222222222222222222222222222222222222'], [t3Hash, undefined, t4Hash]);
            const b2Hash = await b2.hash();

            const b1 = AccountsTreeNode.branchNode('00', [undefined, '11111111111111111111111111111111111111', '2', '33333333333333333333333333333333333333'], [undefined, t1Hash, b2Hash, t2Hash]);
            const b1Hash = await b1.hash();

            const r1 = AccountsTreeNode.branchNode('', ['00'], [b1Hash]);

            const nodes = [t1, t3, t4, b2, t2, b1, r1];
            proof = new AccountsProof(nodes);
        })().then(done, done.fail);
    });

    it('is serializable and unserializable', () => {
        const msg1 = new AccountsProofMessage(blockHash, proof);
        const msg2 = AccountsProofMessage.unserialize(msg1.serialize());

        expect(msg1.blockHash.equals(msg2.blockHash)).toBe(true);
        expect(msg1.proof.length).toBe(msg2.proof.length);
        expect(msg1.proof.nodes.every((node, i) => msg2.proof.nodes[i].equals(node))).toBe(true);
    });

    it('must have well defined arguments', () => {
        expect(() => new AccountsProofMessage('123')).toThrow();
        expect(() => new AccountsProofMessage(blockHash, null)).toThrow();
        expect(() => new AccountsProofMessage(blockHash, null)).toThrow();
        expect(() => new AccountsProofMessage(blockHash, blockHash)).toThrow();
    });
});
