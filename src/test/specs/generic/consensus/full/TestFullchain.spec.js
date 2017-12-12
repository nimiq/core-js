class TestBlockchain extends FullChain {
    static get MAX_NUM_TRANSACTIONS() {
        return Math.floor(              // round off
            (Policy.BLOCK_SIZE_MAX -    // block size limit
            150 -                       // header size
            20) /                       // miner address size
            165);                       // transaction size

    }

    constructor(store, accounts, users, ignorePoW = false) {
        // XXX Set a large timeout when mining on demand.
        if (TestBlockchain.MINE_ON_DEMAND && jasmine && jasmine.DEFAULT_TIMEOUT_INTERVAL) {
            jasmine.DEFAULT_TIMEOUT_INTERVAL = 1200000;
        }

        super(store, accounts);
        this._users = users;
        this._invalidNonce = ignorePoW;
        return this._init();
    }

    /** @type {Accounts} */
    get accounts() {
        return this._accounts;
    }

    /** @type {Array.<{address: Address, publicKey: PublicKey, privateKey: PrivateKey}>} */
    get users() {
        return this._users;
    }

    /**
     * @param {PublicKey} senderPubKey
     * @param {Address} recipientAddr
     * @param {number} amount
     * @param {number} fee
     * @param {number} nonce
     * @param {PrivateKey} [senderPrivKey]
     * @param {Signature} [signature]
     * @return {Promise.<BasicTransaction>}
     */
    static async createTransaction(senderPubKey, recipientAddr, amount = 1, fee = 1, nonce = 0, senderPrivKey = undefined, signature = undefined) {
        const transaction = new BasicTransaction(senderPubKey, recipientAddr, amount, fee, nonce);

        // allow to hardcode a signature
        if (!signature) {
            // if no signature is provided, the secret key is required
            if (!senderPrivKey) {
                throw 'Signature computation requested, but no sender private key provided';
            }
            signature = await Signature.create(senderPrivKey, senderPubKey, transaction.serializeContent());
        }
        transaction.signature = signature;

        return transaction;
    }

    /**
     * @param {PublicKey} senderPubKey
     * @param {Address} recipientAddr
     * @param {number} amount
     * @param {number} fee
     * @param {number} nonce
     * @param {PrivateKey} [senderPrivKey]
     * @param {Signature} [signature]
     * @return {Promise.<LegacyTransaction>}
     * @deprecated
     */
    static async createLegacyTransaction(senderPubKey, recipientAddr, amount = 1, fee = 1, nonce = 0, senderPrivKey = undefined, signature = undefined) {
        const transaction = new LegacyTransaction(senderPubKey, recipientAddr, amount, fee, nonce);

        // allow to hardcode a signature
        if (!signature) {
            // if no signature is provided, the secret key is required
            if (!senderPrivKey) {
                throw 'Signature computation requested, but no sender private key provided';
            }
            signature = await Signature.create(senderPrivKey, senderPubKey, transaction.serializeContent());
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
        const nonces = [];
        for (let j = 0; j < numTransactions; j++) {
            const sender = this.users[j % numUsers];
            const recipient = this.users[(j + 1) % numUsers];

            // 10% transaction + 5% fee
            const account = await this.accounts.get(sender.address, Account.Type.BASIC);
            const amount = Math.floor(account.balance / 10) || 1;
            const fee = Math.floor(amount / 2);
            const nonce = account.nonce + (nonces[j % numUsers] ? nonces[j % numUsers] : 0);

            const transaction = await TestBlockchain.createTransaction(sender.publicKey, recipient.address, amount, fee, nonce, sender.privateKey);// eslint-disable-line no-await-in-loop

            // Increment nonce for this user
            nonces[j % numUsers] = nonce + 1;

            transactions.push(transaction);
        }

        return transactions.sort((a, b) => a.compareBlockOrder(b));
    }

    /**
     * @param {{prevHash, interlinkHash, bodyHash, accountsHash, nBits, timestamp, nonce, height, interlink, minerAddr, transactions, numTransactions}} options
     * @returns {Promise.<Block>}
     */
    async createBlock(options = {}) {
        const height = options.height || this.head.height + 1;

        let transactions = options.transactions;
        if (!transactions) {
            const numTransactions = typeof options.numTransactions !== 'undefined' ? options.numTransactions : height - 1;
            transactions = await this.generateTransactions(numTransactions);
        }

        const minerAddr = options.minerAddr || this.users[this.height % this._users.length].address;     // user[0] created genesis, hence we start with user[1]
        const body = new BlockBody(minerAddr, transactions);

        const nBits = options.nBits || BlockUtils.targetToCompact(await this.getNextTarget());
        const interlink = options.interlink || await this.head.getNextInterlink(BlockUtils.compactToTarget(nBits));

        const prevHash = options.prevHash || this.headHash;
        const interlinkHash = options.interlinkHash || await interlink.hash();
        const bodyHash = options.bodyHash || await body.hash();

        let accountsHash = options.accountsHash;
        if (!accountsHash) {
            const accountsTx = await this._accounts.transaction();
            try {
                await accountsTx.commitBlockBody(body, height);
                accountsHash = await accountsTx.hash();
            } catch (e) {
                // The block is invalid, fill with broken accountsHash
                // TODO: This is harmful, as it might cause tests to succeed that should fail.
                accountsHash = new Hash(null);
            }
            await accountsTx.abort();
        }

        const timestamp = typeof options.timestamp !== 'undefined' ? options.timestamp : this.head.timestamp + Policy.BLOCK_TIME;
        const nonce = options.nonce || 0;
        const header = new BlockHeader(prevHash, interlinkHash, bodyHash, accountsHash, nBits, height, timestamp, nonce);

        const block = new Block(header, interlink, body);

        if (nonce === 0) {
            await this.setOrMineBlockNonce(block);
        }

        return block;
    }

    async setOrMineBlockNonce(block) {
        const hash = await block.hash();
        TestBlockchain.BLOCKS[hash.toBase64()] = block;

        if (TestBlockchain.NONCES[hash.toBase64()]) {
            block.header.nonce = TestBlockchain.NONCES[hash.toBase64()];
            if (!(await block.header.verifyProofOfWork())) {
                throw new Error(`Invalid nonce specified for block ${hash}: ${block.header.nonce}`);
            }
        } else if (TestBlockchain.MINE_ON_DEMAND) {
            console.log(`No nonce available for block ${hash.toHex()}, will start mining at height ${block.height} following ${block.prevHash.toHex()}.`);
            await TestBlockchain.mineBlock(block);
            TestBlockchain.NONCES[hash.toBase64()] = block.header.nonce;
        } else if (this._invalidNonce) {
            console.log(`No nonce available for block ${hash.toHex()}, but accepting invalid nonce.`);
        } else {
            throw new Error(`No nonce available for block ${hash}: ${block}`);
        }
    }

    /**
     * @param {number} numBlocks
     * @param {number} [numUsers]
     * @param {boolean} [ignorePoW]
     * @return {Promise.<TestBlockchain>}
     */
    static async createVolatileTest(numBlocks, numUsers = 2, ignorePoW = false) {
        const accounts = await Accounts.createVolatile();
        const store = ChainDataStore.createVolatile();
        const users = await TestBlockchain.getUsers(numUsers);
        const testBlockchain = await new TestBlockchain(store, accounts, users, ignorePoW);

        // populating the blockchain
        for (let i = 0; i < numBlocks; i++) {
            const newBlock = await testBlockchain.createBlock(); //eslint-disable-line no-await-in-loop
            const success = await testBlockchain.pushBlock(newBlock); //eslint-disable-line no-await-in-loop
            if (success !== FullChain.OK_EXTENDED) {
                throw 'Failed to commit block';
            }
        }

        return testBlockchain;
    }

    static async getUsers(count) {
        if (count > TestBlockchain.USERS.length) {
            throw `Too many users ${count} requested, ${TestBlockchain.USERS.length} available`;
        }

        const users = [];
        const keyPairs = TestBlockchain.USERS.slice(0, count)
            .map(encodedKeyPair => KeyPair.unserialize(BufferUtils.fromBase64(encodedKeyPair)));
        for (const keyPair of keyPairs) {
            const address = await keyPair.publicKey.toAddress(); // eslint-disable-line no-await-in-loop
            users.push(TestBlockchain.generateUser(keyPair, address));
        }
        return users;
    }

    static async generateUsers(count) {
        const users = [];

        // First user, it needs to be known beforehand because the
        // genesis block will send the first miner reward to it.
        // This keypair is the one that the miner address of the test genesis block in DummyData.spec.js belongs to.
        const keys = KeyPair.unserialize(BufferUtils.fromBase64(TestBlockchain.USERS[0]));
        const address = await keys.publicKey.toAddress();
        users.push(TestBlockchain.generateUser(keys, address));

        for (let i = 1; i < count; i++) {
            const keyPair = await KeyPair.generate(); //eslint-disable-line no-await-in-loop
            const address = await keyPair.publicKey.toAddress(); //eslint-disable-line no-await-in-loop

            users.push(TestBlockchain.generateUser(keyPair, address));
        }
        return users;
    }

    static generateUser(keyPair, address) {
        return {
            'keyPair': keyPair,
            'privateKey': keyPair.privateKey,
            'publicKey': keyPair.publicKey,
            'address': address
        };
    }

    static async mineBlock(block) {
        await TestBlockchain._miningPool.start();
        block.header.nonce = 0;
        const share = await new Promise((resolve, error) => {
            const temp = function (share) {
                if (share.block.header.equals(block.header)) {
                    TestBlockchain._miningPool.off('share', temp.id);
                    resolve(share);
                }
            };
            temp.id = TestBlockchain._miningPool.on('share', temp);
            TestBlockchain._miningPool.startMiningOnBlock(block).catch(error);
        });
        TestBlockchain._miningPool.stop();
        block.header.nonce = share.nonce;
        if (!(await block.header.verifyProofOfWork())) {
            throw 'While mining the block was succesful, it is still considered invalid.';
        }
        return share.nonce;
    }

    static mineBlocks() {
        const nonces = {};
        const promises = [];
        for (const hash in TestBlockchain.BLOCKS) {
            if (TestBlockchain.NONCES[hash]) {
                nonces[hash] = TestBlockchain.NONCES[hash];
            } else {
                promises.push(TestBlockchain.mineBlock(TestBlockchain.BLOCKS[hash]).then(nonce => nonces[hash] = nonce));
            }
        }
        return Promise.all(promises).then(() => nonces);
    }

    static async mineBlocksJSON() {
        TestBlockchain.NONCES = await TestBlockchain.mineBlocks();
        TestBlockchain.printNonces();
    }

    static printNonces() {
        const nonces = Object.assign({}, TestBlockchain.NONCES);
        for (const key of Object.keys(nonces)) {
            if (!TestBlockchain.BLOCKS[key]) {
                delete nonces[key];
            }
        }
        TestBlockchain._printNonces(nonces);
    }

    static _printNonces(nonces) {
        // XXX Primitive JSON pretty printer
        const json = JSON.stringify(nonces)
            .replace(/"/g, '\'')
            .replace(/:/g, ': ')
            .replace(/,/g, ',\n    ')
            .replace(/{/g, '{\n    ')
            .replace(/}/g, '\n}');
        console.log(json);
    }

}
TestBlockchain._miningPool = new MinerWorkerPool(4);

TestBlockchain.MINE_ON_DEMAND = false;

TestBlockchain.BLOCKS = {};
TestBlockchain.USERS = [ // ed25519 keypairs
    'Mmu0+Ql691CyuqACL0IW9DMYIdxAQXCWUQV1/+Yi/KHbtdCeGGSaS+0SPOflF9EgfGx5S+ISSOhGHv1HOT3WbA==', // This keypair is the one that the miner address of the test genesis block in DummyData.spec.js belongs to.
    'HJ3XZfRDoPMpyEOZFQiETJSPxCTQ97Okyq8bSTIw4em1zS3x9PdeWBYwYcgBCl05/sni79TX9eu8FiZ9hWSruA==',
    'xSYRx3GM0DPFi9icVtzodvnjck/7qcc/92YTRVXcqALVtCnpK7PZYIYb2ZUp2Y+tW3DHg12Vk/FI1oLUIny8RA==',
    'dNxnxlHjOrthMRIFpWmaNMCccqjXrlO/eaD2g+1jvh8grFl7ZN/P102AYogOWBGZayH74Fcf2KSfy1/rDlFMrg==',
    'JDfN8h0RHx51lMyY29UQcLjQR7ig9URcPPdxhRclhk/Wht9pnUIRXtzYWw742hlaOhJzkuOqqLg2oEM33hIV3Q==',
    'OBZNFtzBjrJwaYq3A+sB0zpGscmYaIHrULfP36LT+5+sF/roKPCiXMcqT7OcAfnNCfzo+x7cxaqcoNEm2+VDVA==',
    'LkC2ULxwljHcM4sFe6yA1eaYHPoPl4j2kh+5qtzPNr1vR95be3os01XpsINXwDHNucuevBGmzyJYbwgcUsFRiA==',
    '2r62ml0RiVd+Wxb/Ef3QsNuCkElNgit6+VQpiPg5Vo8jLY4WEX/L1OL/pJOvLfsnIvb+HTOmCA6M4vpOJRb59g==',
    'kVuy+yezfkkaTRxT47bLMID+JzvyTD3LzQEJTKk8X/RMJaaGSYsDiz68fxtS6m+SSdv1MUSogYz07K3wdr+nng==',
    '8+P/0UlVK/jlFVQBK9Lr4cv4sLXVLiL8T/ahU0wXOYD9hAwqH2/GX7ghf8pO+0AcyBPbBBh+Wy7GgKxFLZ1YdA==',
    'vR8sgRd+wa+n7ymTHB77h2TS91JTvp8pJSH7/c/dZlL91+BMMuXbSr7MBjEPw1rf7qULOts+/zAvnfY/IYsnJA==',
    '1R/x+Mb9PtWkyv3nZpyL1QT19hGj6QaH7cHd0yArZWhl7aiwZ4exu9uX96/TsxgXRX4LA5tZ895IXswXZvnDBg==',
    'aRBGIzF50FEWQoStq/hwKl/50YqvqjSxkBUu9BJ4HVYEZEQdbKu1JDr6/DX8gIT9mC2TQZriK7VNMUVXfSEhPQ==',
    'Uub9Wb4pzoX2cEKwJErP5LoqELtRFeF5BRnW4Y9lZRJNQwmIYnUr6uFb50o2aN4iYlq1s1GsAE8c9gZyTsO6IA==',
    'GfC3EOtTnlMM0z7A8dnwKuA4y1DSIQuwCs8FFRYrhL6lVs4r5QQSJlnuhYjGFSE5m+3392ELkvYNmEQL28u9Mg==',
    'lxFSrIseX4bGZYJY/FrWjEtFZ4coJucoIjab9jc8675mTwkPuB7t7BCmaPPN67WxQFD0Qj5vw1NUQ66q1SrtdA==',
    'zGLx8jnMMGP5T7enK/BQTPc47vuzl+yy07Wcs161wGK0Q5uSlGK6IfF50MRgs1Wn0sNeLqbILEk/KIZUy07erA==',
    'I+zEE/RCxbLOtRA90bVu+zrqFg7nS6MUTn+2f5fbQ3O9jio9dwuFTkrgVLEGe9QbvVGC7NP3bIsjwNvgx3q2eQ==',
    '1Oz7m7esArq2k0AXqHxUwjFcI8DGfR63MUUMuGuvcG+GP7VA5dw5NlR3i2uF5kHEy9wWB64iz/hP9RxXItJAnA==',
    'X/06OWBfaMkHRPjtbzSXx2A1BcrJy6mUl7ndXiqAjK/FHSMI64mJ0VpPR3d8QwphDDUfaHHKt8in26vvUKCUIA==',
    '6krkaWJRA/BrSXjU+dAzRGq9DtNjEEGR45gF0Obyv5elzSSGnO5+VgGItN2StcKfdpmkLFSFm91Na34FEywIsA==',
    'rUjEeM4Hj1xI/GKenLd335fIn4/+wYTqTQB0G6W+AxIzp1fnNY5AMusg8+fab3f6j5DVJDy9OCif5ZiP4RjaBA==',
    'RqaLfBj53rhPWZggf9l7OGyf1QvYazUoHCrep9lKNcn82XSH1cQbTuaGo0YRkpJlSp029uG70LOm//whFGSiag==',
    'YhnMyCfXwdIRcul1TAZbBU7IsASMlC/2Vhmr/gwFjiMi1OlO3DNdnzd70aOHzoYyXSxdtqWGKcEGOn/AtgUSaw==',
    'g2/wZc1CCHBZAajOs0yHBiIj+YTBKf2kFqg4feCj6qNy5yilcUR752g6MC3pV0scZbEzqLzK1kZ5tnxOjbZYJw=='
];
TestBlockchain.NONCES = {
    '7cyIBzjnarUx43jauyq6VpKa8pW4+2GLT3myAOq5y3o=': 93094,
    'ldXC8PJ2lNMa3AYUWLe3D+HynFiEKA3k7RjcleRZ8vc=': 8641,
    'bJ5h4myf2WS1Us49O6lb+BOa8fdNwd/Tvz0r1w+fEAw=': 32714,
    'mLa2XXyCdhB5N3h7sM+G90hhUQMXwC/qN9qHQbaDsy4=': 53226,
    'kOBPT8C2/fvNNzh+u6gDS9D05knPO9fc5Tbq7q1sGps=': 33570,
    'qWtfp+DIHIYveCtGwDTFJw8KLZDU8SEfQXLoPTrGsHY=': 12263,
    'pnXUNKunv8pqZMeyEhFsWqAY0w84YUs257MfJmzzHF0=': 41055,
    '9xMdUS+JtPCT83Ml4Um0lnE4ZV1p00Wmt/CCTOPE+rU=': 2629,
    'R0kWRj8VtTM0Xt0MoqMXNSLOqnrRkRl9cQUmzIdTxg0=': 257225,
    'DedB/l3f9Y9OL5wVL2+As2su9mJ7sPxz6rA23pdsru4=': 40730,
    'SXqDrAesmoqLnj7kP+75iq3nFBAUu4Kdxy2DXFMI2rE=': 53910,
    'cR3A7Paz2MX7V6i7pQbSuLLsYxMKHUIiRkehuD5ZPX4=': 186161,
    'bMYPkWtf0ma/medPBL4GdMWdPizfEj88uVbPGolfGFA=': 47377,
    'yPutNDSBY7b25E0vbHRU58OZow+9DgEJgzkwztLZNVg=': 5883,
    'asMixxHEO4nI7FAPE89uYkyWO6mIcUwQMDZIdRWxVQE=': 76956,
    'eNlmRKQTAuDj3pr4ZH8imGUmQa1UBpWnxlqz6JOlIR8=': 60100,
    'zRDB7dzSf6RpuKIVC1yOPbRviOJHNFz1aJNSWCb/XGo=': 22732,
    'j/kbjTwJvixQ6QFqkzjSYuYwxswIBKreBWdEF4jAy7g=': 2017,
    'PaGDTMuhkr52k2d2aSBzGt8QTuJkzh3MnUtvS4sKhSA=': 22474,
    '//OIXyr4H4BPGutMKVIxEenFgv+TneH6RcJo39I0LfU=': 103132,
    'sU/CIi7LhAWG/iP2gmsebmZSM529nYXBR3GOMtKScfw=': 181778,
    '3GyyvjzR7RUuxB2EMgD67RA1Ual9B+mTSXIH/wa/KFc=': 45269,
    'p0FzkcjbQOUX0bFxGTe1w3S4RrNLwwyDwyyc4+sJPbw=': 44109,
    'rKDC5Vzp+WBf9sKAY+Ohei7jKHhBFMDSjog3YvasEOw=': 68332,
    'FAKMNOkx6mEFC27NCqNqI/t8V95bxOtmv26FSEubBXU=': 18761,
    '5BLjNOdwFSTd6nDYoUjmtCEthEZLRqKQFUIxKlxqCbE=': 58934,
    'PgetRzGr99CchJloxiwby4q1UIW4VeiJKeIHS4hyVGA=': 7216,
    'ulgiOQLjaLZgK9AVixUBHBmxQ9UQK3SgBPmu7ufTUZE=': 25841,
    'cCaO2yR/bElUIq6wBQeN7YIjkfH55WCV/mQFYTz7kXc=': 122783,
    'TBKylG1fuZ1wsNqZ9rcz9F6Q1Pr77kQaJi0fLqxS0lY=': 76844,
    'alAboGLz0sw/P/5X9xOcMuHbAEKsDUSKD/wyMo10s+8=': 32258,
    'ZVXb+BEAt0CCmuDWvkbCPi1bMzcTzMK1bJDVdBut/Zs=': 70693,
    'kY0xAKEiUiyX5ff8Hds+EmnZP6Ey49w6jRcKdLsDjxY=': 49117,
    '92xap7RQyeLwyq/iKQJ9WCsg926ZsccnOIE0u8CO2/I=': 48810,
    'JahVUO8AiC9j5/VtMCBY+4/l9HqffHM60zglA+QRokQ=': 15403,
    'jzLA2oQPkE5ivNRVpUkPSQOLTOOs/UJYp7wt8CFN0+4=': 132422,
    'XOqOCEhDlkznVpYJamtiZyezYRfzCbEfp0XhibHdKKY=': 18047,
    'mJ0l9PlDpRhJTkruisJr3kyP0UW0WqPVuNwbrupJc84=': 31700,
    'cJ05yYxevc92Pc39MZTHBUC8j6Y9xYb+Owcm33mn8Is=': 8287,
    'dLMKX9qouqRdplG22XiFcSM3cOCSgIGiglbUwxjBOOk=': 11783,
    'sN3ZVVWLUzxbKj0XPRDwT4BaPfm6WJr+WQcLpLFzEq8=': 66429,
    'gsWC4MvWQPmSH01WcfBve3d4IJa/7l6sVNT/56foUA4=': 8167,
    '2g3VY0Rtnwip2r+9hm/VndZs1BnNc1GmI3kRP4GHYPc=': 91332,
    'AOV2C+wVvI11NuBp3F/V3jvswmy8yAaE+x/RotXmr6o=': 34772,
    'b7vfuVTV8seKuV2QSv/KRhLuyk9OJYphUYtwHK8JS4k=': 68377,
    'UfsvVkfQlj3ZeUF8rOC24f0nY25JDrRLhlwBqGatGEk=': 145326,
    'H6Aov/Aq5ofkaiUTWe8PmySUEPnvRBzVB4e2siCfJqs=': 137980,
    'Ie82nl1LrvTb2RCKn+vL2vmLxVJr1rqrtDND59vIoF8=': 269323,
    'c8zxXuSGJgbQ7lGb2G8jvfZjuYuG1h3BWZjOuyRGp/0=': 26736,
    'd8V7p1f5PfQwhfdQ9YQJ3AN0kCOJJdAaU6hbhd+reQw=': 25831,
    'z/fK11mzA+AgRIbt+2yQubQUop8jKiFoDnR9XrWMlMU=': 100743,
    'nZaywV0I3vE9Mto8YYLTPKQ5wwF9tup7SpGkRXND7Dc=': 44664,
    'b5h3BdRkTNBkFy4hrZQBCceg8lg/kdOfx42hQKN+jkk=': 78758,
    'UEH4C47Dgh9Fv36oVb2nbd+ccacXzkAEVERlCI4ROUw=': 144794,
    'bGhCNWvMK/ya0J6YiBsS/qTKudVlvYeqs802Twh3K18=': 64834,
    '72rJtrcRRMRrjxetKXxXoSgtmCNaXKYpoaR6pDt5hjw=': 38565,
    'iL02ly2ZK7ifSIlIJfjA0ARUwG7v4ukKvQi3etsxJRg=': 53094,
    'oS23jzZh6czQwIFhGy+futnyTVEl3L9re/YC86gyCN8=': 13689,
    'TI5YZpMskbBIdoMOb75PMdVzSC859U4uXAvgRm702V4=': 42468,
    'x4ckKzOO1ICqXgLs/iibt+g6u1IPZjjQ4l3RiW6DDLE=': 76309,
    'c5N1JZW5+JQ80IjzA/a5dJFB0eEnvwSj9U2FWAoh48M=': 23234,
    'ZdOwFEc2eii4h1e1Wp2JUGnZR+yu1N5Mnur5mGqbmAE=': 3508,
    'N3jbe1hZpul+4ZWPB+i/t1IlJ7ThJCZtH/H1SOJUGHU=': 99697,
    'jkRv5tbVrST4Exdk52efjXDYFBpOkrIEkBWZPVO5NhA=': 289363,
    'IkAzZJH+5/8vLWGI0yaY2MIR5dsaIiaTh3O+BH/+PMQ=': 8324,
    'QXH0ytgzzsjc27fHcjVdPfhvrfqnUdPwTwFprevStts=': 15651,
    '9EhShvQJqCVYsNN6VMu2Q3atyW4MyrpcUDTpJvgnnHo=': 111406,
    'rsOUL3vdPsE+sA5ERc78NQle374lTCOQ46buoSjp+QI=': 46857,
    'JEFcmqxT55eDi/B3zHRf4g8m70HOddy/vsipp8t876M=': 75057,
    'wIQhZqFKS/O6uojeUPQ2IC4IRFERnped7uU2QwFhxOw=': 38000,
    '7lYGpfXTP+tIFvlrvl+oOpyTrN+vOMGyL+5JonufST8=': 22473,
    'ELweYUBbgBy5TybAtrdLnS6JI5WtLS5+uldrik/ZunA=': 62303,
    'Oaxoa23toLAbBEEJptj3a8E+TndXzMaULoZbL9xDNlQ=': 7173,
    'Hwyr8Ykggr7KYL6d3mB+jty52+k7h22RjaDrBKruHfA=': 6207,
    'S82dBIeJkKthd3fc61fVEeeY5bjqnJ/Hpj2a3ppCeyo=': 221913,
    '0pbCBUnCoPfnAhNVSKcgbTzBDnVIUf+zuDcHC5QZo1s=': 10579,
    'YcwzSAylxPqPMhTRGqH+cuNu8N4F/x7DjxLgmKHF0FU=': 60220,
    'BQndt+T0N/bW/JUO1J7dBhmWXg9zGu9ahGkeuubR908=': 47306,
    '2ilbBGfJxs8+xO2aNgCmh+YhfT5nfy7dydoNs0ovLfw=': 184673,
    'Equf3XrHKZKKZYjE9mXXkhMAJQF4FBt0Ue6OWEuag8U=': 62133
};
Class.register(TestBlockchain);
