// TODO V2: Store private key encrypted
class MultiSigWallet {
    /**
     * Create a new MultiSigWallet object.
     * @param {KeyPair} keyPair KeyPair owning this Wallet.
     * @param {number} minSignatures Number of signatures required.
     * @param {Array.<PublicKey>} publicKeys A list of all owners' public keys.
     * @returns {Promise.<MultiSigWallet>} A newly generated MultiSigWallet.
     */
    static fromPublicKeys(keyPair, minSignatures, publicKeys) {
        const combinations = [...ArrayUtils.k_combinations(publicKeys, minSignatures)];
        const multiSigKeys = combinations.map(arr => PublicKey.sum(arr));
        return new MultiSigWallet(keyPair, minSignatures, multiSigKeys);
    }

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
        this._publicKeys.sort((a, b) => a.compare(b));
        /** @type {Address} */
        this._address = undefined;
        return this._init();
    }

    async _init() {
        const rootHash = await MerkleTree.computeRoot(this._publicKeys, key => Hash.light(key.serialize()));
        this._address = new Address(rootHash.subarray(0, 20));
        this._hashes = await Promise.all(this._publicKeys.map(key => key.hash()));
        return this;
    }

    /**
     * Create a Transaction that still needs to be signed.
     * @param {Address} recipientAddr Address of the transaction receiver
     * @param {number} value Number of Satoshis to send.
     * @param {number} fee Number of Satoshis to donate to the Miner.
     * @param {number} nonce The nonce representing the current balance of the sender.
     * @returns {Transaction} A prepared Transaction object.
     */
    async createTransaction(recipientAddr, value, fee, nonce) {
        const transaction = new Transaction(Transaction.Type.BASIC, this._address, Account.Type.BASIC,
            recipientAddr, Account.Type.BASIC, value, fee, nonce, new Uint8Array(0));
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
     * @param {Transaction} transaction
     * @param {PublicKey} aggregatedPublicKey
     * @param {Commitment} aggregatedCommitment
     * @param {RandomSecret} secret
     * @returns {Promise.<PartialSignature>}
     * @private
     */
    async signTransaction(transaction, aggregatedPublicKey, aggregatedCommitment, secret) {
        return await PartialSignature.create(this._keyPair.privateKey, aggregatedPublicKey,
            secret, aggregatedCommitment, transaction.serializeContent());
    }

    /**
     * @param {Transaction} transaction
     * @param {PublicKey} aggregatedPublicKey
     * @param {Commitment} aggregatedCommitment
     * @param {Array.<PartialSignature>} signatures
     * @returns {Transaction}
     * @private
     */
    completeTransaction(transaction, aggregatedPublicKey, aggregatedCommitment, signatures) {
        if (signatures.length !== this._minSignatures) {
            throw 'Not enough signatures to complete this transaction';
        }

        const signature = Signature.fromPartialSignatures(aggregatedCommitment, signatures);
        const proof = SignatureProof.fromHashes(signature, aggregatedPublicKey, this._hashes);
        transaction.proof = proof.serialize();
        return transaction;
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
