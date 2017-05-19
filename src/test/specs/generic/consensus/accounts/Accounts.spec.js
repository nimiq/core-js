
describe('Accounts', () => {

    it('cannot commit a wrong block', (done) => {
        const block = Dummy.block1;
        Accounts.createVolatile().then( accounts =>
            accounts.commitBlock(block)
                .then( () => {
                    expect(true).toBe(false);
                    done();
                })
                .catch( (e) => {
                    expect(e).toBe('AccountsHash mismatch');
                    done();
                })
        );
    });

    it('can apply and revert a block', (done) => {
        // prepare everything and serialize accountstree
        async function test() {
            const accounts = await Accounts.createVolatile();
            const accountState = new Balance(10, 0);

            for (var i = 3; i > 0; i--) {
                let senderPubKey = new PublicKey(Dummy['publicKey'+i]);
                let recipientAddr = new Address(Dummy['address'+i]);
                addr = await senderPubKey.toAddress();
                await accounts._tree.put(addr, accountState);
            }

            const accountsHash1 = await accounts.hash();
            await accounts.commitBlock(Dummy.accountsBlock);
            await accounts.revertBlock(Dummy.accountsBlock);
            const accountsHash2 = await accounts.hash();
            expect(accountsHash1.equals(accountsHash2)).toEqual(true);
            done();
        }
        test();
    });

    it('put and get an account', (done) => {
        const balance = 42;
        const nonce = 192049;
        const accountState1 = new Balance(balance, nonce);
        const accountAddress = new Address(Dummy.address2);

        async function test() {
            account = await Accounts.createVolatile();
            await account._tree.put(accountAddress, accountState1);
            const accountState2 = await account.getBalance(accountAddress);
            expect(accountState1.nonce).toBe(accountState2.nonce);
            done();
        }
        test();
    });
});
