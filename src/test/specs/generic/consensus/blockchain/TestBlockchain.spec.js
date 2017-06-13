class TestBlockchain extends Blockchain {
    static get MAX_NUM_TRANSACTIONS() {
        return Math.floor(              // round off
            (Policy.BLOCK_SIZE_MAX -   // block size limit
            116 -                       // header size
            20) /                       // miner address size
            165);                       // transaction size

    }

    constructor(store, accounts, users) {
        const thisPromise = super(store, accounts, false);

        return thisPromise.then((superThis) => {
            superThis._users = users;
            return superThis;
        });

    }

    get accounts() {
        return this._accounts;
    }

    get users() {
        return this._users;
    }

    static async createTransaction(senderPubKey, recipientAddr, amount = 1, fee = 1, nonce = 0, senderPrivKey = undefined, signature = undefined) {

        const transaction = new Transaction(senderPubKey, recipientAddr, amount, fee, nonce);

        // allow to hardcode a signature
        if (!signature) {
            // if no signature is provided, the secret key is required
            if (!senderPrivKey) {
                throw 'Signature computation requested, but no sender private key provided';
            }

            signature = await Signature.create(senderPrivKey, transaction.serializeContent());
        }
        transaction.signature = signature;

        return transaction;
    }

    // TODO can still run into balance problems: block height x and subsequent `mining` means that only the first x
    // users are guaranteed to have a non-zero balance. Depending on the existing transactions, this can improve a bit...
    async generateTransactions(numTransactions, noDuplicateSenders = true, sizeLimit = true) {

        const numUsers = this.users.length;

        if (noDuplicateSenders && numTransactions > numUsers) {
            // only one transaction per user
            Log.w(`Reducing transactions from ${numTransactions} to ${numUsers} to avoid sender duplication.`);
            numTransactions = numUsers;
        }

        if (sizeLimit && numTransactions > TestBlockchain.MAX_NUM_TRANSACTIONS) {
            Log.w(`Reducing transactions from ${numTransactions} to ${TestBlockchain.MAX_NUM_TRANSACTIONS} to avoid exceeding the size limit.`);
            numTransactions = TestBlockchain.MAX_NUM_TRANSACTIONS;
        }

        /* Note on transactions and balances:
         We fill up the balances of users in increasing order, therefore the size of the chain determines how many
         users already have a non-zero balance. Hence, for block x, all users up to user[x] have a non-zero balance.
         At the same time, there must not be more than one transaction from the same sender.
         */
        const transactions = [];
        for (let j = 0; j < numTransactions; j++) {
            const sender = this.users[j % numUsers];
            const recipient = this.users[(j + 1) % numUsers];

            // 10% transaction + 5% fee
            const balanceValue = (await this.accounts.getBalance(sender.address)).value; // eslint-disable-line no-await-in-loop
            const amount = Math.floor(balanceValue / 10) || 1;
            const fee = Math.floor(amount / 2);
            const nonce = j;

            const transaction = await TestBlockchain.createTransaction(sender.publicKey, recipient.address, amount, fee, nonce, sender.privateKey);// eslint-disable-line no-await-in-loop

            transactions.push(transaction);
        }

        return transactions;
    }

    async createBlock(transactions, prevHash, accountsHash, bodyHash, miner, difficulty, timestamp, nonce, mockPoW = true, numTransactions = 0, height) {
        numTransactions = numTransactions || this.height;

        // index of block in the chain, genesis is omitted
        const blockIndex = this.height;
        const numUsers = this.users.length;

        // create transactions
        if (!transactions) {
            transactions = await this.generateTransactions(numTransactions);
        }

        prevHash = prevHash || this.headHash;
        miner = miner || this.users[(blockIndex) % numUsers];     // user[0] created genesis, hence we start with user[1]
        const body = new BlockBody(miner.address, transactions);

        if (!accountsHash) {
            try {
                const tmpAccounts = await this.createTemporaryAccounts();
                await tmpAccounts.commitBlockBody(body);
                accountsHash = await tmpAccounts.hash();
            } catch (e) {
                // The block is invalid, fill with broken accountsHash
                accountsHash = new Hash(null);
            }
        }

        bodyHash = bodyHash || await body.hash();
        difficulty = difficulty || await this.getNextCompactTarget();
        timestamp = timestamp || ((blockIndex) * 10);
        nonce = nonce || blockIndex;
        height = height || blockIndex + 1;
        const header = new BlockHeader(prevHash, bodyHash, accountsHash, difficulty, height, timestamp, nonce);

        const block = new Block(header, body);

        if (mockPoW) {
            // mock (!) proof of work b/c we cannot really mine here
            block.header.verifyProofOfWork = () => {
                return true;
            };
        }

        return block;
    }

    static async createVolatileTest(numBlocks, numUsers = 2) {
        const accounts = await Accounts.createVolatile();
        const store = BlockchainStore.createVolatile();
        const users = await TestBlockchain.generateUsers(numUsers);
        const testBlockchain = await new TestBlockchain(store, accounts, users);

        // populating the blockchain
        for (let i = 0; i < numBlocks; i++) {
            const newBlock = await testBlockchain.createBlock(); //eslint-disable-line no-await-in-loop
            const success = await testBlockchain.pushBlock(newBlock); //eslint-disable-line no-await-in-loop
            if (success != Blockchain.PUSH_OK) {
                throw 'Failed to commit block';
            }
        }

        return testBlockchain;
    }

    static async generateUsers(num) {
        const users = [];

        // First user, it needs to be known beforehand because the
        // genesis block will send the first miner reward to it
        const keys = KeyPair.unserialize(BufferUtils.fromBase64(('Lc7h0L4wncJ3DiNapeGlwURfpbGvyPbuBEpJemzzQW1ng6LQ+/C8AXXbc87dX/VNBrrgAGD1Rc+nXDM7QNFPggYlb56BE4czyOwmIFYPoMmiTRFmz4p/WKhl7hMSBo6N')));
        const address = await keys.publicKey.toAddress();
        users.push(TestBlockchain.generateUser(
          keys.privateKey,
          keys.publicKey,
          address
        ));

        for (let i = 1; i < num; i++) {
            const keys = await KeyPair.generate(); //eslint-disable-line no-await-in-loop
            const address = await keys.publicKey.toAddress(); //eslint-disable-line no-await-in-loop

            users.push(TestBlockchain.generateUser(
              keys.privateKey,
              keys.publicKey,
              address
            ));
            // console.info('Created user ' + i);

        }
        return users;
    }

    static generateUser(privateKey, publicKey, address) {
        return {
            'privateKey': privateKey,
            'publicKey': publicKey,
            'address': address
        };
    }
}
Class.register(TestBlockchain);
