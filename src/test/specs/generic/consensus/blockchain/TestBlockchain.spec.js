class TestBlockchain extends Blockchain {

    constructor(store, accounts, blocks, users) {
        const thisPromise = super(store, accounts);

        return thisPromise.then((superThis) => {
            superThis._blocks = blocks;
            superThis._users = users;
            return superThis;
        });

    }

    get accounts() {
        return this._accounts;
    }

    get blocks() {
        return this._blocks;
    }

    get users() {
        return this._users;
    }

    async createBlock() {
        const transactions = [];

        // index of block in the chain, genesis is omitted
        const blockIndex = this.height - 1;

        /*  Note on transactions and balances:
         We fill up the balances of users in increasing order, therefore the size of the chain determines how many
         users already have a non-zero balance. Hence, for block x, all users up to user[x] have a non-zero balance.
         At the same time, there must not be more than one transaction from the same sender.
         */
        const numUsers = this.users.length;
        const numTransactions = Math.min(this.height, numUsers);
        for (let j = 0; j < numTransactions; j++) {
            const sender = this.users[j % numUsers];

            const senderAddress = new Address(sender.address);
            const senderPubKey = new PublicKey(sender.publicKey);
            const receiver = this.users[(j + 1) % numUsers];
            const receiverAddress = new Address(receiver.address);

            // 10% transaction + 5% fee
            const balanceValue = (await this.accounts.getBalance(senderAddress)).value;

            const amount = Math.floor(balanceValue / 10);
            const fee = Math.floor(amount / 2);
            const nonce = j;

            const transaction = new Transaction(senderPubKey,
                receiverAddress, amount, fee, nonce,
                undefined);

            // signing transaction
            const internalPrivate = await Crypto.importPrivate(sender.privateKey);
            const signature = await Crypto.sign(internalPrivate, transaction.serializeContent());
            transaction.signature = signature;

            transactions.push(transaction);
        }

        const prevHash = this.headHash;
        const accountsHash = new Hash(await this._accounts.hash());

        const miner = this.users[(blockIndex + 1) % numUsers];     // user[0] created genesis, hence we start with user[1]
        const body = await new BlockBody(new Address(miner.address), transactions);
        const bodyHash = new Hash(await body.hash());
        const difficulty = await
            this.getNextCompactTarget();
        const header = await
            new BlockHeader(prevHash, bodyHash, accountsHash,
                difficulty, blockIndex + 1, blockIndex + 1);
        const block = await new Block(header, body);

        // mock (!) proof of work b/c we cannot really mine here
        block.header.verifyProofOfWork = (buf) => {
            // console.log('Faking PoW');
            return true;
        };

        return block;
    }

    async commitBlock(block) {
        const success = await this.pushBlock(block);
        if (!success) {
            return false;
        }
        this._blocks.push(block);
        return true;
    }

    static async createVolatileTest(numBlocks, users = Dummy.users) {

        // setup

        const accounts = await Accounts.createVolatile();

        const blocks = [Block.GENESIS];

        const store = BlockchainStore.createVolatile();

        const testBlockchain = await new TestBlockchain(store, accounts, blocks, users);


        // populating the blockchain

        for (let i = 0; i < numBlocks; i++) {
            const newBlock = await testBlockchain.createBlock();
            const success = await testBlockchain.commitBlock(newBlock);
            if (!success) {
                throw 'Failed to commit block';
            }
            if (i % 10 === 0) {
                console.log(`block ${  i}`);
            }
        }

        console.log(`successfully created ${  numBlocks  } blocks`);

        return testBlockchain;
    }

}
Class.register(TestBlockchain);
