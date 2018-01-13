describe('AccountsProofMessage', () => {
    const blockHash = Hash.fromBase64(Dummy.hash1);
    let proof;



    beforeAll((done) => {
        (async () => {
            await Crypto.prepareSyncCryptoWorker();

            const account1 = new BasicAccount(25);
            const account2 = new BasicAccount(1);
            const account3 = new BasicAccount(1322);
            const account4 = new BasicAccount(93);

            const t1 = AccountsTreeNode.terminalNode('0011111111111111111111111111111111111111', account1);
            const t1Hash = t1.hash();

            const t2 = AccountsTreeNode.terminalNode('0033333333333333333333333333333333333333', account2);
            const t2Hash = t2.hash();

            const t3 = AccountsTreeNode.terminalNode('0020000000000000000000000000000000000000', account3);
            const t3Hash = t3.hash();

            const t4 = AccountsTreeNode.terminalNode('0022222222222222222222222222222222222222', account4);
            const t4Hash = t4.hash();

            const b2 = AccountsTreeNode.branchNode('002', ['0000000000000000000000000000000000000', undefined, '2222222222222222222222222222222222222'], [t3Hash, undefined, t4Hash]);
            const b2Hash = b2.hash();

            const b1 = AccountsTreeNode.branchNode('00', [undefined, '11111111111111111111111111111111111111', '2', '33333333333333333333333333333333333333'], [undefined, t1Hash, b2Hash, t2Hash]);
            const b1Hash = b1.hash();

            const r1 = AccountsTreeNode.branchNode('', ['00'], [b1Hash]);

            const nodes = [t1, t3, t4, b2, t2, b1, r1];
            proof = new AccountsProof(nodes);
        })().then(done, done.fail);
    });

    it('is correctly constructed', () => {
        let msg1 = new AccountsProofMessage(blockHash, proof);

        expect(msg1.blockHash.equals(blockHash)).toBe(true);
        expect(msg1.proof).toBe(proof);

        msg1 = new AccountsProofMessage(blockHash);
        expect(msg1.blockHash.equals(blockHash)).toBe(true);
        expect(msg1.proof).toBe(null);
    });

    it('is serializable and unserializable', () => {
        let msg1 = new AccountsProofMessage(blockHash, proof);
        let msg2 = AccountsProofMessage.unserialize(msg1.serialize());

        expect(msg2.blockHash.equals(msg1.blockHash)).toBe(true);
        expect(msg2.proof.length).toBe(msg1.proof.length);
        expect(msg2.proof.nodes.every((node, i) => msg1.proof.nodes[i].equals(node))).toBe(true);
        expect(msg2.hasProof()).toBeTruthy();
        expect(msg1.hasProof()).toBeTruthy();

        msg1 = new AccountsProofMessage(blockHash);
        msg2 = AccountsProofMessage.unserialize(msg1.serialize());

        expect(msg2.blockHash.equals(msg1.blockHash)).toBe(true);
        expect(msg2.hasProof()).toBeFalsy();
        expect(msg1.hasProof()).toBeFalsy();
    });

    it('must have well defined arguments', () => {
        expect(() => new AccountsProofMessage('123')).toThrow();
        expect(() => new AccountsProofMessage(blockHash, '123')).toThrow();
        expect(() => new AccountsProofMessage(blockHash, blockHash)).toThrow();
    });

    it('is allowed to have no proof', () => {
        const msg = new AccountsProofMessage(blockHash);
        expect(msg.hasProof()).toBeFalsy();
    });
});
