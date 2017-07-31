class Mempool extends Observable {
    constructor(blockchain, accounts) {
        super();
        this._blockchain = blockchain;
        this._accounts = accounts;

        // Our pool of transactions.
        this._transactions = {};

        // All public keys of transaction senders currently in the pool.
        this._senderPubKeys = {};

        // Listen for changes in the blockchain head to evict transactions that
        // have become invalid.
        blockchain.on('head-changed', () => this._evictTransactions());
    }

    async pushTransaction(transaction) {
        // Check if we already know this transaction.
        const hash = await transaction.hash();
        if (this._transactions[hash]) {
            Log.v(Mempool, `Ignoring known transaction ${hash.toBase64()}`);
            return false;
        }

        // Fully verify the transaction against the current accounts state.
        if (!(await this._verifyTransaction(transaction))) {
            return false;
        }

        // Only allow one transaction per senderPubKey at a time.
        // TODO This is a major limitation!
        if (this._senderPubKeys[transaction.senderPubKey]) {
            Log.w(Mempool, 'Rejecting transaction - duplicate sender public key');
            return false;
        }
        this._senderPubKeys[transaction.senderPubKey] = true;

        // Transaction is valid, add it to the mempool.
        this._transactions[hash] = transaction;

        // Tell listeners about the new valid transaction we received.
        this.fire('transaction-added', transaction);

        return true;
    }

    // Currently not asynchronous, but might be in the future.
    getTransaction(hash) {
        return this._transactions[hash];
    }

    // Currently not asynchronous, but might be in the future.
    getTransactions(maxCount = 5000) {
        // TODO Add logic here to pick the "best" transactions.
        const transactions = [];
        for (const hash in this._transactions) {
            if (transactions.length >= maxCount) break;
            transactions.push(this._transactions[hash]);
        }
        return transactions;
    }

    async _verifyTransaction(transaction) {
        // Verify transaction signature.
        if (!(await transaction.verifySignature())) {
            Log.w(Mempool, 'Rejected transaction - invalid signature', transaction);
            return false;
        }

        // Do not allow transactions where sender and recipient coincide.
        if (transaction.recipientAddr.equals(await transaction.getSenderAddr())) {
            Log.w(Mempool, 'Rejecting transaction - sender and recipient coincide');
            return false;
        }

        // Verify transaction balance.
        return this._verifyTransactionBalance(transaction);
    }

    async _verifyTransactionBalance(transaction, quiet) {
        // Verify balance and nonce:
        // - sender account balance must be greater or equal the transaction value + fee.
        // - sender account nonce must match the transaction nonce.
        const senderAddr = await transaction.getSenderAddr();
        const senderBalance = await this._accounts.getBalance(senderAddr);
        if (senderBalance.value < (transaction.value + transaction.fee)) {
            if (!quiet) Log.w(Mempool, 'Rejected transaction - insufficient funds', transaction);
            return false;
        }

        if (senderBalance.nonce !== transaction.nonce) {
            if (!quiet) Log.w(Mempool, 'Rejected transaction - invalid nonce', transaction);
            return false;
        }

        // Everything checks out.
        return true;
    }

    async _evictTransactions() {
        // Evict all transactions from the pool that have become invalid due
        // to changes in the account state (i.e. typically because the were included
        // in a newly mined block). No need to re-check signatures.
        const promises = [];
        for (const hash in this._transactions) {
            const transaction = this._transactions[hash];
            promises.push(this._verifyTransactionBalance(transaction, true).then(isValid => {
                if (!isValid) {
                    delete this._transactions[hash];
                    delete this._senderPubKeys[transaction.senderPubKey];
                }
            }));
        }
        await Promise.all(promises);

        // Tell listeners that the pool has updated after a blockchain head change.
        this.fire('transactions-ready');
    }
}
Class.register(Mempool);
