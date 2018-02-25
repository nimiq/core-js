describe('BlockBody', () => {
    const minerAddress = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));
    const account1 = new PrunedAccount(Address.fromBase64(Dummy.address1), new VestingContract(0, Address.fromBase64(Dummy.address2)));
    const account2 = new PrunedAccount(Address.fromBase64(Dummy.address2), new VestingContract(0, Address.fromBase64(Dummy.address3)));
    const account3 = new PrunedAccount(Address.fromBase64(Dummy.address3), new VestingContract(0, Address.fromBase64(Dummy.address1)));
    const orderedAccounts = [account1, account2, account3].sort((a, b) => a.compare(b));
    let orderedTxs;

    beforeAll(() => {
        const users = TestBlockchain.getUsers(3);
        const tx1 = TestBlockchain.createTransaction(users[0].publicKey, users[1].address, 2000, 5, 1, users[0].privateKey);
        const tx2 = TestBlockchain.createTransaction(users[1].publicKey, users[2].address, 1000, 500, 1, users[1].privateKey);
        const tx3 = TestBlockchain.createTransaction(users[2].publicKey, users[0].address, 3000, 500, 2, users[2].privateKey);
        orderedTxs = [tx1, tx2, tx3].sort((a, b) => a.compareBlockOrder(b));
    });

    it('is serializable and unserializable', () => {
        const blockBody1 = new BlockBody(minerAddress, orderedTxs, BufferUtils.fromAscii('Random'), orderedAccounts);
        const blockBody2 = BlockBody.unserialize(blockBody1.serialize());
        expect(blockBody1.equals(blockBody2)).toBe(true);
        expect(BufferUtils.equals(blockBody1.serialize(), blockBody2.serialize())).toBe(true);
        expect(BufferUtils.equals(blockBody1.hash(), blockBody2.hash())).toBe(true);
        expect(BufferUtils.equals(blockBody1.extraData, blockBody2.extraData)).toBe(true);
    });

    it('has well-defined transactions', () => {
        /* eslint-disable no-unused-vars */
        expect(() => {
            const test1 = new BlockBody(minerAddress, null);
        }).toThrow('Malformed transactions');
        expect(() => {
            const test2 = new BlockBody(minerAddress, undefined);
        }).toThrow('Malformed transactions');
        expect(() => {
            const test3 = new BlockBody(minerAddress, [null]);
        }).toThrow('Malformed transactions');
        expect(() => {
            const test4 = new BlockBody(minerAddress, [undefined]);
        }).toThrow('Malformed transactions');
        expect(() => {
            const test5 = new BlockBody(minerAddress, [true]);
        }).toThrow('Malformed transactions');
        /* eslint-enable no-unused-vars */
    });

    it('can verify well-formed transactions', () => {
        const blockBody = new BlockBody(minerAddress, orderedTxs, BufferUtils.fromAscii('Random'));
        expect(blockBody.verify()).toBe(true);
    });

    it('can verify well-formed pruned accounts', () => {
        const blockBody = new BlockBody(minerAddress, orderedTxs, undefined, orderedAccounts);
        expect(blockBody.verify()).toBe(true);
    });

    it('rejects out-of-order transactions', () => {
        const blockBody = new BlockBody(minerAddress, [orderedTxs[1], orderedTxs[0], ...orderedTxs.slice(2)]);
        expect(blockBody.verify()).toBe(false);
    });

    it('rejects duplicate transactions', () => {
        const blockBody = new BlockBody(minerAddress, [orderedTxs[0], orderedTxs[1], orderedTxs[1], orderedTxs[2]]);
        expect(blockBody.verify()).toBe(false);
    });

    it('rejects out-of-order pruned accounts', () => {
        const blockBody = new BlockBody(minerAddress, [], undefined, [orderedAccounts[1], orderedAccounts[0], orderedAccounts[2]]);
        expect(blockBody.verify()).toBe(false);
    });

    it('rejects duplicate pruned accounts', () => {
        const blockBody = new BlockBody(minerAddress, [], undefined, [orderedAccounts[0], orderedAccounts[1], orderedAccounts[1], orderedAccounts[2]]);
        expect(blockBody.verify()).toBe(false);
    });
});
