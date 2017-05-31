class TestBlockchain extends Blockchain {

    static get MAX_NUM_TRANSACTIONS() {
        return Math.floor(              // round off
            (Policy.BLOCK_SIZE_MAX  -   // block size limit
            116 -                       // header size
            20) /                       // miner address size
            165);                       // transaction size

    }

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

    static async createTransaction(senderPubKey, receiverAddr, amount = 1, fee = 1, nonce = 0,
                                   senderPrivKey = undefined, signature = undefined) {
        // console.info('Creating transaction from sender ' + senderPubKey + ' to address ' + receiverAddr + '. Amount: '
        //     + amount + ', fee: ' + fee + ', nonce: ' + nonce);

        const transaction = new Transaction(senderPubKey, receiverAddr, amount, fee, nonce);

        // allow to hardcode a signature
        if (!signature) {
            // if no signature is provided, the secret key is required
            if (!senderPrivKey) {
                throw 'Signature computation requested, but no sender private key provided';
            }
            // console.info('Signing transaction with provided secret key');
            const internalPrivate = await Crypto.importPrivate(senderPrivKey);

            signature = await Crypto.sign(internalPrivate, transaction.serializeContent());
        }
        transaction.signature = signature;
        return transaction;
    }

    // TODO can still run into balance problems: block height x and subsequent `mining` means that only the first x
    // users are guaranteed to have a non-zero balance. Depending on the existing transactions, this can improve a bit...
    async generateTransactions(numTransactions, noDupliateSenders = true, sizeLimit = true) {
        const transactions = [];

        const numUsers = this.users.length;

        if (noDupliateSenders && numTransactions > numUsers) {
            // only one transaction per user
            console.warn('Reducing transactions to ' + numTransactions + ' to avoid sender duplication.');
            numTransactions = numUsers;
        }

        if (sizeLimit && numTransactions > TestBlockchain.MAX_NUM_TRANSACTIONS) {
            console.warn('Reducing transactions to ' + numTransactions + ' to avoid exceeding the size limit.');
            numTransactions = TestBlockchain.MAX_NUM_TRANSACTIONS;
        }

         /* Note on transactions and balances:
         We fill up the balances of users in increasing order, therefore the size of the chain determines how many
         users already have a non-zero balance. Hence, for block x, all users up to user[x] have a non-zero balance.
         At the same time, there must not be more than one transaction from the same sender.
         */
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

            const transaction = await TestBlockchain.createTransaction(senderPubKey, receiverAddress, amount, fee,
                nonce, sender.privateKey);

            transactions.push(transaction);
        }

        return transactions;
    }

    async createBlock(transactions, prevHash, accountsHash, bodyHash, miner, difficulty, timestamp, nonce, mockPoW = true) {


        // index of block in the chain, genesis is omitted
        const blockIndex = this.height - 1;

        const numUsers = this.users.length;

        // create transactions
        if (!transactions) {
            transactions = await this.generateTransactions(this.height);
        }

        prevHash = prevHash || this.headHash;
        accountsHash = accountsHash || new Hash(await this._accounts.hash());
        miner = miner || this.users[(blockIndex + 1) % numUsers];     // user[0] created genesis, hence we start with user[1]
        const body = await new BlockBody(new Address(miner.address), transactions);

        bodyHash = bodyHash || new Hash(await body.hash());
        difficulty = difficulty || await this.getNextCompactTarget();
        timestamp = timestamp || ((blockIndex + 1) * 10);
        nonce = nonce || blockIndex + 1;
        const header = await new BlockHeader(prevHash, bodyHash, accountsHash, difficulty, timestamp, nonce);
        const block = await new Block(header, body);

        if (mockPoW) {
            // mock (!) proof of work b/c we cannot really mine here
            block.header.verifyProofOfWork = (buf) => {
                // console.log('Faking PoW');
                return true;
            };
        }

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

    // DEBUG

    static async generateUsers(num) {

        const users = [];

        for (let i = 0; i < num; i++) {
            const keys = await Crypto.generateKeys();
            const privateKey = await Crypto.exportPrivate(keys.privateKey);
            const publicKey = await Crypto.exportPublic(keys.publicKey);
            const address = await Crypto.publicToAddress(publicKey);

            users.push({
                // 'keys': keys,               // raw format as generated by crypto lib
                'privateKey': privateKey,   // exported jwt format
                'publicKey': publicKey,     // base64 of raw export
                'address': address          // base64
            });
            // console.info('Created user ' + i);

        }
        return users;
    }
}
Class.register(TestBlockchain);
