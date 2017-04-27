class Mempool extends Observable {
    constructor(blockchain, accounts) {
        super();
        this._blockchain = blockchain;
        this._accounts = accounts;

        // Our pool of transactions.
        this._transactions = {};

        // All public keys of transaction senders currently in the pool.
        this._publicKeys = {};

        // Listen for changes in the blockchain head to evict transactions that
        // have become invalid.
        blockchain.on('head-changed', () => this._evictTransactions());
    }

    async pushTransaction(transaction) {
        // Fully verify the transaction against the current accounts state.
        if (!await this._verifyTransaction(transaction)) {
            return;
        }

        // Only allow one transaction per publicKey at a time.
        // TODO This is a major limitation!
        if (this._publicKeys[transaction.publicKey]) {
            console.warn('Mempool rejecting transaction - duplicate public key');
            return;
        }
        this._publicKeys[transaction.publicKey] = true;

        // Transaction is valid, add it to the mempool.
        const hash = await transaction.hash();
        this._transactions[hash] = transaction;

        // Tell listeners about the new valid transaction we received.
        this.fire('transaction-added', transaction);
    }

    // Currently not asynchronous, but might be in the future.
    async getTransaction(hash) {
        return this._transactions[hash];
    }

    // Currently not asynchronous, but might be in the future.
    async getTransactions(maxCount = 5000) {
        // TODO Add logic here to pick the "best" transactions.
        const transactions = [];
        for (let hash in this._transactions) {
            if (transactions.length >= maxCount) break;
            transactions.push(this._transactions[hash]);
        }
        return transactions;
    }

    async _verifyTransaction(transaction) {
        // Verify transaction signature.
        if (!await transaction.verifySignature()) {
            console.warn('Mempool rejected transaction - invalid signature', transaction);
            return false;
        }

        // Verify transaction balance.
        return await this._verifyTransactionBalance(transaction);
    }

    async _verifyTransactionBalance(transaction, quiet) {
        // Verify balance and nonce:
        // - sender account balance must be greater or equal the transaction value.
        // - sender account nonce must match the transaction nonce.
        const senderAddr = await transaction.senderAddr();
        const senderBalance = await this._accounts.getBalance(senderAddr);
        if (!senderBalance) {
            if (!quiet) console.warn('Mempool rejected transaction - sender account unknown');
            return;
        }

        if (senderBalance.value < transaction.value) {
            if (!quiet) console.warn('Mempool rejected transaction - insufficient funds', transaction);
            return false;
        }

        if (senderBalance.nonce !== transaction.nonce) {
            if (!quiet) console.warn('Mempool rejected transaction - invalid nonce', transaction);
            return false;
        }

        // Everything checks out.
        return true;
    }

    async _evictTransactions() {
        // Evict all transactions from the pool that have become invalid due
        // to changes in the account state (i.e. typically because the were included
        // in a newly mined block). No need to re-check signatures.
        for (let hash in this._transactions) {
            const transaction = this._transactions[hash];
            if (!await this._verifyTransactionBalance(transaction, true)) {
                delete this._transactions[hash];
                delete this._publicKeys[transaction.publicKey];
            }
        }

        // Tell listeners that the pool has updated after a blockchain head change.
        this.fire('transactions-ready');
    }
}
