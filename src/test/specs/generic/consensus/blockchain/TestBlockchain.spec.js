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

        return transactions.sort((a, b) => a.compare(b));
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
                await accountsTx.commitBlockBody(body);
                accountsHash = await accountsTx.hash();
            } catch (e) {
                // The block is invalid, fill with broken accountsHash
                accountsHash = new Hash(null);
            }
            await accountsTx.abort();
        }

        const timestamp = typeof options.timestamp !== 'undefined' ? options.timestamp : this.head.timestamp + Policy.BLOCK_TIME;
        const nonce = options.nonce || 0;
        const header = new BlockHeader(prevHash, interlinkHash, bodyHash, accountsHash, nBits, height, timestamp, nonce);

        const block = new Block(header, interlink, body);
        const hash = await block.hash();
        TestBlockchain.BLOCKS[hash.toBase64()] = block;

        if (nonce === 0) {
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

        return block;
    }

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
        const share = await new Promise((resolve) => {
            const temp = function (share) {
                if (share.blockHeader.equals(block.header)) {
                    TestBlockchain._miningPool.off('share', temp.id);
                    resolve(share);
                }
            };
            temp.id = TestBlockchain._miningPool.on('share', temp);
            TestBlockchain._miningPool.startMiningOnBlock(block.header);
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
    'GlCGvASNFvQxcdpZ7fTROwgAhSQufwy3DccHACNhot0=': 3546,
    '3LC4WFD8N7+z84J2tFJ1QRvCoUxZwwfe5gynoLdpw3o=': 38808,
    'N9yXNpLjuhhg2ojJ3//y19bXgdID70gmBMDg1w9cQuc=': 62589,
    'Gf7SM4L42qjDJCF6gkAZI93yrXJNMkPX1G3nxhp0QtY=': 24589,
    '0UcQ1RIM4YOai2H9k7MfWulUVgTEcUvEAhQrhDeYjUo=': 45301,
    'BW460+owYWJ1WEJnSXDhbhpCsUfCYyG3gt65GBuC5sM=': 31204,
    'ivF1MtCxURAXGbJ47OxLfDOSJBm71FsfqrSlekodTHU=': 5600,
    '9fomTj1HPp3XdQvwolTWBDFS2aYoZAp72ZUtt7DmkFg=': 47890,
    'ijrnQnCKLl2nD/yEl2EsvH8JDJPtrkR+mfykofz8/tg=': 77059,
    'qEjglhDaLEXxde3iu4hF8mHaOtKCiFSHpNwD1Zq6eg4=': 500058,
    'ooOdzDVUEfnkVbIQJmlBYO2P0+sQcVXWswB6CrfZkmg=': 95665,
    'eRtz/OnN5cxci8MP2cNzkhUlmWMGJAijt0rStz8XyaQ=': 35937,
    'pKFsK516CfvVPSpvfxzq7GTEtRKGIO+V5NmrD4FY0Sc=': 43910,
    'Ot4k09fkmCaDSC48kGg8GpJ367CDDsYMvdhbFivB5ek=': 26667,
    'ZU88rRqWTooxyq/Upv4Be5BTV90CZgd7Ly+rrU4LbQ4=': 141852,
    '5OeQBkGsmvZoH53bS08bZwQ4b2g0B80oBwrDbU348x4=': 54602,
    'bQJ/UhpqsEh8SFfB0+ryBEJn1nbEgNsPjKyL4buerlA=': 21967,
    'ZBIp5CiZ77h5iSqqN7HMh6mzlrL+WW5Wyg068B+p84o=': 65810,
    'u1jmYj099LG8a8kE18ROurrUNatu1Aq8CX5IyiKsSn0=': 69309,
    't04Gr5oP9AIxVaMBu7Ecnjjl3naBDDYnQt94nTopQYQ=': 155114,
    'lmETh9+r0cSJcqayngoCz+JqCqR57+7zbMNVdXU3R/I=': 69636,
    'FpFiD/2ISYSXcXn7zpPnP/3tB54F2RAKS4j0RCJBrRA=': 17555,
    't8cG2Yhkc4aoYvz6zzCSDww4vcDM8xknFCdghahatnE=': 16907,
    'Rhg04+0EqPvwoFIQk05q/bloFtH5f/Zjb6XRRTZE/S4=': 27936,
    'lJgTnbWxPsazDU+D7pdbAmFrryVPtapM9y6xWv95fyo=': 74617,
    'HhjJ8QS6aTF3XRr9h37h0W5B0UF67TMXy6ohyVhXavo=': 94382,
    'JXrnVdgwk5dcPh5GgxNurX2G1mcfhZoJeOX2X/3S8/o=': 337962,
    'lKh1lMx1xqigNW8HwOttXt2FpACFhu5IBVlCBk/WZ2I=': 64870,
    'Pkktqc7MHoD5lTp/gFK4ENIO2vlSdtIO52a/c5QnpWg=': 3454,
    'zGFAaDbNRMJ/sdsL1IApmxeCfbb/5svaEU/VVsX/3QU=': 80874,
    'JGI5d80yjvqDSnC+QqLUNNwEXaxSHhNbYlb41di4rFw=': 13675,
    'B6tE17cKRizRxAGsrkULl2UFs6oA7t+mGjY880J9yhE=': 20072,
    'znbBFLFzUrM4Ik2/YgDJvyR+72nBCq2niYOybwxTSU0=': 33868,
    'ZBL02bPmwX5j5rtFWdX1neczXYMYjkdYykcih0slwvE=': 46202,
    'xyEkCDTbDd16jCwAz05q+M0px/QcWKwngOdOJcXV62g=': 59167,
    'fnbP6YNOi/9fOgraXB/ChV9AitR7LcoukYIPV2OJdpA=': 7318,
    '6yFZTL/66T88leglHTH/qYrO305FFtA6YKuKCU2O+m0=': 27574,
    'RuYfmnBXuBGJokufj2TGXsiJ9aqlfwHIhx1DPmN1ptQ=': 52716,
    'X4zXlvPD7lzFbBYW3nXAfWE0AYdpjbWTA7SkkXRDJrs=': 75022,
    'e9mfiD1jgT9cDSzVy6T5biS/lZXbBHbAWW/bdt3xot8=': 219738,
    'r+ICorHfPM5N4NjT415GwUKe0ht6fyONe3SOnQOuGSk=': 1271,
    '+7lX4b3MjIoFsM9iAlHTuoNzraHBoufUu/VMdlfvwlM=': 39658,
    'mvFWI2jFAnAxhQbth4QBqsgDUyKtOZfZITUl+54EKeE=': 6385,
    'ZgD631scWOvh1Ur9KPSFBPjnZVcjY2ONFoB2IyaFNyY=': 48862,
    'glyKO70mbeLwk4W2mYVIxDqBjQ3XrrB4OAhBO9zQveE=': 36412,
    'erunxqiEuEumpvQ7Ya7dSMmNhDKWTshxNJ1YZdN2Q4w=': 40516,
    'vtx07S51c3BMy/qMQqPgK3gQ5uAj/8gk7RCsb35EVug=': 6060,
    'jcXjI0c+7BogLsd8qh0gif0o5z/M8bw68WKE+OSmRIU=': 176302,
    'KrnDmWTXjacOwXQ2zq3maoPDOJzKa4yWPxGr5ZoyGKY=': 69993,
    'm/XWq6OBPaIAoTmG7i1k7veXMBVzczeSSJmxb6zRPy4=': 179277,
    'x+9vfksxAW9EUPKUBQGQK6YH8IhEgmXXV/WQrrY78cw=': 3650,
    'VpLdSDCUnYjfKZIjE0oP/nz+QYiREXDRLUYL6Q3SvQ4=': 41561,
    'M+PID9z/e9ggSm4si5cEPte6ucVLLdoR0UYPQfhufrQ=': 47874,
    '9EZU64N9td4j+B8Hdd3VIA0SM5VmwWPRTQtbJtM9wrs=': 116037,
    'WT1oNjBzJ9WhVDTnzL9T9JFIFn3Tp7XZb05djcG00oM=': 64023,
    'ocuXB48e9UZzkEwKRNYiTVMdHFbv+snLGqBLACA5xrg=': 61526,
    '2oaMrXxudJ0ZGi4en7wadCpcDF0Gpjka23r0kASTqrE=': 49161,
    'FStoFtOJfgFHJQnOyaIRXK4oEvv04IAD/e4SWWZHPhg=': 85658,
    'aVsiveJwvptGrqu0JiaGW7hDqkVe9KLKwql4FGPUZNU=': 63791,
    'pC2loAhuoMyX7v8UfTAP/5wlj5udDvyrY3vFo6CMYh4=': 130529,
    'r1IWVdV1kLY9NxH9may0MZAL5i73buaftaNckEDXjcc=': 18341,
    'ASIK8gAuR8vRocKQFoVLxHdccMp0rz/QiSA8kDpLT3k=': 82582,
    'LXCB3hY+AnZ/+y4xjrnhuLDu2/9YCBh0Gf5uB42dHBk=': 112810,
    'M5PuY9sHpLB0WRjFxv7OgevF7mZEIamydjPru3x2D7c=': 16085,
    'e3cKuRGRUbMu/syA1vDgd7WYl0u2K7XAB9XrynUc08g=': 84107,
    'UBmo02JKA7vPFpBKWFYDUqUXf+wP0mQxNnyg5tW3mIM=': 147812,
    'QvjDWWDrQkbcB5sHwLgWTy7a12hF6tm7x5nUWO3wNKE=': 35916,
    'mFqObQXJJE66kxqgnMlGUtKIhF6+DVjK7qLgJ/5l0XI=': 190624,
    'lmNvUxaXXXcRC1+KZa7FJczs1bJjLB2mkEJdXoa0IWs=': 93381,
    '1h6W8aVR5eVVB/7v7UeKyAkQtJMiU4ehbgjX2jxDD5Y=': 114555,
    'Vd+RpRLnz/iEV/FpEN9aubE3smHk4mdizHI0jgPTeg4=': 49952,
    'dUlzQdQ+gzdDrhLc4tUdDt2V7/pRyj/qvaabWvu6s/Q=': 220219,
    'FhPwzY5HxnLUCCsfwGnxOh4XN99A/vRZPeEuvahZD7o=': 3622,
    'yNU1KNNkaZER+buEozBmRl3vGWnzX1vi9DxZ6N2nE6s=': 29878,
    'svKcwOKE0xT0GpdiBJ7f3eBwuGXV/25hbDjl/T2xLXQ=': 21068,
    'XM05hYy+Q6vDqXCGTCVCqT9mUlIFQHO1euo5j9P7HGc=': 16614,
    'GXUiyEa+EuRmR8xHmhVc7Bg6BGC+cSqdCjHucoTrDEg=': 21087,
    'KeqVMbV4CXswyC3jk1YWsZWmA59DBG+a3lsI0poXd3M=': 8156,
    'eBVzhCgWK7QD4tFotWL9KrBzlYcw01O36I5Yuu1R5ZA=': 97739,
    'mswY36H9PCrU9dclCCCQSSikRn/b5mhBsRV3U2RKmdI=': 22553,
    'IutDoLZari8tbSIc78v6kv0Y1UGtf1+Gbo5gMev49kc=': 32475,
    'eaaDldXgocgZh1uPSqIa/0f8Fb0yHaNgDpWr8gufqas=': 206080,
    'YVSNUGHAHiylV5j7RbdoywDKB0Uk5gio2cWLXNYlPlw=': 128653,
    'GwALlbssSSb058I2rAJOKDwaTnin+xiWeWZY5sUipq4=': 22177,
    'WCBwIv7F/PMk/H6990jFBMxlWhAHPncF2DuzDpCbODI=': 13511,
    '1WmFblAE347aPmhDOnGODK5UesPZJ6n/j/LGTJ9Jucc=': 29304,
    'slgDY28AwgIxbQ0pzrZqV6R9Xw36nJAX2zmHgP2rqtU=': 8094,
    'kyFhBuBzXTON3m6/ZE+yF2f/3zn+fVeGZ5hI5MPiKiI=': 111584,
    'n87RE4W5xPFxyLoruukHfAWFVv1GZmE7T85Ojp9wL7E=': 29826,
    'iut4wnU5NOyBf504LOigB/xGAPexlZ8EqFhEwLd+WKc=': 15669,
    '38A+63Ti+I2//tVr9NhJXokCqAiBAFfUNR50UwbxFPc=': 69254,
    'dM1X48w7MaokkCRqaIx7DrMse3WQHrkBruCdYjTRyao=': 2691,
    'x7fMrq94kqDGn45egrCpFHgMx5pc9htToDhQ0K+vzeE=': 22498,
    'ueO5csu8l4f9I7x9Jn9SMrtx1f5FynrVYXbCLY0z21s=': 2261,
    'wJxqlsmBrIdlM1mdUkrNQj5KavcLUO/X62oSZB43qNE=': 190111,
    'pJ7i1i/6qJ1OVE6t1PWT+zBufuzSviT1cc4ok77k7S0=': 38278,
    'Kko/vOETqCERZmVr63HqIawMqXdRGWpNVnHpUEgDjGI=': 75284,
    'lUPdGKa3vYHOjebqLqCwMdsiBSSMQFRJYr5Vnpi2HPw=': 39410,
    'mGJB/cMIlpPqqQcn37UiNCkTPdXEEYz+UR3LWAZHlv8=': 72375,
    'eyBJbxKj3+70oEPV3LQRWdxxs+z2V25VBKcssfPX8aA=': 12121,
    '2IWdLQXtFSTqaQ+ibYrtacIPVvJBSvSXsNGaYBMmT3Q=': 22847,
    'e9tBV2KIhVg9SCrv+MCQs3BXD4JNaXX5lVLFkD2NlRg=': 6633,
    'nXvKaPxUa8oB+ZiO6FMaPsg7yRpARRyb/Tx8eEyN6fc=': 17151,
    '0VGfFKU1N557ure/KDoHg7bLvBaKCJDDc0An6mruV3A=': 83284,
    'A9Sjh4IXG4Cser1z9QNYmem0yYH5XXOb0cHI9SDhquI=': 212162,
    'BxrwffDbBrdS0tUo71ykYi5mM1D0zHuQFuh/JwBHF9o=': 148657,
    'opPKiqjIB9ZEMCcSJFm6q2TUgLVFAF6qqtrNV/gFvuI=': 139712,
    'hhdrzNmO4nMqennImYQ3Rf130KtfsLiq+QAAwuclB9g=': 2002,
    'Aw+LkxciI2Rm1lohzvkwUu2zRM7cxN8FpGcb9MCzUYs=': 112057,
    'kzhkpjj9OYt3HHhONos0M3EfrRHYtSF8nRE3q3MuyGU=': 3322,
    'B7BYH7A5Gc519wCfX/oNhyyh72ewNqWGcR4FvMdDUA4=': 75518,
    'UTwNG0CtVCT3Q8KOQs9fHM2Sh1lJ7X9IGFecFgDCTXE=': 34248,
    'No1flonYSDiKd4ox9FyRTW0rsI7iAr3Ds4BnljQwZiE=': 76386,
    'U/TKYyvMJcRm+pL5LXuGaOdDPoyR2sSpl0L5Imjafgs=': 16283,
    'F4xmRv4XHTbbB9lY9mVoFBS3lTUzNpTn5+9tLI9NaKQ=': 50985,
    'wATkado/pSTJePNZh7nHOh9egPvryrWVXh2YywBZzmw=': 31829,
    'gcsASAU9zOhRJAmRp0AO9tdsUpTIKzh9hvRKdsDiX2E=': 40151,
    'BuH2qwHh5JmqQK6cXH5oMpqPpAFFiCE9j+CVtiNYh5s=': 24710,
    'WKiv124trKXfyQKr6ouKd97gmDJKdhKGRaRy32h2w64=': 29908,
    'dO+ocal9d3RAnb5BpKupmmEVlkPCASDZwmFW9bbRrw0=': 53167,
    '7HdpsDOBHvfcnKrwWcSb5sBd6ldZk54zpJJlor6A878=': 48450,
    'tizrGpWlRBCSof5Mr8JOJLvaosaJmPIxpVDHvxfXqtk=': 100459,
    'sxHxl4UrEfC1wxEVFo87SiC2+DtIeQi4Q1n+/d5LN6E=': 43151,
    '20orSq8u2PiYKGABTVWw+TSj0IuVUvfAkl/qsXWSiJw=': 4605,
    'MkGiGgFMzW4SMpwhu72DnI/FbX+qcU7aWMamW/Ge1d8=': 132343,
    'g0mCZK2iJ26W+BukibBvpha4XaUvDDEOmtiEzo+IfJA=': 3861,
    '7W5ZWlNak7fk/OANXKmOjlXOpdZaFq3bnoHuawVKrZ0=': 86932,
    'RMKZEO/q7HqTSFps+FKlavH1YJuRU9Dvx2vW/2eRkF8=': 29831,
    'hfkQKsKKzs/hyGhAPz4KUKYAUQvj41kEyUN+R1gqjVQ=': 12766,
    'v9ctQCyxKHCUSWjlAJiklr60ROGnHi110041Z/K3kXI=': 79715,
    'FDu4VRMbIaTBJJN0g5Tl6z3NuIduRO/l5NIhBYd9pH4=': 152871,
    '8raYOXB8kSI8OcczX0ldPecdis+EUfaFHqmGP9R2ais=': 55347,
    'QNA8V3nTIyoJvUEHcVVpaBGaFd9tUZogHEe+/oNGEkU=': 91436,
    '2xLq+qPh9NPqdjt69/cKieChPlRgVy91IwdNlPTfnCQ=': 14297,
    'CCMcrB+s56FNLt8OaDhBPY1nUsUhwrXFbVkXz3R6s/g=': 130992,
    'xUWmeJEwbnrMjVtJQB0ty0YW2f89gXytG+NQs8tsCEk=': 167149,
    'hn5yNmuYV2Rjs2o2BPDfiZr6cQnSpmZmd0zEgvpB2TU=': 76281,
    'D+yDK+ijE8xNwJ0gU4UottWZUjyzVzEc2jrSbXt05Jw=': 79764,
    'ooHVqWNgKQ+uo+zRl0N0IuP6RF6Tn5chPJjqraRCOIs=': 185564,
    'ehmCkx6zx2ocWrIyh73bhhro7XxfBAGvYHtH6Wlg3Ho=': 6763,
    '9vr8A2DMUiWQsPreaqlptfipUmAJFciA5lS2snX9oW8=': 11798,
    'Ca/VLNFE8JBPkbtcWlElBiVA9a6/E9v9VNBzJMk/MDk=': 27300,
    'YwDKB9qQjm1ZuLUcB8lL6QJr46UdqWjOPpxSXBUA9JY=': 24239,
    'XDP2b+GOpB12+6ocM/NbIQze+f4LZ9h0paXlhWs0d38=': 14951,
    'lPauCdvn/etzCGAU84YsqIOBc8GRTwFn0L50/91YHzQ=': 156525,
    '407aho5kN7CLm7RGQ2TDSlkDo0IaCrQYJ3P+tq+AapA=': 21865,
    '4+dPqdTRQOBO6YgW4pbdoUkvuUgKqR1m76NzXQhxDmY=': 24378,
    'NXNWMr6FXc7wxoUOMpS3J1k1ujwbFqhIqvswdYqSYf8=': 19277,
    'LS7G6d/p8l9Jtdp4gYyP53wb8juriYVviAMzOiBcoyg=': 10815,
    'FujLzPmCJZMy9n2qXthasqLqAwhXDbtw9RpRjig+5qA=': 12596,
    'vZ+WU/AN5OZwvKI3znxOiKrxt4r9+wDzJQrd1uh0xi8=': 25723,
    'OZ7ylyxqWP/P5x0l7NRYUNlRFy/DBLCZ2y5lGAL/Mbo=': 56668,
    'X720mi8hSYCCCjFyYk4QTnLoSv4Dx5KxO0PL+v4le70=': 21157,
    'iSPwRpNlXXtYy2ixV8Zt3ttiNqfb0ckBkaEbIwif7fg=': 168272,
    'FmhbbZAIG2HHMIvopS0AQfogLmG+4aZ6E8GmiR7HkQs=': 1683,
    'uVV4tZMhcFGN/5DNGoM2pq0sriV76Dlw7IWa93/528c=': 25899,
    'AlNnYZ8FTrf6NDGnDns8KpFRey/86p+S5J3N22e1Ju0=': 58454,
    'DGXVMctSS3gJOWJ9mGMFpbXEP9gYbzsiSk5vy2++/MU=': 6991,
    'PF9P7PfOvAOtCeJzPNqwwBTUZzZJRnR8ptSZ5jk/pe4=': 277779,
    'jDJBIEeBGfPViBRD7uDAKRWQYFRAz9cSbOie9GId1qk=': 50748,
    'hAP5IeX+ClV6YcGIplQ0dDiLUPhv8wfCzxfnBTtWFB8=': 16638,
    'KkxCw6aqh+DCxmaQ0kkHYGYOKJ4NV9coH6XXlXw2bbs=': 77735,
    'cSbT1aXWtoK2zxRkA5OoaXSpHER95msBKsjhiKxMBSQ=': 26373,
    '9ozuUcGwFZFgVgkEDjZ5YWVWrHYQ6EffzaT3WBESh6g=': 90144,
    'GM5ybscWFuSOUsoaG3fEyLwUuorEDjSrLjqouPisIxE=': 18575,
    'dAnZjUnZIUwAa1oR111USvr2rStEOzuWnO3MeaRB3vo=': 28588,
    'V1TY6TSN3QddphJ/jmX1g9KIzWPvx7tJb3WaFWfra0s=': 70911,
    '+0I2xFQ5nu4Q6Ohv8gbdR8Yygd/hDcUYcGs1EGEMEoU=': 23452,
    'zyn04IZ2Umv2Lp7IBzMbodZH96POekmEkiDEq8MpG4Q=': 14212,
    'MxFaw/mIEjT+f3i7JOQs+6h0hq2WQJ6hK41gnlqnWPk=': 62310,
    'tSRaboiStChwYHTOMVVyQG8dK4yecR2WNrU9zVJ7ue8=': 100570,
    '0dW+kpqTQyZ5bFv8Cj6kmaQPdBt665dnS06HeAf/aok=': 32810,
    'q1VBn210XhsIxYbgQGGp2uLFsRiXs0pf9W/pTGhnPA0=': 35759,
    'WxuY4cZg0kTa/wNj4l10n0oAEb12VGt+HvqCt3UdwuU=': 101510,
    '8t5uMQzzOFIfJ0D5j4enqTR8S380ZlNIhNbig1KKFx4=': 36113,
    'j15AyXg4QNvT6R9kNQm7GuvjorvuruASp2jsVLFhXVo=': 15759,
    '/gPYRandJfzmLoifxI3ReNjxgy7EV9ECWtn5eFQ5HnE=': 3684,
    '8B+hMWXbNX5kJ2b8tKR2i2WpWnkvFCPMY/AQj7I8UG0=': 9826,
    'ZLNXkFUxbHt0k4B8+Ja9ZnMFMHO/fjqiQTAcvJYLo/Q=': 8194,
    'rU3WNe6M5IB9YPm30xKPU733o+4r/9GbbXFyP8GcMnE=': 45502,
    '5S9cqa0tc9jeaqjbZA1szq0VAOplgwuqPjLOJTa78I0=': 16957,
    'R//uQaYZJux40YXu1S0ugpXARj882FCYukSSoaMY9Pk=': 105677,
    'MYlJ6Hhq3EBGUODjbzwq/HM83420fMamebxNoUhJjps=': 40967,
    'd0oN5+HnahktsS2t/elM/WhzMmvAnTLEGlM633z3088=': 220252,
    'uf9bGqELw9O1isvKu6UcXo4DO6NK11ZEwrgFe7OkTNk=': 146265,
    'pKdc4dQP4vXyH54pD0FIuplu0r20zaUO4WmNimQT8Ew=': 118550,
    'cODPqAZDwre9k6RwbkabQItJEQMAyJwELj+r1Or6W8g=': 32182,
    'vOUowbPKc6GOQOKC+w0bqdr6WH/h9dNx9LGdV3ApzRE=': 15440,
    'M+H3x8GOP2fqmq2Rjb5nDr9cE1M8fOQhp6pn/qg+9LI=': 114459,
    'c/Ot7kZQLO+48rBeeUWabc48nES88/wXkRjiQPLBBmQ=': 39722,
    '7IexYR0ESeqUMuAwKWYW3SZddMkdM7rzFWi/+SY5oBM=': 88668,
    'FMJkO4GWOy+jrBWV2RsiSHoIpi+WwhTfXYCrcJMx1Cg=': 20411,
    'YDTmsYjnVohHui0VGyk9LDTQxgdu4PXtbktYAGkO8lo=': 6189,
    '4vMvQ5U367UgO54wwNkYfj5EUPsmsFUTBNngZsuqrfI=': 181851,
    'JnxjuQRM0U97W0VcvHnzs446tUVhtrApx0ELPutoVJA=': 122053,
    'Hf2JHR6veBbkktCGxaVkuKXBiFVvGzWIT+/veR6a5pU=': 145887,
    'YjKNreO4T52MdFOYGNJPUGytlpO2PiADn3X/+v6R+aY=': 8129,
    '5QJBeS713oFOp9/eS5ecnKca/R7ZEH8hWFEHFmvQTSg=': 32025,
    'EJ1fMNtdUioRUI2SLnLGqjN/au992Yf+yNDilGxf7tY=': 13754,
    'bK/3tcG1R9/b8abWsG3me8q8sOW8TbIqEtJ7GXd4p6A=': 46419,
    'E9F8btB6fg3TITvtOQp/z08FY1Wec4I9/ftENJ86YGo=': 41201,
    'NCUefbmnnHw/HPmOjwynMM7FI+Vg4SfbdVbp4ggM8P4=': 101406,
    'ysjLbEq9bENSzeqHGNIJMVt4lKxT8+9Ep7lmhq0Syhk=': 34952,
    'EDQGWjmHrHj1RsTpAmj4mSiH1aAMqLjQhKlblJ20eU8=': 82119,
    'ISHB3w/P43rM7J47dkvCNz/w3Gufo27R2F2J2Ss1Q+s=': 92510,
    '5jywHoPb/SXzjAm4EFzZMu6xRvRWn0kRgRnk94avCaA=': 10258,
    'vi+2fEJRgT98fdMhbvkyAHSjHTLRHu94mx3Pb6PGQf0=': 29552,
    'u1Hr5U8k56/h8pRcp/4pmRMikPKTOXREcMo/yC04PiI=': 47558,
    'xiagqJFgGw/JJh59xPJeS8D85S56yWsWo17P4xA9ALQ=': 56881,
    '+GVyS6Ls/0raI+qLhYtW0OnM26UYu55U2L4aoq0fpX0=': 215674,
    'tpIFiacYYLNv9FJemEvsEpm8FnfmJG8GA7GmXLn7wso=': 13947,
    'l1vDbW8XXLFWF4RawAWwHAs4tk/XyWO6ZzpL/h8A+R4=': 91020,
    'ZI0amZnAiG/P+mZCMnnBBNOuaVZ0kPjr1k+cDFhzyuQ=': 281034,
    '5F6REhxEgoQaYCzaVhu6XyZFM/XRKXJ3owvqyuHdF2g=': 34544,
    'f/BalUVDZBBuW18sdqfOdrTdotke6zxCeE6yzDCJG/o=': 52149,
    'QiTdVDw7j8ZFqxLmthPb9YlaHod2kcT7j2L1iE2fP0g=': 18046,
    'CJTlpjFqSPtwplia4sZH1gb4A/M0I8GngKW89Q30XbE=': 18783,
    'wwzy4svzTujweU4gpCx+P87f1E183BxMfS20DopuVqc=': 25733,
    '3Q7khbMluXXd/TbhhapCJYs4ZCCM/injnzfmqqDSK8M=': 31800,
    'Lwt5XFC8rKKaIaYh3W5KlP3OP79MrQ+ZZz7kaIl1qH0=': 15552,
    'KUj/SlA7Z/JW/E5Rj7iT/KgrOKzbUpqJebj8Q+O92LQ=': 63270,
    '4LTLkI9l93BY4ZfEfoxigB4eCu+SONg7W2XrOajs5YM=': 159854,
    'jZJwjbCJUC6uEGHkyhYG8lzh+4VBNKA33qL3d09C8J8=': 21343,
    'kKqtKHYDUToZ3+th8JEpTXUksPIQTMUD37tyQFy3+EI=': 18739,
    'us0jXvJjP6RQNj3R8DX41ILUL6noEp0REgK2lpx4sB8=': 91310,
    'HLE6uJk2JpcCvRs0Fz84HRfOr3/rjQoMqtSAWnhqhw8=': 70456,
    '3DKyGd6JcHJTknRJi3pxkBORFPEjE/qmAQnIG4xSokw=': 29627,
    'h0MW9zphRWTkvUuazLpEMZbogvsmCgUfEQ7kf2I0O0M=': 83654,
    'QgJKXiUlU4h64r4ihFfG2Fug+ApPlGYgsPNA/HrvLU4=': 7972,
    'K0JtW9DlJYUAp+e7Q7OvYh4nhF+cE2dxMxX1snSGGL8=': 147492,
    '8mKv4O/1DXgUskPmcD6TpObhITbAxdcActbArhDRmgg=': 74955,
    'IqPOpmog8a8cMlH0Kz5UFBMNqEiI1df3np2Ue7KM+ow=': 157461,
    '3u5kfsjQEnehwNmES68QwApDqrUDG++QCzpW+lQNG/w=': 9688,
    'VGO98eie+iBZZTH0AhzakoQ02q7CzEBc9q3uFhobqaw=': 21448,
    'RkCGeGfOkqRNcJHH1Buxaionhai/2k4pq6TD5EWSsxQ=': 29915,
    'wbRjnoGbietnHbk7eTE7o4zGX620GEfBDTTFPwGQh9I=': 36653,
    '9/TBvtQjXHvH3uR2v3RJ+aSqDKzYqBqnCO7EkDP3ibE=': 85084,
    'hJRL3Zx5XL7s4Pb9/c+bSMqgqfiFcsD5Q4OToLwmsBo=': 15918,
    'KApEaBcnuFKO6X7HzAL9N8TPmfBw3Yvs0XCskK6K7Ms=': 23493,
    'qrbN+Q1QhYW4pgMVjBlt7ow8szvnGozBwErKy6ZiMis=': 55388
};
Class.register(TestBlockchain);
