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

        return transactions;
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
        users.push(TestBlockchain.generateUser(
          keys,
          address
        ));

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
    '9HfVAloj7hHhn0Z/U+PfPHqCx30QoTM3K9aTcpiOqAs=': 59572,
    'oYeO4iOzsgv6GtT+oBknGEniM08qeA/USWfv64PSe58=': 35920,
    'h1kdpx1Kj0qdm9HYpXZ+Ki9oabJ51KTdWid4ICDqBrQ=': 21683,
    'pLAbeaLGRF+UxY93pQJHLa1liywJclKK2QB1yj7jIGA=': 203242,
    'ywSg0pmYxJ5kpKSjm4/T19vSOS8ZsFEYMvQ/ESC4WVg=': 6985,
    'N6dHc4hIaUmUCXCajaOSRS+Oqkl+pVGC0HehidPWsMo=': 27552,
    'gS8jvz7/iWxEQH0MPmZMEs2A4Bk1wYsyYLiCKDgH6Qs=': 4613,
    '1Pu3i0jjBBFIXM6jyKrQjmC1n+lZyAzibjK3kqnTUBM=': 184481,
    'ncDtNldpMf/wlNZ4ov52Ttf+o05EhE0KjV6q/i4k3l0=': 95935,
    'kAHNQwkLlmZasDNsz7WNy+NV+JK8D0tiItzr+Fc2BZM=': 23433,
    'dzY86xgDVm7BfIdmyxPe+cg6Pzasc3F3rdA4Qn5BKsI=': 4297,
    'VnTZvZ/EAwcxLgLlOEK/cb+fnmVPU992c9qoE+aWK6M=': 31964,
    'o4Xk6qQh9g6aCkY0oh9AzAftjnQwaFkZpMnrs48qX5w=': 4144,
    'pvSgnmMnuTo6OL+1qfWfhBaBwR9AjfE5vqJiKeakQ5c=': 228462,
    '/kcU5PIxuN48TDs2q1JLBxqI/qcK+5WFIN8a0UwJ9vU=': 170,
    'MI/05gJtnVl/oGcB7mSlL3pz2ymANbf5fYBOSSlodbg=': 16211,
    'vnypgS8pfIc8YSC4/ISzmiR7pV07DIN5SdbmCYr1+UI=': 15069,
    'OkoiT4Ba0Pksp0IdGiWCgNYclvlg994Yc+PXqSzb26A=': 3876,
    '2VINmiGwulAYFjeb5xWTeTfEk35mhB7nDapFadk7Ofw=': 77802,
    'aM65ylCoM/MxfmT4/iw7O7KB0hL1ZIrR244agoQOOsI=': 15816,
    'gqiPNps81SyyctII+xl7X9k8m8O5gT93IkpIe/ZymHE=': 1224,
    'oMRo+uZ5CSHK5OqcLqMcBF514NvNna0UEkL90MqkFXE=': 11087,
    'BqCt/w4Jh6DA0xiJIK0hUrcNdf5m/4R3iY/1eSnXOUU=': 94096,
    '/6En0YOhK+ilFoPxIiNvt7fgp99yJfZHV2fdwoKATBU=': 50822,
    'K0gz7fmwa/cw4kp0yraE8pJlWNyYswIII9na2WQgN8M=': 54927,
    'PGoNQSefogkkbqJtmUBFkF2PL9TP+9iDyv03rRBmYKk=': 7546,
    '5QuP2548f3Owb2a0UkZ+VFnLe/TEPRCHQJ7OhNz62Eo=': 26715,
    'yuaKCkwcY7htJRG0yNyGseXREEgutNwWHOEXGI/rLuE=': 39567,
    'NvIojY6JmIDhQRo53Y+FKpHjqzCl1lYzTgX6VbaDTo0=': 45855,
    'VeBteMrEVx8u02FP4TlEcsCyXzZ8qqZDiEVPs+BKG7o=': 3296,
    'BsVP9jKz4RwJs9+T9P4w4Wel0ev1ABQgRyb5PpFqwYQ=': 1597,
    'od8F61JwoyZkTnND5KlFTdW9c7YDM56VLbXiJIEJmeY=': 184789,
    'DBIWxmFtlpTUWaoiby1YTzmahzXNp4RQhHhdHwo5bws=': 70008,
    '9yqpiUTQpNX6ND8zDDmkDK9wBQHp4UiuBuBqjm5MyYY=': 122791,
    'fOdXtD6tBoPRxPI0Qj1uIF1q6tuzItw5wtxxP9KJL3g=': 91290,
    'm2CMJLfL7itOQgsSUHXz5a5GQgDtqSWz6UDMIFZAc/8=': 49833,
    'cVj8UOvWW5gILhVEYdG24x6idL8oem7I55l8odMe6Iw=': 76283,
    '5RgJE1zrtfQrH8XYuT5nqd/CTorDxsq5mpowWUtTmM4=': 72823,
    '2/GyP74seZaECbIaS5b1TMi4B7MktYDcFHlvwBDbl4M=': 39705,
    'IFmInveGbZu1c7lTuIVIogxwTqzzstBotYr+7LpN1wY=': 56337,
    'DgD+SUDHLDTLVzFiro4SpOoPEa44mwLncHZLQO4WDOI=': 16490,
    'fbonN1m1SjpSM+s2vf27iA3NaZfqDcHxzpLknfZe3ww=': 32071,
    'P4aBhKK9dF7w3nEEYh0DmpXJY/E43JXr48MDSbQkD/4=': 11155,
    'ppFoNV8jvS+odWu0f5wXobRLnajToRjPf4M8LQ8HNsM=': 88690,
    '3frFtLybvqdIOIvLy8p1xN0PJ6buraW0uigSXddyePo=': 21380,
    '6HATvEh+TVVD2Tkr7bF/5dVvswzwR3YgZ6oJ2TdtO4M=': 7421,
    '42g9BLi4uuSICAWGXyjeUrgYqhrgR+bJ7aKmR/2bgSE=': 127709,
    'tSeubuN2NJlL5XiCXULhIol+HgVqQRxUe5K7/9oZ16c=': 40666,
    'xz+rul6AxgzE09fRCT/L2s+Vqw7sS9Nys3rikepZXu0=': 1191,
    'uR8tE6qLeE0A3gb1j7LQhF2YRjWmX2aF3dvPi6YHM5A=': 33259,
    'z1IV8/J12obWfpjOgBSQ3AMRuo/oyAiugsUvyENtn6M=': 56475,
    'C0ydV2N/K4BugGpFGOtJ2obKHqZ2/FD4ly48/E8E8Bc=': 75136,
    'ezMBdcjR8SHmXuU5CNZENCdJxzRAhWKXB96onkPviG8=': 41677,
    '6OGBrEWtog08ab/VqK800tqMDq/4wiDszNCVbWrHBY8=': 23784,
    '1r/pZ4VFrtA1otaAByQiOIlv5Uyv/5oLii4G6LIlM54=': 66973,
    'COVgCSprx8l4xtI1w8A255if4BMgESpwV3FeHi7Iq08=': 72487,
    'X1wYhpdECbJG+Uh55Q2by9sy9DwAm3smi6yILOR3oC8=': 2769,
    'aVKY5ANjsmIUXxEk/cKJaAIWdA3IsAb6BYLS5BwHq/Y=': 5885,
    'gNVhBXaQqUZKUEWuv1OVkpK0vxAtM978pLEp0RJ2L6w=': 99659,
    'ELsHaiRkECOtoOsLcib0y7UDhtq5L7a2R9kGfi9fEjs=': 141832,
    'iSXY/w7R2g755fslD1xlKEt31zTUNHxBN96tUPo8jio=': 52640,
    'vH4RNe3FlyMCHJIAID00tLinxGnEKWt4PpspzApNkk0=': 107690,
    'DZ6ltzXs/Vr20vIpUR2gaBZg4Yx333o2z8P5aTZ9T3k=': 4712,
    'f0a0CkEHFHMBUVYb4bnPX/U6Wh7EctjPQ4SB+zd4IXQ=': 51026,
    'kCN971NGq42IF4n4SsEQgyY/IbWty/VDCPXr3j3qHf0=': 26656,
    '7hAcKQulRXsaHuaeBK7/iAmVxciVrz5g0lB1p0BBX24=': 51096,
    'u+oHq2gWnnlzyONOzNLP5fB+tNu7Uymm/IRcX85xH3Q=': 7824,
    'Av3Hxv297zKn3dY5IJyHqDpzulSXYHKoaYIzXHsKhxM=': 37633,
    'HhCUspH5w4d7lZAP7/ecZGBS5oewtukh7nJmYm6Y9es=': 11339,
    'nX5NwriaGqVFgxMoYhLnO1SBC9Lq1pIC3lhTI8dvnGI=': 1859,
    '5m9gXsxW90jl9CasC6sZJjQ2vkQVPHoOMWlyWIlW8to=': 38748,
    'tOOLgeH54jcb9xjbgSkDDSr6EglNgmmqBkwfrGoeV28=': 65761,
    'QJhBY+vBKKCHgt/tmPfttKNU+6SN4bfF6aHhzhxP0/I=': 161723,
    '5dKCXQV3FuLDN37aIaNIabQp4TWcEA0+Fl1FeNG1l0E=': 2095,
    'x6JgEih6wSohJMpfIfy3uu0DkamIn2d5pHvFtm7bABo=': 1143,
    'gO1KXCuhneVfxyQIzorz/bO4Zl4++zrRsFRgn+xzBic=': 193619,
    'PZA4Ylvl3fbyANow/4SOs4LXrhK5iHEIXNYACCdTwQQ=': 107039,
    'MfVXT5bxpaNrFhNRXylld7+wjUBWIIqGB0bO5WLARus=': 32096,
    'uPYJbKCG7TXS4mFQymD0W20wydQo0VtPFmJSA2zSzFg=': 78,
    '6V4KuYjLEU+WeijiuEXq2MIuuUpS58CB/u6wSXvMeo0=': 45757,
    '2MRQP7vgtoaBen+3nBoiobaWhOrgVwrrd8bA7fvdKGE=': 78242,
    'dKKmBeV0k6K3a8g6X6ZJEmZDVNUPm5JNSyTlO8aB/qw=': 194123,
    'aOyx52qpwXR6gd3fPCIUQVBpLGXeUi1eh9rZeqSPCqQ=': 95529,
    'j64NKriugV628LIi/GboYp0gU6JG4I2YXMXppYL6RiI=': 45858,
    'r65mODiOFZ5ssxYVQAV4uNH70zh2g+VhHpAlND0QIYM=': 33903,
    'A+Sj64p/R0jOey2ajhllva9CzmuLUmfWM8q4UvpJptc=': 40116,
    'f+qfBJ58Q3mPL/op4ykTb4vLXxOpFcAhiKjekjxbgA0=': 13865,
    'uVPIneGcbHgwyuqwuz6fInmYan/mjDePGtQ9Tqs+gN8=': 2008,
    'iXJXi5QoQSMdiA7upYI1Uf4gxS5I7QVvhBK7RFsBwWM=': 41906,
    'dmZS6qR7MWgoDGir/2esUixWNLCa3n9hrWaUF0iS4A0=': 3145,
    'HBNDYgrpmQCTUjJIPwPGLdwzp96kLS88vIZt/z6R6Tk=': 74635,
    'L9yKeJTz35kL6BGMDbJgcCBQN/lXKvJbqhbOakuHSHU=': 11459,
    'z36NI7unJu+w4dopYeJT/60dBns9wzy2sSTnfCgO62M=': 313643,
    'L8LONLkZEfW7fuGYi177nPVF065hxpMJVHGJ2dIXqCU=': 65922,
    '1xt9NMUpD7IyI8GUWu0IgkkK7v87DPQ2ikqVwHeGstQ=': 42438,
    'd2SZCOi295601luo2jZwtb6r3ugIK7rzJL/f1HQ3J/U=': 36138,
    'N42gkRDQhV9jQbcKwfS2ewdJ7cFnpvv1HPzsgG4uX2w=': 202932,
    '3YTTePgxm4m1xzwtLiiGj/H8Q/51M0BZGARNqibs36M=': 129755,
    'InmK+TT646EGyShEj9CXsI0BSHpj+Hm160N0yrfD0+k=': 42029,
    '4wk9n/NlLPNEGH11GGHCdnGjO8Sqw8wxrnJjkpcH+Tw=': 38588,
    'pgKb+Mdu2346b3I8ll0kQw2EGrjv5rvU8UASWh2ERY4=': 74745,
    'JNnhgxyj/fM0FXktlN9Ag/EFs4hgSVqYr3nWEF81Es4=': 2912,
    '3upRbXsr79kqk38Zj4yvEulSjl9Fo2THqc+SZn1603c=': 32667,
    'wkV8f+I6aUQTWTloPMWB9p2cu9Y+KciV9LPtihBhEkQ=': 78396,
    'Rnvx/dQmyaOVSHwKlac/nJYerdNp1ZZNVBL7qS2bo04=': 5448,
    'lXKHZznqSYu8oZ2szAt+bkRN2FX9KHB8f5m3TAmnmfI=': 42959,
    'yeuxECEpcPZDFZyt923Mj3ySF25kdzyNk/MiFI3gaGA=': 2432,
    'CO+9+CR9W32e8Vhjp7hoC9bIBL8RB5TzdLzEA7DCz58=': 29463,
    'e9/Ccn+OuKVKzn8JbJV3Lu9w5No5o3tUQxFv2ffXMVw=': 135780,
    '2GMScrnF+nc3CpbKXZHSmAZ7/i7Mxq0sivUl2Eky2jk=': 26875,
    '+0aK0gpGmiCr9bcStHx3000jepNOnMqxcS6EWWBvp14=': 13041,
    'PwOW3QCp4XGcYEJqcAVTyhAPtZhOUI+2bOnde4bjQSU=': 7266,
    'GtxmZBbRzUpvGYgMNrsrGQGE5wC6HPanfUlw88l8ts8=': 76241,
    '+60u4R7iUqXLOO9MIvJMjwQEnBsaQSWnmD1/J++z1ic=': 56653,
    'JUhcvDOsxPg4ritGzmVgsDo7Y0A4GCcDls71RsM3rMY=': 22028,
    'NkY1UqNR1RsAaYBx+La1jir8H5RFMGYx3u8Dq2QN3fw=': 6763,
    'i2Z1xOfQ1foMcDbzTn4ktpqFebfTa/GtOGUi2jgELe0=': 200242,
    'v7/vXNLZ+w/29AdjO2eBeRo9esOTCj5kOc6wcsF1mak=': 26209,
    'CWET8ov9yvpG+F8a3Z/HFl2msLhpX+9iOxeJ2otP5/8=': 24447,
    'sXz4NZGuGa3ADIQZ9CXOspLcpDsAMFZ6H5BVN8t5/Vs=': 8422,
    'PdzMHdS2Zx+OAQKr+IeIKxYWufY1smYiwssAwTDIRDM=': 11211,
    'wabblZxPXn1mNDuQE6N3xedoiKf9+jlIkH0ZIs/GwhU=': 73970,
    'XqAe6VEHqb5r4TTWt5NScJ/Xeod1+tXrHmX7mvfYbZc=': 16599,
    'cA7C5lK7QTFi3ozLMZdPXuQOL/anGZqA2J+MQnCXFtE=': 6532,
    '8i6LMoi2zcm6tF+0DvvjI6sQOyoNVfOxcFM0RBK4/lI=': 46231,
    '+UYeKwKeu5bi0a5a4bKOJAReyuf6IhLUgifes9DLAAw=': 52963,
    'L6ChzMmUKKXO7sXt4McmOLuyMfVvYulM1ntguWvFo5k=': 125009,
    'RoBhqbkFSZYoEcauVt4uzaPuFMom8WrULF+jPteNiQs=': 25996,
    'zYoCWsYLbnfKHZ/HPBcFsaGHYfU2S6ebGiwDDRSVpMU=': 87721,
    'PIW30VFJZSoe+4OImFrqSWCIDySylGpsQciC7fDGUmo=': 21324,
    'qhjb2Cl5ZpkfnljvxI64LIeE5ip3ge8khILRKVrAnkc=': 70721,
    'fXN8vKjMUOQ6aNsMSe7gZFL/eszc8FZ9gUjqZRKWuCk=': 75850,
    'rwrZSUn/QLyW8w1pJfRa7zOHM54iTB75RNvRPIy70GI=': 237028,
    'pxWCGrlnl5IP53gErjR6EWxpaojdDc/n6EcQivM6c3M=': 6942,
    '8DZeWSN2K6qXJqHfEVurHtnvako5GsZVNKZV6e7m5hc=': 106508,
    '0RUPoZP4yAAaKqvbFBbJOwy8vQRDAAQf+nkwLMBOqTU=': 262391,
    'wsX1wJn8V3HfHsRCdcQX4pUCosSH0a6d/TfkJnqrnUA=': 61557,
    'Im7M184iVJElih1Jhgitnt3CPpKXFjLRbXqvwRvGV40=': 65603,
    'wv7qGVP3r7nbvk7k8hfVYW05DqVq5auXH4c/UPJS3rA=': 67022,
    'aMaLcYV3IsPvJ+l0G8F/AG03HMRIfPnYC0HN8x6VAb0=': 111754,
    'XpNsrWgG9OcMTOV2CCNXGqiyFhjvMtgy0JcPJXi9wpY=': 15958,
    '+7h3gTdpeuoW9+myiOVplNc+bmbCwiL4Mkd5xJl60Dc=': 47441,
    'HATd56etOqNnqvqOHOeqLDiTzMUsyAsHC5yFLibaAdE=': 15368,
    'HslJZrtR8P9NHDragCEwhLTOsH3vUxnF1Njl+mz9W1Y=': 17097,
    'S8dyrFJnKoLVVhG3l3TvpxUWjq0ChRDcSue18SdVpRI=': 67145,
    'NrCyy2vS6iFXLFcUC0dL0N6xuvRtiEdG3GkJmnuQ+bY=': 134195,
    'qWjupTANuWCfW4Q+FQ74TUWmBvXAzscIjC2hlTL15rY=': 44794,
    'i76raxaNUW1m8jL0NlUst757JbwUPHvYY0ZiKr6lUQA=': 19140,
    'CbcZBwkdvUEOCT6hrdrXvmIIiWgDmXhBD5cUFe5Vvac=': 19753,
    'muBjWaePiGtDV+mq0Yt3js/OojEqcrueE6VSut84xwo=': 3794,
    'DaKhF7zPqrbfLPSYKE/HKjm76KvHDnPFV5LEclJYNaI=': 1821,
    'cl/Xc574k0sljJMGIBsspr/YM3SMGWehuBDiIALtqIU=': 14023,
    'uWIkZusrDUPF2XwimOVFo+jy9cIqtenL1Jjh+pgijck=': 741,
    'KKeXtGOEaFCQCbFFE/M2aLK+PgEFmFIwXvcSuIzx6jM=': 69481,
    'AFsY0fsd/RSyN4EitnwhU+tgbJ390T6fsyJlLZcz0YE=': 57138,
    'kwbsmRGdgQUHEhXJCEtmSs6Nc/3W08ZQwZxOpT0TFqQ=': 83596,
    'M1pJTSf7wq4ocmHwD39yCcFf3pF70pIvfd6RiqS8qTI=': 4765,
    'oMgNrnqdHNfEC9wffwVBIQTyKVlphORCiyPXDHq2eRo=': 11215,
    'U81F0OuM/NoQw+r0lJH3AUHlv0Ds36RusbOPlz4luYU=': 81713,
    'o1fmh7ZbgZAikdQwGlVslgwHh7MFcoVnJmNAG9+O0kE=': 4758,
    'm4l3k4wWk7rRG49M77ns6gtsszWdR0zpRBo6SyQ9R+w=': 4416,
    '2YXtb9YJGs2FX/FjhmLbVj36JrRlzmbeD+yjkAyUAis=': 56089,
    '9ujPN7c4CjpwoTo4gTTgVx6lE9Ykedhlaa2rvAR9Fj0=': 1161,
    'AE6uJrdyoZImdsGitiav6FlXJAI0VD0gDvV7KuK0SwQ=': 28619,
    'Lzh24CpJ5jVMIsqThB/UeS+oxn6ii9/4Z9S0IypyCYI=': 226,
    '1A67besemoMWQmI5nlOTNL20jnhgJFOXUsXr/GiK9P4=': 137786,
    'uPEmWB2sUURT9WM3U4nNjRkYLIS//tM5oqy+M3/3GVI=': 42941,
    '38JUyDJ8Tg1KUJ6GHtPvfydNTJ1jt/eUi45KZ+Vtg2A=': 145973,
    'wgeGrgFFAaRg0yP6jV+2Sr9p7ivRPSg+Hr9YrQh1k4s=': 14777,
    'rNzB7AHhbkg0jyYCXZmxviN1Lt8cuErdf8N8+pQhikY=': 16657,
    '8Ruxu/AYOHn+Qj0lZfHVfZnS8q5ncFOYr1vB8OJMYhI=': 29168,
    '2vdedG+/uVFCioU2ZSYeoJy2kBHdLmx4UYUVktwj6rg=': 4850,
    'cqMS4r9lOr7v4lGLDtYQD9Pp3YNkZwoC25/FJmBySGo=': 2374,
    '+yvhxi+UbOyw25QDXc0JiRhcJYDt1vpVXwXpAkyXrkE=': 6579,
    '5K72eBYq+u059K3fhRvxXBv9j7MccI1U6F1sRwwmFw8=': 49616,
    'XDhUVTek5LMhGyraOXguV64FBZefnY8ddXr0wG8HHP4=': 74506,
    'qj/P8rzdSG8rTCcdbElQ5dPOZ3E4wsXTBvfl8J2QY78=': 34806,
    'R6usBGWWSP6eOgf+pscX9rUQjbqsbWy96/agyetg+I4=': 55204,
    '1011KOIa/XhTOhzL8HJ9RN9Fvx3vsTcpO6sRJqoKjWY=': 42199,
    '3zK2rdKAJ8fRDfyZIAYDr7YG7o7TefPttjN7MDyfL9o=': 9687,
    'oposB+NJyTupPBQ0RiZMDvCy17t1+oefiwFi8pe8VPs=': 35287,
    'L4KX0ybPUtlTmE0EjuN3Lki3/ZpPANihCIk8o8MjnzE=': 115709,
    'cEFCXiT74TsiQr5yCV5k47CgcJSIQVVhW+exaLIuQqE=': 118874,
    'AojSq2NtrDlLdC3JMIEdvwAG2IijB0mwYPytQxdOiCo=': 1028,
    'vmsOLhYE0UUP/Og5qaOoOMd+1nRumRyM45mduFZzfYE=': 19483,
    'bRlrYdJeKk522NrbBAEgM1vshZLIGBwLBnd0LtTEwWk=': 79866,
    'qrPg9ykiq6ZC9TzpHRESDaQ01yzi/qi3DWQHB8Krj1Q=': 41369,
    'WAXJaNPbvNmcW/3cicGLBRiGtKFto1jKnCqf0q5T82o=': 44124,
    'ckENZdtd9LeBbZxpcbZVFe5AVEernWszOBGi9eQ707g=': 232828,
    '4stKNGZsZbbaslVBqZpHQT08bbt6Nm77l/bjcOs0jCo=': 6115,
    '3ZRfz38m7/hgIFQxVK/hIi9HennmWX7xeKnFaa/cjew=': 131709,
    'WYtry/jvqwMX7AYQUgaZAJqW7mbJcveUGj7a5Gs6Ph0=': 54225,
    '2qFsObNHoGQldxyeaAwlOAAIY3Jqnf3bcfm+zMUDDWY=': 41870,
    'zt8L6Sabx+Bcz286N7Qjk4LYHqH2DQFwAFTnc9d31w8=': 66609,
    'wG7IBfye+ZrFp7np74g13/yEgVpJCNYJUMm2ObYaM48=': 324654,
    'GGO72TyF5s4FcHx39S4WlKQE5fQRZCaJQGS5+cEKTrA=': 7876,
    'OW5agMQG78ELBsoq6Dhr9IU2nbiLPOoVKxX6H9Y00Yg=': 67150,
    'YFGNr6HflCK7qMLRr6O5X2x24AmiGYlj+4OrhGputg8=': 52072,
    'ENJv/M6bDbDy2oXvnKPhol2k13USiXicfTNkKK5li70=': 9380,
    'Iz55zEd6ZI+bpyMufkSEwRWdNUYIlR7WTbbNh8q60e0=': 9434,
    'cKTDHn4kukqmet1mLbHpO1tCbDAn3syA5LldFYAzvxs=': 308664,
    'cW3WgT6LdLy27ElaLOGCtwOAxuOAe36Pvh1ORXhD/5M=': 24267,
    'HNnz/fXwL0CbuNDhwkwxgjBC12OUdq7rvYMzv5hwXTc=': 16857,
    'y89lsTFCRMZsnrF3Zc3/I0U7eL7qyJk0zqTArbQQonc=': 12771,
    'xbh8fjyH37GyOBgJUC0X32cQNuvnO622vnJDtoxD794=': 41815,
    'uJ5DdedQ+A1wu71Q1Shj5JuDGx1dPPU4HMMYo3EJ1HI=': 23047,
    '+L13YlUrHbqU9FYPKUJ6OqhYOJbWSgYN0nlxGwei89k=': 42750,
    'iM3AWdbo83fJqsDa49o1IFqmdteEGl8nDr5MaMggZjY=': 13114,
    'TwB9eXekysnD2TdrwkOiZBoD+EGuI/KUQ26Ls8SHG3k=': 76814,
    'kqf71LOij2+Uie4Vr7Rm8zvk488yJpdnfGKVInR8tAI=': 14896,
    'jkbJrfIMnGMHfGWuDMouLVfHr4EzbsZnMyiIDn0cjDM=': 99934,
    'v+8OHAeDJwgBIrXiqYHd5Cz2wZb2aRfSMPIK7PAbd/8=': 60381,
    'ibjPEfMmSwNPr6PKoQQcx+HBh8N1pyw3NqBiG/fgsRs=': 16283,
    'c2AwysqvtsA3awBtl1UqxBcxKInt2r8095tI+RBQ+ZI=': 74652,
    'jpzLIe/iEt1s+6CVU1pkY9BEXhpyymBdcdWfEeeo6Qw=': 235076,
    'ppdd9v86z/ovr4jMBRtJFHihAwYyLWRl61hKAChu/V0=': 55893,
    'QvN66IvEXxLkP/Xp973HydJ4Xdy7Wh87jEGrh7VGFDY=': 164858,
    'kJCI/+ylN/8Y1cdgUjz9AhdAQNLO4K76qUS3TSqqwbk=': 73740,
    'lhCbH3Vf76AtWr2OcPq/6FPEyQpIr2qD0Yiuahl1wJQ=': 131458,
    '5JCRe8bGr/SeOa4TX8uUZ3P864wLi70L92ItfGButkc=': 99557,
    'A+IHsF/d3agRJzPslh8uGXk6xzUsxrI4ONmLT2atd3I=': 15374,
    'IZwERP7vonX4U2sclh+FoW+jPK7nXChtnD3r0zJWn7Y=': 80489,
    'H85lxJG3Rmi1XW0lV0gNLORqwnpPZMDrLNuVAytN0Xc=': 241169,
    'zpK/YtrZNJs+Eyb3WcsxTT6bWdZFxZLsSl8i9rHPzVM=': 15289,
    'nNdH25RQoYtTmsYG3G6KbamUf+bYP5e9uwLbFKHO5Rw=': 91948,
    '4n9qi2ruABZ7gVON/itr4O4xvgq7+DieYty+XPZYPWs=': 177516,
    'mxV8wm2e7oQG6kBA65VDVaJkXKzwv3MVkANb2YevIrc=': 16474,
    'ZCmrUa7l0jzAO4r0fWO/roG6F63m7yL6y8EZAoN6Cyw=': 104908,
    'pRljj5vQnFHe1HvFXJi1xsFtCV+9BggGawvWO8dFce4=': 54580,
    '2aUHdwLRmQW+amvdxOpwG3y5q/4gHKRaVXY/mZCvXqY=': 220254,
    '4P9SbiqG67y8Qhdh8F3EPiNE0KT+oJIGZ6s56l9bXuU=': 34295,
    'CJnxM15AhBjZVveZmXWrjbEwtjDXSmXyPY5v0M+hKhw=': 55567,
    'TTKaYBZyLbPElU/zeBhKuX2c1awGjdF4lVXvkOOEOG4=': 3983,
    'c/GfINcNzBDtga2izz8TL6Cy21/3yl/FkirQ+opH5Fg=': 75186,
    'ZTqShFDwebt2hrliAOz+lhcuhZ+kIMhm7CAOd33FDm0=': 34188,
    'N6NxkpBBZuHs6xz+NVRtxZmikyllrp3TQSNKvqodu4A=': 5098,
    'kffbJOrWZRynRsRxteMerMnx9WITnXVUokBdGhK2pAk=': 146544,
    'hjcnNo52aQBwde7Gs45PsXLm3cuP7SF3uPY3wxX1VvM=': 94777,
    'sIPmTwd3EFy41LYqfnEHaZnB3FnrLgxjJtCAsgru8yg=': 150374
};
Class.register(TestBlockchain);
