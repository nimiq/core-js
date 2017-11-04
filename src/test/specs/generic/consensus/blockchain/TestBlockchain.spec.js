class TestBlockchain extends FullChain {
    static get MAX_NUM_TRANSACTIONS() {
        return Math.floor(              // round off
            (Policy.BLOCK_SIZE_MAX -    // block size limit
            150 -                       // header size
            20) /                       // miner address size
            165);                       // transaction size

    }

    constructor(store, accounts, users) {
        // XXX Set a large timeout when mining on demand.
        if (TestBlockchain.MINE_ON_DEMAND && jasmine && jasmine.DEFAULT_TIMEOUT_INTERVAL) {
            jasmine.DEFAULT_TIMEOUT_INTERVAL = 1200000;
        }

        const thisPromise = super(store, accounts);
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
            } else if (TestBlockchain.MINE_ON_DEMAND) {
                await TestBlockchain.mineBlock(block);
                TestBlockchain.NONCES[hash.toBase64()] = block.header.nonce;
            } else {
                throw new Error(`No nonce available for block ${hash}: ${block}`);
            }
        }

        return block;
    }

    static async createVolatileTest(numBlocks, numUsers = 2) {
        const accounts = await Accounts.createVolatile();
        const store = ChainDataStore.createVolatile();
        const users = await TestBlockchain.getUsers(numUsers);
        const testBlockchain = await new TestBlockchain(store, accounts, users);

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
        // genesis block will send the first miner reward to it
        const keys = KeyPair.unserialize(BufferUtils.fromBase64(('Lc7h0L4wncJ3DiNapeGlwURfpbGvyPbuBEpJemzzQW1ng6LQ+/C8AXXbc87dX/VNBrrgAGD1Rc+nXDM7QNFPggYlb56BE4czyOwmIFYPoMmiTRFmz4p/WKhl7hMSBo6N')));
        const address = await keys.publicKey.toAddress();
        users.push(TestBlockchain.generateUser(
          keys.privateKey,
          keys.publicKey,
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
        let bestHash = null;
        let bestTarget = Number.MAX_VALUE;
        let bestNonce = 0;

        const buffer = block.header.serialize();
        buffer.reset();

        block.header.nonce = 0;
        while (!(await block.header.verifyProofOfWork(buffer))) {
            const hash = block.header._pow;
            const target = Nimiq.BlockUtils.hashToTarget(hash);
            if (target < bestTarget) {
                bestHash = hash;
                bestTarget = target;
                bestNonce = block.header.nonce;
            }

            if (block.header.nonce % 5000 === 0) {
                console.log(`Mining ... ${block.header.nonce} - best ${bestHash.toHex()} (nonce=${bestNonce}, work=${Nimiq.BlockUtils.targetToDifficulty(bestTarget)})`);
            }

            block.header.nonce++;
            buffer.reset();
        }

        console.log(`Nonce found: ${block.header.nonce} - hash ${block.header._pow.toHex()}`);
        return block.header.nonce;
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
Class.register(TestBlockchain);
TestBlockchain.MINE_ON_DEMAND = false;

TestBlockchain.BLOCKS = {};
TestBlockchain.USERS = [
    'Lc7h0L4wncJ3DiNapeGlwURfpbGvyPbuBEpJemzzQW1ng6LQ+/C8AXXbc87dX/VNBrrgAGD1Rc+nXDM7QNFPggYlb56BE4czyOwmIFYPoMmiTRFmz4p/WKhl7hMSBo6N',
    'gkbcmD4S1O6CR+Fl8s1wjexIl531ezdZK6ZyUbmIMcUrM2VMyKkaSle8YWWgfeYdG8wdbxcmdjH+cHVFiQI+/WrnzrYqpUTdkIjIH0yoTdKOHBKVF+c0B4Q8oAA01n58',
    '4/UuDY2clw6JwmMSvRZa/jdAyPhA2Cm5UT1zEfBBaQQnaX3FuQ7lJAVWdEGksBKzyYbZGSjG+JEt4QsT4/6/D1MI8dtVOxXpFzZTYC8gg6Pj0cB+5nPXgm404p+pEkXj',
    'b79MXOk+rrVMd3iPhZWWUPX7i2AZAZLNEOWQdpduT9H/rZULadYQHPnJz26WXeDq0c8M9tbTHD5gGL/xqmH5WzIP7yOAmuQzI+7MRODtxlilWZ7FMR+LVrVoCOBx1vYE',
    '4bni5wQci6CuNo9JpFBI15Nyd5Pmz5lw23EEhoyrhkuVH8gjr9b7BSZr/Rr1wF3MJatDjKIw3+DKbRAacmuZaSJ8UCGQuiVjoUTaZhhRjCDAT0+aYbUd3zgSthrogOXB',
    'NwAUjB9UwK/tV0gi5OI6K56mJXo9dIajZTlPhVfVkU8zZv/2VsvfevDIJS3PG1c0A5kW3QSlgX3L/0biNo6mRxKQuvXPL0z9cipwdFfq+K9z7Ys4uQwk0vtETsqeZngM',
    '2tVhQWZG6xni1RdAa1ftZNSKtYIgasZR5Wa46Vemnp3aWwCyWFlYHgejf1Dl1gd5VL0AeI4cq9v4OjaoegQYJ3Oon5bZXvrQJlTBdJYK/QWFJ3qnVQjPsuNaFY6S8CXO',
    'c3BnabuRQEFLEMvGZ8q+4zT2wkUBLQhRtB54v9jq5/rUNBwSffi7t5to7TFSzY5lh6urE+MpFJ8KHhxfPI39vhBkEuyRuVRX37DeuZCppgTP19WgzNBOYu4qz/9HNjv5',
    'JwdcIzutHCbcg0bduY/gJuwY/G8dIFxPo3fxpDmdjO1+FUQChUgYOfvh7DKP4oUH+FH7Uib9qLKrFX6iEluL6Ucf3DwGwPQQBRaBQ29XEgyVSsVJw0oE42/c8YHIfwUG',
    'Irmd1xTM4BTQZo+SDDHUN76A6uWKzrd7anPrzA7dDGI1BUPsnP1Fdko/Zu0dDEWe0RcKEQrNChKeS4kyDUZ8Az6UGH58K17hPU+pSKKdBxWYVlRgssIQmP4NP8KfnVC8',
    'CaB+EaIXXk92QrhBaDsF47QJ8VejyQ9qlMkKLqLLFXIywsSfXTtMYBRzaP536aBjDMm5Dj6N3rNDPzcrxcN2+TQs3rliLP5saAstxe24y6tlcOYasbqrDBJEZIaJM3MT',
    'FHI3mmhws/kTKAIex/kCn6hqAc8Lr3rF1qK/ra7b8FZxh7D4r17tH/gTpTCmX0kj6nGqSJhTiIhsRmSmcexH7uyF09sDHmZ9S7+fudLBwpQrBODJGIjgJ1mvWZAcPcFg',
    'rKnzvhlZy9Hc/9MWrJcWWWq1ScVSBwDLzCLsX02ssrECQ/1ZeIPSARFQpkoQirDQdaDC3KU6D/xqCd463WHqx0dn8ljP/d7l+bn0kn/AY4nJm24MLX/8REH9N5rjWhh8',
    'FnaeS3Rr8PJ5WC/8Vv9szRSfPtf1OBIFYbRus8OaVuxrkwmXuaS4MNIwsck8wyGyCOTYN9Nz7Wr+yDH6QZ6h/uNLli0hvPG9DE4SpnIedJWlZOZ/OrExlhp94OsgxF12',
    '2cxTpq5NKd7fL4+98XI9FeaNrZRhjqRfNHiEh8UcLBhqxcV1+BT5mSw9Eg7moMhK3jNjTBVQJ6J3xug6EvDvfZocE1C0k2z8KkOh0rKt0Jpf1uqt8yoqSfMDNi97dzjm',
    'rGmRRzqWKzc70ksbCzA4//JEUb7T2/3hfk2O8iPciCdtALuTBcJRnsZfFdKM43jzvnrgtiRiTfXopVEYpkgBU0VF6axdO3VjYtS61dDfFwEYXaK7vwiDz8CTMoc79nyb',
    'zhWoH/1U6M4AVskJKCyrCRtc/2OrhLauAVn9sqx2aW8Xus6PFnXhvfjhQKI1z8IwLsfgWLd6I7O2eJ7wR8dJu0s+vKQ3NyKyLi5XmRSvtfq57wOBEN8LxlTAxcerImRA',
    'eo71ZOWnM4M8EnimLQdr9wTxI9McQpYPuERmm31+gvwnwPZ64JpbcwBlfZg00oyRRNMUMVN6uNpS1eFlU9+YfA2AKTESNnZ9j3lczV3n8o5BSnwBZxDFeCEHIaGbXLbp',
    'LtJtvwwU62HPcUQwkzFzewmmCtgRJntMtTImUzwZqckY7eJ1SKagsH6L55AvO3N0mBKXwTSHSieHhwGBcL1upqd9PHdiEeXEOlAe2CYxEuxDk9n8Pk208iP1RbCxJJ3n',
    'NdW83hR0qoLMtReEGlSStK3VESLuB+JRl+ZDWy5fyna5FFS59UnTgvS2FZva5IAwE5vI8HDD3TN1jZPGNycaonVMIgTEVj/5KBsPV1JVdFk5p2ty7w02O6HNMDyEs+YA',
    'u9vdmHP0D2KFHIVsxIyC8cgVH/O4TImXuoSFlO9ml2LNuY3y3gclwBXnbOW63QpjO1TUjBNF5U30tkEegHYFIbk93yYd4DxfQ2uI0Sqx5KEbCEq1AuNbFmtyCPD9wy/H',
    'Ns/Pvw53POUmr8qOnykBvfO17P5q0yGQ6pD2gZh0nPSAwF2Wh9laj9yTxvx9ILyz6swaLkYjnDTnnZ1sFRu4JbUc0cdtXtj7+fEamBWuXk6ACK8BvkXUCpaWLNoUTEAE',
    'fWQ7TMfC/O6o9UKkx41fHXsXsk/frjudAV81PKyRkS9rv+YHoGeDw4X/b7MLh1m5FExxGlZ/8vv7Wk6ijmWTUj/xg8xiLWE/p/NsGORVK6v1hyhyGHXAjxkz8iQHAJ6c',
    'Jll9EfXSNaKtTbILhDkYDaNZp70CCfDORKvIMBIFb+GU8eY2h1slq92W7EfQ4j/XefDmFZp2L7yMOmobhFpVgQwq00KwGUQwOPNRrhP0EP0HKgP+TibomxDmk8ceBFVZ',
    'q0FB7Y2u/L47crSMGWsnDnSzVI6hy5PP70bntTHAPA96wogdP/Ni7D4ogsSTHD3lZhQn9KOLOknTgiBnaiba7nGftDnAWdOTaoVq4UxXZRUxAN9f0AKQOSwEM2W2Ix2G'
];
TestBlockchain.NONCES = {
    '3KykjQbceGx5M0TP0ldvtp0Iv7leb1HsIsmsG0DsEVE=': 53169,
    'dcl3hufWlm5YwWmyMv3ZZmTpTZvy0D5r7WFuwqa5o8k=': 101053,
    'Ej2mlBAX8Cbvf0mYf8vgZ6zej1S1annW5kK5YlxsQmQ=': 136083,
    'miNdns4fbUifrK/Uj3VAlI//jhbKm5bIGpG2Pg5Vwyo=': 14766,
    'W8xTIL1YgPKYBu6T+1vcU57r2AST8sHCzFllwMr6kPY=': 9404,
    'AHZtXVg0CRduUbn9b+Dc4MnCiEbUZNGN3SW+v1BQoEA=': 628,
    'gD57h4V3H5pdxqFrlhviCgT8WhBsWyEryLadqwTOAIE=': 20621,
    'Z66c38S459s0MFYJi1pnJgiY9motvwDmRuQ4KRJg4b4=': 13861,
    'jAsaWzG7qbZXjAjQYnKllJdrx3C1y4qxxOHy6+1N6bo=': 116221,
    'lC4S0B+ZYO9YBCc03SCsw0fPZdi1E+3lnCBZRgb/ehg=': 165276,
    'JPFVpa5ZXCuuR9LIv+aDxEFgL60rA5P3S5rI/n4zo9k=': 23611,
    'dSxyWx/Pp4hCI9LKOaZEDZ4BkF2OHkJzQOW0a9t1fdY=': 148705,
    '3zHSRDkMj91fId67mHhpJ6JUm6NO/dVhIOghCvVWpU0=': 49853,
    'Hrbj3T9hZ0yEaFzsWKODXs5E1t/RkQqkzhgyetFHDM4=': 37652,
    '6Q3Tquz0ZJNNJRzDpM3pRsLbcxygu1BkPpzjpqFM5xo=': 59798,
    'f7bMkFtzozAVwIr+mCAI9JWis3xMLzclpK/vMwSpj2w=': 17201,
    'KGUuK4Etq+fy6nzn+f62j8PrkXtcGhYWN4mohKjO5Gc=': 102882,
    '04a6Ehm5sFzyXFJgwuQCHNmaH4726e7PB26DZGKY6BM=': 111823,
    'AGc8aZcZZJhrLBCZ3zz8ShzmdCZXhYfdfkkUmhpIlHY=': 37057,
    'NvKHbwtObhEJzroO9//jvMgRHUhcmnSGxVYI7/+DbiI=': 7833,
    'ALwlgTa5If07HmK5yiyzwegjuHSEtNbYTpk+nr0RxhQ=': 231852,
    'm2K4N3BUqYEW9nrrqJ/iMM+VdguOaGJH0fYKuWFO2F0=': 136643,
    'cgKh3n3olJqV8u9FhM2cbIIrXRTDNNaDNASgcQU0qSE=': 23186,
    'u70eh6BDR5aU2kOwJ8Inw8D335n/ziyfcJOYPRWuhm8=': 38272,
    'qnFgm3Usr9iLbU3r85SOe+/tNalP0vFEknSjELCPeuM=': 26487,
    'O/MErp93e+TY1BUSonqXwxcZarMTjtvzWrZBVBCCpVU=': 41593,
    '19ndTM1WABdSLWeB5xHeiC0Nu5IDvdHADR4U7PdxxfI=': 1357,
    '+3fyKFMonugaIToevgmGhI+Ef8EHY0BlcckWA8hLXXY=': 11450,
    'C193qKejeuqF1MbVpdocIQZZtSnI1AlOzq13haj3xug=': 28137,
    'TXdgg2fuFya4IlZtw95MdnLsU0Z4pXISB+e3MOHFHXw=': 56800,
    'jj+/qqEMBnF+pYb/ywu2tqyjLbq7658VOclla89wLA4=': 3134,
    'tHVRrHDkAOC5rMVCePqGz+4Cs3Nh5gKhKGNjmYS99FY=': 22655,
    '1LsSwOx7qVTzPV8KV52AyX5s7sYEyz3iZD/9/91TZ34=': 169495,
    'gDJtcTrGyxPjwLW2kSFQPIihNENyKFpKlWb56InVNhM=': 54853,
    'u0DeShPqI5wpz4czzze8q/usliOcZwz1FB592h2dtiI=': 210957,
    'mtFWOs+KN18DNnofRpTqMtjQ1/uGJvt1mR9m5qZPCX0=': 52938,
    'qB4z58LNNmwIXefGCynmjX8qVA3+wKYPJUoWMoPoZgk=': 104543,
    'DhUqZhu7OM+YN9/pZMBZibHojECAmgUuhzCqP+VnCbc=': 395464,
    'AXBH8IId5bm4DiZQf1gEF/d9LZlizuwFyTaJWc9EqwU=': 16838,
    'okbETkOgivW7v256TAUapOPlNL3H6XaC/lNLVh/Qbco=': 169013,
    'GA59LnzByjLyVBcyhLaPXvYNTB27x+LG+lKO1iBtIbE=': 19861,
    'h8kQ35syjttMmloupoSCemccaSQ1sbc96xGMtSxXgD4=': 49950,
    'BBmNutPkOCubVkNwg6sNzzE2vOeSHSSmg11FCBCHJKE=': 6869,
    '627+MEvzzIf8rCAkTvhSDds72XbIgxpEjQsyBQPSad8=': 304615,
    '2iejbMtd25fKbFGsZSzOrg/I3UIYfyNQWgVNBAJ2qzM=': 4082,
    'cW7CBQzoPTGnV6eoibzUEeUUzFmScf4Ht/PLLU9LbA8=': 89554,
    'OELRJuYq3CyvWgij/Xjxi3MGIds2M0IfX3To4ip+UxY=': 7233,
    'rbHY7DRZyyjITnJOht0BQy1eLM1lDRcGD4M6p5TaU+A=': 244198,
    '9w5jZzTZmizUy6D8QqWdg3FQm9CQSSJl+GKLLvz3xqw=': 1554,
    'H+OZe03M53wDAGrBGDktPaYuK+4oLyOTas9VS+b2UMs=': 122033,
    'MmGKnzHsYi4Ie9AQfZGxOIobcvhdiT6b2WTBqQhXaYY=': 1707,
    'rX66QwJ5SP0mXxKKbaAisEmVAVzhruuk9T3Z5yVzYnM=': 3128,
    'aywwkaNzgjcEcnWGcl86C8Fko8FroPDOjKYxWzU1J0M=': 43465,
    'vUnWCs2FtytbkwG+vxcxfgCb5qk4YbZfcumBqcn37zM=': 52795,
    'XyD1oll4jx8OSAlJxd6A7GJeTvI8XGx3xfMTfFAc0IU=': 16212,
    'CwvnakS1EYWH2plVYh2W39gL2WR3mSRnVFEH2/5rYc0=': 25395,
    '+jDM9oOMy7Xrxsux+Kvuyp2fzvpmw5PIcdE+T1IkNko=': 71328,
    'cZqyJvqTp6B+qkEIHeFP5lhNnimnGLZL4te1nLkz4nk=': 47023,
    'eGg6j8UD98EpLlj9QWHe/LjsiQwrNQX4bMnugREPChw=': 21077,
    '/l5vlwVpLGD7hdT1bQnhSiI08lBseV38v+dyCl00LYk=': 265811,
    'b/i8VOu14bpedkIUweNJ5d3hVWugynopPcxkOouOvko=': 16047,
    '6+LFvaL+g/tEmveyG/zwvS3zLQYgTe+hG2LEskEWvbU=': 15161,
    'eoUeYGjKccG0elLaHSAaWDfmxbUdWg6LDLPPXfVVNlg=': 9274,
    'x6gqhX6hRFlaqIIzS24vrLifqjVG0ES6owGc9d6uyks=': 136171,
    '2vZdabfjSEjNOyOiADgKhtLS7IU/FyFmoiTUNURV8mw=': 6382,
    'nJJA6ccgQF566FnCs9JXEhZ46ltGBQr/71xlH3IKssU=': 85575,
    'cIaKkltBgT/PUlEDNUMPDJl4kMCtnwDUE6IKB5XjBJ4=': 35672,
    'h+ikzt0kbd09laK01gI4p2DFIMMTIq0g4V5DXUf3TvQ=': 46227,
    'hFgrU7IVczwTUdL4vikW2qUIfMkfRDCQs5sSnVoIBEA=': 153755,
    'aM7EFaBQknhdyfha71sYAOmDBH5O0CmmUX3r0L0SAq8=': 11274,
    'n9HQQc0t8PtzrRFdN54Rzcal0cd3E7wyaN+w5CdRXlc=': 92678,
    'EXeYUItcWq3j5SdFJKlkS/EBQMMiBwJIlNfj7YwEaGI=': 84709,
    'N0Z7dMKWakOMIkfWr3n+1kwHupqQgEfSGu6YjXz5/FA=': 90768,
    'NJ1jrZi51NRuNlUjqHEDmZpZTQt6uGXj70bWVo6A5XI=': 52758,
    'F6CQAJreiI6a9fgydH26gkPN/zv+KhLOn8ArpBIYeP4=': 10112,
    '57ILeD43uN0gE1y/Gs+WWY32CU8X5fvSjSz0NXdb1wc=': 124262,
    '8bC3GkPee92BKoYUxsE6k7eUbPW97TsLzUOHEgGp0xI=': 21231,
    'E3uEmAQCnOzbTdtbinBxNsjKgoXZu3WjXOG5EA1c4r4=': 18720,
    '7RYIQ/f6P2OsVg9Wg0U3YK5OhSbMHiBqyN/Rupz0+Lo=': 79416,
    'BtSCmXSKmGc35+OSDxJKx8e6dYYCv7DnpaUHPbFk6LA=': 131512,
    'SQFaki/vI7jvSlPAGBX15b77JokUZgUI3sSYmBBRFg0=': 14082,
    '4TcIk8zgw7PQlxoN3+JrLuCaBc+9dqX7BaiuK6M7bME=': 107428,
    'WJu7WQZfIVblOTQB8RN7OateW/5c9721ZosMRlluCvw=': 7368,
    'xsABO1FdKjNQHe0WCEW1FaEoJPB8hIYL+TBkeG2gu30=': 77728,
    'GKS8m/yY9PR8L4FkYoocwzXeTwnEuMXC+5WIXqdp24Y=': 23809,
    'tAleHpwnLSRU0J5YqbhJpN/SHIw6s2r1gen+TQAs1Gw=': 59565,
    'buwqNN4Oativ2IP7MyCR6C0E8KDBAbavHQRmVmVIN4I=': 5754,
    'wCFOY16bDFa5RmQinYS7StLfLjwy8O2298l37IEqK84=': 22613,
    'XQ1scC1HDKkxTDgim1zqFqnCW9nEvx5i8/aF78FTQ3Q=': 17033,
    'wMWgzwOOUr2uZJYy0TsPYgq0B2QiEs8w1ty/nHsCGLw=': 4374,
    'PdRa777A1xESeUEfb4qbWMqL0e8zzg7JrWdn9m21yA4=': 148011,
    'DEKSMle+tb7Qn6ZD1lGtP+L7NPOCjIpvxEB1YF9TAcA=': 36890,
    '75JE/flkIEhPNGeo7WDV52xqyecU55ns0N4erGPKYLI=': 36116,
    'hWF6RpahMg8X5IoImPxSWuhBaWub0bUos4tUGs7FtVQ=': 25752,
    '37UJTUUyOqAYNbcs8IeGiywXv5ylRclSfhTZnjcgHeQ=': 31773,
    'wneWumFiEX74glK3ZA9FzCuTHVG5nZkerOBPDzAshxQ=': 118156,
    '8E2N6pZNGvCYd57MDuFLCt+jT9V3a27dxSPegraX06k=': 55801,
    'XEHJQEBUUXrCWmVXAnZQr1o18Zq4/r04qgmLbuB1kSY=': 43164,
    'TIcgEW3788CYlB6VF8iMOnjYma7bRD94VOonnxsKSE0=': 48018,
    'oCWN2r6AowR220x8M7YXcwN/+bM0ilB6GgomMlKYDN8=': 121111,
    'BIshvCO0ENeAHRoTpBSXjzsQQiE3odWwcm7ErG2QwRk=': 42966,
    'oo9kKhFmThzbEIFKS0qdzpvBqaxUZnNSrGvoAWgn9Iw=': 19720,
    'OOc3he4UvjG2qgma96R3KnNMX3hh8SESUAOmSjpEEgQ=': 5254,
    'i2F1btgrAKgJ1v16nw8R0UqXLEHVgIsL7GPHDTgEb3M=': 246836,
    'Irre4JRjuCRLh6QL9mzTf3Ar0VgFIr2XuG1eOVU9zwA=': 12372,
    '/dUsv3lOS2lenf734lbPxYptjNmZPh5M2nCtCG+exf0=': 54729,
    'Rr4F3gvm2G56BQDJTJPWWKUCFSeJvoQT310b/0M+6YA=': 154014,
    'xOrlYCBwOJn59QY76ew+MIinXbNhoN0c4uszIKyoQMw=': 34289,
    'U5HdLhEZdIcghYUIAFgn2uhZBKKwagBf+5E/CaEy76o=': 87427,
    'K5lpo0habQKEnTUQLkrLTZMXaSA+OruNs4KA0fneVlQ=': 61883,
    'a3i8fjLjAzz1w2QAD6hMyeXR0fQYNOEr5iWjmBnd/s8=': 14708,
    '2p/9L6i7DKttGN2cD4qeI6hUY9FJ367h/SmD6R3hkrA=': 58094,
    'm67hBFrRaaY1gS+XBsMu+zId/h9TyMRThenka8BLQaQ=': 40453,
    'KKuBYjI9ngyWvVulNR+N7SLxHF4S8Wi2lMoIcuRLTDE=': 86414,
    'ZNnA/HL+E78y5pehzHmF+P0c+r/1KBkC2TID/YKddpI=': 3586,
    'EFiL4vl1resnGpq5i0ei1XJeSVpP3aZFFcXR7WT2OIg=': 68776,
    'BR1ZenstXJKoJM2FUpRDR1Z7HTvRg3puMcssMLUWRjY=': 53187,
    'QOxiBtRl827XL8E+39AXANtLP3GJWWkoqcSXsQRJxkg=': 60495,
    'Ox5P14UW9T3lrrj1aFi0nkodshlsJSpAOV64Fi5srmU=': 5358,
    'zRvl8PQgPnjLrLdguM0DSnZLrOomGb6KdnPnSVBbHIc=': 20526,
    'wrWP4AfhlwyOKvZp7QAIk6ZheB1KTlShoVpV8rpbxpc=': 5376,
    'FfulStLxogfwhaMR/LGH2co7H8YOIxNH55i5EQMketY=': 139352,
    'yTcN+U9e066dUidXWfx/JV+REvY259+qsg7rvpq3wgc=': 32233,
    '2gFkNoQRf3jAjOrUsc/dR8StipedE4O2C4KVJR3HZxA=': 112649,
    '07v3kEOVdtYd70vXjp5ucQe1t/V2bEIyNgs3KuItsVQ=': 363754,
    'kQ5ndYZ/dNPzk9y47Iiz2TiVZI3eMoc9Iosb8Bg+w6g=': 39759,
    'cC2+mv01Kgsmw9poSJCTFYLeo26duKjfv1HZqjscQ6M=': 156598,
    't8dpApwkUV+pJmcJdwDj/+svBkD4xnYa4IpxFu3w6pE=': 6052,
    'RZXPbJecrGhjcTMxGqe0br1QNcsG/yM+Ap954lc1Z1I=': 9570,
    'r9ZZxW91oDFyCy7ahnaXfY04unjPLr4bwhkK/03bBug=': 12598,
    'O6evWjK3ZNjBp3+eL6VXfsfG3kAcnQeCkS3lkD/CAGE=': 47637,
    'N8HN1ZJ/4ZYxtl1hHz9cPRAsc8TfD4FUKlQENz32q1M=': 128186,
    '0pkGHgsdtgSQneFLp4HnGxf3MyFxeTOZH8JNSBYqxE8=': 110689,
    '5yv2Gn37kX6IpzkBWK+zqlcA4yVsiCz7zUjDjRHcAUM=': 144690,
    'OiSc+JZePWO17wnxJL0oF60wzBeKXhsCm5P6mVsWYtI=': 49280,
    'DC5bQRbVFQUXq0IboDthB7wNhyjQpvLZg55G1s33Dm8=': 168880,
    'sjq67pWgnKKKVcC9OcK2DJII3VH67Mkp9aC76ykzJGo=': 1224,
    'Pvu3uYSKLiTHrHfsd+RmMrDcVxLrRovqW6Ve5MC/6OI=': 167327,
    'aOCbscQAJ00urw0J5zOf5z04hzyt5eYPJYTP2exDv5Q=': 139371,
    '9YGz3vtZV98YDkdxuGnpT+YBmTn90EaSnPEDNRk3cTs=': 6083,
    'wNXAPoLeIFfsCIf0tR/bxjt20Ebe5x9RkbFxqkgfw4Q=': 63190,
    'vZJ6eOU063Vp1GBSv4Z3liFXl4BSvbPGHGxBtiHxDWQ=': 34815,
    '2nbsgU92DJLq65VT6v7jijneIl28iQHe8PftcKcJYic=': 76585,
    '4R5BTTnj1vJASyEZu+hrd2Tnzn3XcQ9woKOj9Qt5S80=': 47147,
    '1um79EKNVlQK6Zk2+gGqckMfEHihGzi6CoD06rNbDHQ=': 260455,
    'md7miAEtRbAS4S3I16YsSC/mh6uxpZXrGfUxVJSisNU=': 56350,
    'aQuNwkbKr+mviqlC4b6kbhtgioBrl0xQWsEz/E8eoyg=': 63906,
    'GinbtnpeuEEC+Uofrdf14qq/6bk92ASOTODLnlVrsig=': 9574,
    'G1RKYHWxpLE25GkotYtb7fCEJnCFID8I2fUH1kPFZzk=': 76370,
    '1ria4vo4IEaauJAo2KRGb23LmEWURzwS+HZ8mdeazoA=': 81842,
    'I7dGRl47o0OmGDoIDJa0xzfZQhLBJBujqRTsFq8d+hw=': 6455,
    'hkd4ypxcmTAY++P/rahOaq0vxAsx2qGHEj5+4MhRDtA=': 43956,
    'ok/jqMctDmRnxcG6LhbY3O8Kc1puyRU3fWOWMq0lZSM=': 46677,
    'pjyk3aA9+wLcU9cRHJiIlgIgdHbKXgzPjwjc/0lijmk=': 47233,
    '1WwgfkUpNNRXNWtxWp4RMd2gBleiumab1/SPqpTmel4=': 218635,
    'dvLVV/4RVHQ4pp8UQcmT6j40nYz6q04B3zE5GIp0eKU=': 25003,
    'r890dZ3ALAcRjN+D1VX4hJ9Y0oZxSveDuldAwT8ub5w=': 68434,
    'Ib5FWLlaVfEvobiSQyNqeDZZPiTweP8VspDam0ErAqY=': 26400,
    'Iw7zPNWmN1PfeyBDIYAKn2Q0A45LVUOsi3X2pMq3m40=': 34139,
    'sAsegAJNZGy5HrvkImtZYE/tJPOsHBs/5a9VG6he1Rk=': 101392,
    'RrFWdMODC6GuJhd9XT8R283OlZEQ3aNWyqGbD6hFSks=': 258701,
    'cWJLEOh16CEnAIf1VYTVDVHNlvqQ6KlxfpwMvq9oyiA=': 10828,
    'itvqs6MByrWjyBv0R/Ve2fI4i1WGC2qzX3YKeGhXSIc=': 11070,
    '0ciP/CUxnTXTdld73V7wb5OXeDeAUQ3W+7YM7BagPNE=': 25174,
    '7RbNKDGRf7YhWG57hlAJPMRPD7z+fyQfsR0uKbfjRQc=': 32053,
    'to+BHEBySJmA6EL91ZjDQhVZhf7WWX1380yiA0AJjDg=': 85848,
    'wMJwKYZqZDQd5lARxPumg0V6Ty9vSGKk7z7vBv3TR0E=': 34178,
    'YE53PlWAVNF/tBYUrC27Pp71ymSb3XZSvjsrhUp3z+g=': 74736,
    'kY2sEkdWOrJF2uox82cHCHzn9yYh8k/Ewf47b87r8uY=': 4812,
    '/NePNftudvuXj0IVFjaJDc58+zkyqAt06ZDe+c/Y/YE=': 146525,
    'GE+NEfCx/mV6zXkS/pg8vIibVKWtFC2EcWhAWYBuBwc=': 160683,
    'QgAHpgzvfHt4LLumatYu0fgMtox7J82UBhMGNYn6T54=': 169178,
    'N+HB5HQf0iG+37cYGjyjyfOv1H0GNOD5u08lDrvBs2w=': 191608,
    'OYfymousr9z9O9dFDzTNeOKYxhcdWwKtnE0x6BunvxY=': 48449,
    '7lKFgAyzC5cnxsDxTMt/kB119GU/8MDO/amE+3b8qJ4=': 47620,
    'KP4kNVPY1menbsCTdM72ySexdSslfGM4RnmqZqrKdmA=': 15252,
    'Cu9YEvAt73X24lbUbW7zWLD6sM6A58q4qF4bJN4aUdo=': 6998,
    'M4JgDjAN/3P6o4LsSgjMwvb4J7385xI1OEzHSjwirXc=': 65042,
    'qqVJxyFqIxn21fliE8dddYuCHkwEdSbbKAj2H1L1NrM=': 18796,
    'wQ1fIh4Vv7KAHQLQwB7NyM1TWv8Ee7fOQduhBrnfnFw=': 120617,
    'hvQ+0MP2ukaJ74ZLOFIb2we28a9h20oN9zPseusOEa8=': 224723,
    'XdZoznQR4We8Ks+8IfXo+zyigvnTA0Gdr6W6Bbp2BnY=': 309520,
    '874cvuPJ6oJ/KYZwyM0w6N7tn1hFSo2tUQQYV53tbKM=': 12402,
    'TFcQGKQ0Zo6eln7xzxNHH0Hg7L1Iwztu7nji8jmTOq4=': 182729,
    'ieaUwKoKFgGX6XMppZJ1UKu/miD5h/R2VQ30VnyUzfE=': 458073,
    'g4ugzeHslo8dqT2TCHLsxNdseM+5HFPpYl0yuiC77LU=': 2008,
    'aQA0yvyKK7MjpfDIokZHU83C98htHSjBz3jnPtDxs/4=': 54272,
    'a0zFvp44ctqUVhQ/7MCBC/gNBLmKWtBbPg7S8YAVSuE=': 12685,
    'b1kUD6ml51bXoj+aoZR8ZNCBApnLqdWj2Ghidf3eNXY=': 34908,
    'XeYMBUEV/X99AdOg8CH08yDCGWcHyopS33XkR3yLBHU=': 14723,
    '7FwdeTSYe3mWMSYkCdN/6r96OYO7n6yHgnmJQaKH17U=': 18897,
    'UJ2nlCO2kjIaB4w7U+9/fx5mjaVTJ3+u8XYzZCIWuHo=': 126187,
    'r/tGbehmOihm62pPxNW7OcJwNxDp3MUM30myN6LFJC0=': 87077,
    'GVooVUHKAGnB00xs+K1QDxoS14gMeqCGbMVnF+61ZUk=': 126930,
    'il/DrVWvfsvRdZCkLSv/mIm5KKAmNSMzYZeAB/kx1SU=': 11246,
    'FYyLKTOmavsJ7KOv1r2EjZNRkx5OKMzrD3O9UCbwChI=': 70824,
    'cDXuE0op3xTorkY4U9jlzShTDqU4MJke+SnEcSG3cGE=': 84293,
    'W5PQVMGS4WnjV5HobF/P1gtkuTTuVkEve2+V2VRCLRg=': 223096,
    'g3MWYvph4rhH/kJA6cNuPc4/1PO+IYrSMfvVtCACoXI=': 133387,
    'tnLMjgaqSpALY1Ek84OUfzUVXP7awTGu19HGom7TlgU=': 54796,
    '46Vg5E8OAaQxyqwCrgOKbN6FvaIRxDXiypQjYRrRD5Y=': 151215,
    'SEapF11SfLOp7PiaNkFYJYPwBFNQ+Z7yLYQrEjUt3mA=': 22450,
    '4T+B35p139SzILWtNxUZdPhr1GDPOYfSwna9Ig3qCG0=': 22031,
    'lusQcxFW9E3wcfiG0TC8AVNl4SKVo9/GrK44L0ovvpY=': 243146,
    'PSG6ccPSnfapY7dUQy3YBUdq+o0R3nhIChGehJ0qEbM=': 51777,
    'omnfMeyh6uBQzZKItw0JvJXofjrOURn8abiVMVkyez0=': 73335,
    '3KaktZ3QmwC5F8MA7mtcw5+W3K+sUZlw2sk5gbhA8us=': 87219,
    'J2Zdygb1Jhtz3sXN4IA7mcGgOHiEdeG0TTUEYMroDhU=': 16066,
    'aJwyqXxJQjcIE6gGnvCYOyHdAL7WaXRNVqN7p5dU9tA=': 32747,
    'zNbL5RgIOcvVLEgm53dl8bI/iXF99qKdskzpThw9hdQ=': 110920,
    'TGOHi25im40Yj+bLs5enVM9EtNHrlA2miKzziqt2+Qo=': 25109,
    'mxmQdWhgxmbEm+8CLUAvWQFS7p0ouXxXZHfe3/42FEc=': 130794,
    'sbusNRedzQP/H1Pv3dvzoXmbI9l7L7mhsC95/EKKEHY=': 46069,
    'L7PvWbxX7lT8H0ItGo7IzYUwnl0e3s/KFG4BfzVbSVA=': 56848,
    'S7BkheIEyWXBv0mFxC8Hf6qJPv+cIb0HPd3RwAAX4AY=': 54871,
    'Lr6RDaijhNERXXgHEmIB07AumZDwuE8AuVjLrBUKYY0=': 2867,
    'kqDLjSeUljpRfmhKHWe+MxRl5Sz1T4ogLhF3vl4+uMY=': 34149,
    'iaWNNLAwsBRaqgIxVKD2rHV0DTlARZH+2dpoASiIozE=': 5721,
    'gI21G0hkMvYxk7nINWyOY4mneLpjER7SQCvUneSMNdQ=': 155013,
    'TMRiM9ttuqgyQHV+Y+vFRtjiPK69iCtNR9FGN0SqNB8=': 134062,
    'FSQg8ZQS6/dWx+LgFkGaF34nhvguVJoMa5wn1qiteMg=': 52611,
    'nCDGEpSowtm4COIvrFHxmlnnjujzmn3O9Bz3cM5PP8I=': 15884,
    'SufsV5AkhX5XPucvCUS9ytaAAEAwTXXSHNDwG6sto5Q=': 107248,
    'QOwYdX+fshh1ktz99393Wuy6vt4NbLuFMy4VMTMF0X8=': 68392,
    'eq1Oxb7C1WV0uzwTXuX1w4fX7cuqZrpw9otEDBHc8ps=': 50155,
    'TmzuKXLWNrXD0D1kKHV926c65O+PPhgJunf1D51I0WQ=': 56571,
    'jTKL/OEyJ8Fa0juEJTagas2/Xv2hct1p1TDlm5vo5b0=': 3301
};
