describe('TxMessage', () => {
    let proof, tx;

    beforeAll(() => {
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

        const signature = Signature.unserialize(BufferUtils.fromBase64(Dummy.signature1));
        tx = new BasicTransaction(PublicKey.unserialize(BufferUtils.fromBase64(Dummy.publicKey1)), Address.unserialize(BufferUtils.fromBase64(Dummy.address1)), 8888, 42, 0, signature);
    });

    it('is correctly constructed', () => {
        let msg1 = new TxMessage(tx, proof);

        expect(msg1.transaction.equals(tx)).toBe(true);
        expect(msg1.hasAccountsProof).toBe(true);
        expect(msg1.accountsProof === proof).toBe(true);

        msg1 = new TxMessage(tx);

        expect(msg1.transaction.equals(tx)).toBe(true);
        expect(msg1.hasAccountsProof).toBe(false);
    });

    it('is serializable and unserializable', () => {
        let msg1 = new TxMessage(tx, proof);
        const msg2 = TxMessage.unserialize(msg1.serialize());

        expect(msg2.transaction.equals(msg1.transaction)).toBe(true);
        expect(msg2.hasAccountsProof).toBe(msg1.hasAccountsProof);
        expect(msg2.accountsProof.length).toBe(msg1.accountsProof.length);
    });
});
