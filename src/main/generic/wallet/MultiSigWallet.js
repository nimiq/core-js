// TODO V2: Store private key encrypted
class MultiSigWallet {
    /**
     * Create a new MultiSigWallet object.
     * @param {KeyPair} keyPair KeyPair owning this Wallet.
     * @param {number} minSignatures Number of signatures required.
     * @param {Array.<PublicKey>} publicKeys A list of all aggregated public keys.
     * @returns {Promise.<MultiSigWallet>} A newly generated MultiSigWallet.
     */
    constructor(keyPair, minSignatures, publicKeys) {
        /** @type {KeyPair} */
        this._keyPair = keyPair;
        /** @type {number} minSignatures */
        this._minSignatures = minSignatures;
        /** @type {Array.<PublicKey>} publicKeys */
        this._publicKeys = publicKeys;
        /** @type {Address} */
        this._address = undefined;
        return this._init();
    }

    async _init() {
        const rootHash = MerkleTree.computeRoot(this._publicKeys, key => Hash.light(key.serialize()));
        this._address = new Address(rootHash.subarray(0, 20));
        return this;
    }

    /**
     * Create a Transaction that still needs to be signed.
     * @param {Address} recipientAddr Address of the transaction receiver
     * @param {number} value Number of Satoshis to send.
     * @param {number} fee Number of Satoshis to donate to the Miner.
     * @param {number} nonce The nonce representing the current balance of the sender.
     * @returns {MultiSigTransaction} A prepared Transaction object.
     */
    async createTransaction(recipientAddr, value, fee, nonce) {
        const transaction = new MultiSigTransaction(this._address, recipientAddr, value, fee, nonce);
        await this.prepareTransaction(transaction);
        return transaction;
    }

    /**
     * Creates a commitment pair for signing a transaction.
     * @returns {CommitmentPair} The commitment pair.
     */
    createCommitment() {
        return CommitmentPair.generate();
    }

    /**
     * Creates a MultiSigTransaction that can be signed by the cosigners.
     * @param {MultiSigTransaction} transaction The transaction to be signed.
     * @param {Array.<Commitment>} commitments The commitments collected from the cosigners.
     * @param {Array.<PublicKey>} publicKeys The public keys of the cosigners.
     * @returns {MultiSigTransaction} The multisig transaction to be signed by the cosigners.
     */
    collectCommitments(transaction, commitments, publicKeys) {
        if (commitments.length !== this._minSignatures || commitments.length !== publicKeys.length) {
            throw 'Not enough commitments/public keys to sign this transaction';
        }

        const aggPublicKey = PublicKey.sum(publicKeys);
        // TODO: check that public key is valid (i.e., in this._publicKeys)

        const aggCommitment = Commitment.sum(commitments);
        transaction.setCommitment(aggCommitment, aggPublicKey);
        return transaction;
    }

    /**
     * @param {MultiSigTransaction} transaction
     * @param {RandomSecret} secret
     * @returns {Promise.<PartialSignature>}
     * @private
     */
    async signTransaction(transaction, secrt) {
        if (transaction.stage !== MultiSigTransaction.Stage.COLLECT_SIGNATURES) {
            throw 'Wrong stage of signing process';
        }

        const tmp = transaction.toTransaction();
        const signature = await PartialSignature.create(this._keyPair.privateKey, transaction.publicKey,
            secret, transaction.commitment, tmp.serializeContent());
        return signature;
    }

    /**
     * @param {MultiSigTransaction} transaction
     * @param {Array.<PartialSignature>} signatures
     * @returns {Transaction}
     * @private
     */
    completeTransaction(transaction, signatures) {
        if (transaction.stage !== MultiSigTransaction.Stage.COLLECT_SIGNATURES) {
            throw 'Wrong stage of signing process';
        }
        if (signatures.length !== this._minSignatures) {
            throw 'Not enough signatures to complete this transaction';
        }

        const realTransaction = transaction.toTransaction();
        realTransaction.signature = Signature.fromPartialSignatures(transaction.commitment, signatures);
        return realTransaction;
    }

    /**
     * The address of the MultiSigWallet.
     * @type {Address}
     */
    get address() {
        return this._address;
    }

    /** @type {KeyPair} */
    get keyPair() {
        return this._keyPair;
    }
}
Class.register(MultiSigWallet);
