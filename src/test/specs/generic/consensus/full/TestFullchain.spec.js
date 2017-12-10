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
    'ZmjI8a7NfJHbAak9VUDHcwDSVClueJdFbaG+kidNhyA=': 28600,
    'xP2+987hYvLwZGRC86IgtnKkSc5T8Gy/AXy/RF2Npec=': 63169,
    '/9EVeaQhmWRNAtfbHbnSit/q6o1Ty2wwzZWx325rx90=': 115798,
    '6rGPrLEYMAOXsa5q3kIJk1AdiHGRoB9BDIRW9dJBIs8=': 19265,
    '+AIXqOwnoV4pL7Wz+Wlrt9kG6GjemJ181wHtaxAfU5w=': 29356,
    'h2OWfR8cNxdrL0lXP8nJjgGwBUL9H5xeKEBve61sL9c=': 210777,
    '9ZcmU0KofewnFYL34eF66V4Ugp+pFusQtSh6hv1FPN8=': 171933,
    'IJmcyFncE4swPGTxoC7dMR2vfQ57dbsQNw2V4n/FwFk=': 17162,
    '5DdNVcRnBPAlviOFzu/QXo4P+Dj+Fqf3E6bpFdgdDIg=': 112686,
    '7wa6I8HKXpccUIm8tToW2BDELoDhno9nZO/3OjFCuAk=': 6937,
    'CZsCnBmsUnqyNMlnsT7LXS6RgshQ3VFQYjVfQSeklj8=': 39820,
    'OvVgkbXlyERq8ZfqXUhRKhOftcqrlOGh9C13OhfIJWA=': 107944,
    'Zg1/iz9bbD8c5WyUnOkZ5ANciadiwhyaMtx037idnt0=': 63458,
    '+GBvO2o8kITunynG/Miw/29uyebOURCHKzV1ThhCU2Q=': 68307,
    'YoIOLLD2jclHmq+9Ytqg5rd0fyBUAHSVCmpMLeqkH0w=': 27280,
    '8cXytXveGXv9NzTTr4g9AMP1rTvsfTp2QoJ30KYNzwA=': 283444,
    'W3HaXlrWlzx+XYhxyzhm0XVc3jQxg+N3yT8eezgmFHk=': 150151,
    'nlee6IlkK3OiHKVSDZXgh8DeVfhQ437+1QwJr/5cYgg=': 52612,
    'YC1eKPaPAEXY/Lj83a6eBnvkt2eLBfw8EXZjVOaKYHU=': 51603,
    'Sf4hhb67pBlfOrlSqd6aKz0NrpjybsHpuFBv5C4KCwI=': 162272,
    'vHS9MN6q7hchibYDVECgYAYsq1bXuNATlZorTvzbwT8=': 30762,
    'NL/m+0cVk9u8O6dD2tXlFI1zeAj5hgIP6KJgvjznLdE=': 1511,
    '3c13/Cb1mk23vNklKwXiH3spZsYNLCgAso1owR4WOz4=': 31037,
    '9G1pICjcsChiUWAC5VlUSYNlJfDEWJj4AFm6Zq/OFU8=': 187927,
    '2LGWKOH30ulvibcHx4TsMx2a7Wxamgzbbo0omdfmx9c=': 43145,
    'o8cxTgNCXC9/XfyFk3Pu6/jHiJaQa4ZjfmQk2QsE8mU=': 2020,
    'KcckBNc0RN+91sH7+chzV3GWFZUIda6hN8xzILSs71A=': 158963,
    'qNT59FKzpqNkHKjdpKEnoJ8aPoGT5xnFPfCFtIlW8kI=': 60062,
    'szUxkJFTj88AKsEq7EidgT4iHULWf6fr8ZzuY6db4EE=': 53310,
    '8yQfSVkWUnXLGu6+q2/VH0LfKwWtEdYKxpgnzkLbZno=': 149017,
    'yR8PofmtVG1Oq0M4fWoU6CA2ctlpFdGmKkaQpVXlu6Y=': 14365,
    'cQOaHfz4Pcz1Li+NjfqqRHHFapxAUOcpK8soXCJoQ9M=': 40074,
    's0PqQcOHNq4nPCxH9C8SOR4qb4xK2iAtiCDSJqt2rfw=': 112377,
    '2Ny4Lf4MBoi8z0HajUbQ9bE28oKa0o8yyXhsUb0rVik=': 23188,
    'Poc3MX55JsenlpQfPNLwQJ2AoG/PFlFAeOHCV4rtUgg=': 55002,
    'DGVdUZApAa4DHPdS0IM2UaYmvaPUGeQrDiZZlFrw+ZM=': 20732,
    'hRrbAARimP6eAtX5x7rsd0IPS1r/ifk9ry68d3ABMJU=': 45341,
    'guNSrtYEhy3FN4Ysv6RHCeKBZQdpQkzUmI2t2yfRXXQ=': 76503,
    'He9cVQJ3uCMMGsIz3ZT6mC2Pi3npa1W3v7z7uKXkPuQ=': 14443,
    '4+EN2MVQvTB9EueY6SX+SjzeHsBMhos9ijBQLtTMZq4=': 73119,
    'efoZgGiIPoydRY+wg5i3hzx3PeZnO5//NhxxzdwdgNI=': 195798,
    '9NcMvzz+Waz/j3Z9xFh5SDWfg0tIWbWpwOP2CrZ3/0M=': 72008,
    '/FexAJKPuxpXG4x5l3TGyfzqbsC0jNu+aYUt9dfYmPg=': 13935,
    '0/7LBn2OXlGAvRglkvqNTog9byGXNwrDySUfEcyQp94=': 246821,
    'UIHTFXKg03tqhwvjH9UCKSUNdwbOZKIlbJJu4vUN4x8=': 20701,
    'FWH3eYDdrOqAqMBm+hvKH59EMycjueWmvn8NlyVgv0w=': 104999,
    '7G8A0Kb/EXHekAxXajelComo7ZOVgGQNUv0RwcC5NZY=': 17160,
    'ZpSAsadQTZ0pIZStLemt2pTMcDVvC8Pt+GKjFZ2NLMM=': 51026,
    'tjJaueTUDnUd4S4CMJ+nL4EQBNlEviwA9niJ8ko10iU=': 3892,
    '0cuwhhinzURmawZNfrtpCrPqmBxT6VUpibEQjHFyoqE=': 19682,
    'ACoxcUa+XQdxlA2yEGDPqDWjnnNj9iR9URT/KqzTrAg=': 130037,
    'r8V2opyoVtlHUzjQRGLkJ6ctbxEg6Os+WMhCtgYwmvM=': 17517,
    'F9uBmr7ij8FU1Y5ZRBH45UbG9L+9nxxiG7RnhlRHSdY=': 56540,
    'TVUC959vuPxhF4k2mGD3qqICEZXT7EGH7LQXUx+FqAQ=': 23343,
    '+DWCT8k3Ge1bOMO/RpFKMxY3T3+ut9aKAMvh+fc81EQ=': 29547,
    'mdTkawNyO47suvt8yPUwQ38HdSNLb+3a0oFee8mAhD8=': 43275,
    'HNqJ4sH+KgtN57lIOQLeSCTyHm/SkNUSGQoBsrD81D8=': 48606,
    'rrFRCRnKOAPBjOsolDTlsQi8VYu3Scofw3GLiX/OCVA=': 71588,
    'gfxIoRt1bwbR+xzwZml11KW3KfQ7WGIgfWTzwiQNdfA=': 187838,
    'VLw9hbIeqFkWDqkpjZqVSXc/tjpBJUv3HRnAb4/1SLQ=': 71536,
    'TMOJV0w00D98LgS7Z+lim6G9MkFeuGGOZ0y3O4va+QA=': 11691,
    'NuW81U/hPM4isdoz3YM005P3OiY/VkrEVSs2dvZ1H+0=': 127845,
    'VVoeNBibO2KS8xbWjRIepQUPQq0blUaTvBEAJ9h2h7Y=': 3676,
    '7FSklKDU2o+lqGVPX2RYihQDkCJRcql+6mlD64/MJb8=': 2849,
    'X/X0VAEtyievSdi66iThXSMk25lpAC2F1ptKG56IM9I=': 35701,
    'Fcgq1ecAGEUC9HGcRDa/rgdPkHfWNwhLj3vcregXLdc=': 248215,
    'JB5Pj73TAqyVmNTInlbhW2YojfBFlOkGyIapyEG9zNk=': 33617,
    'cOEQQ9mBzc8Mi5ZEIdWNw/RYTDtQ7fbSrJkJtZppx0E=': 46015,
    'RqesOakFXLiQwuEEbrDfBkIyLNlyB2m7cTByDfDhF7g=': 28238,
    'bB3/Vc7TwqxuVXkZSvq2oT5ck2362inecO0IwOHoBb8=': 114724,
    '+DzoBOby8ZJiOMHpFX0cK4GafLH9F9HFIJP2bQG9qaI=': 46696,
    'moS36DEsFLLsjdz8RWQTs15Gz/2qs2EHwNpP/dBeTRg=': 10022,
    'P7A3Ce93RoMhAF2FnIqJN3WUpRFQLU6SkCzH9+/wuFw=': 74250,
    'e4QdlHMxr+pk3jF2nfKqCHSOgkfXBkgNWhZDHMv7xhU=': 6060,
    'U4wwezNaQQMxDTzFD2VYH8/MSMaUpAJHwk2ZB7zX+U0=': 56885,
    'b5agqD7vJVLhnWxBB/SkkhNn9AEkT0GE1FPlqnqZh2k=': 3049,
    'NcjvFzRuF1WUszT+aiPoHnfFn7mHQbqdI+p8+IPk558=': 24541,
    'jk4RiNnnS5ZXzHM9+3x57n9B8HItAAllVjeE5h3PSOI=': 195304,
    '8L6dud2DBvKRTvneGj7vY7AUfpkOTjbNs/3JJWPw8p8=': 143216
};
Class.register(TestBlockchain);
