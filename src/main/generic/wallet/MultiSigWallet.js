// TODO V2: Store private key encrypted
class MultiSigWallet {
    /**
     * Create a new MultiSigWallet object.
     * @param {KeyPair} keyPair KeyPair owning this Wallet.
     * @param {number} minSignatures Number of signatures required.
     * @param {Array.<PublicKey>} publicKeys A list of all owners' public keys.
     * @returns {Promise.<MultiSigWallet>} A newly generated MultiSigWallet.
     */
    static async fromPublicKeys(keyPair, minSignatures, publicKeys) {
        const combinations = [...ArrayUtils.k_combinations(publicKeys, minSignatures)];
        const multiSigKeys = await Promise.all(combinations.map(arr => PublicKey.sum(arr)));
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
        const merkleRoot = await MerkleTree.computeRoot(this._publicKeys);
        this._address = Address.fromHash(merkleRoot);
        return this;
    }

    /**
     * Create a Transaction that still needs to be signed.
     * @param {Address} recipientAddr Address of the transaction receiver
     * @param {number} value Number of Satoshis to send.
     * @param {number} fee Number of Satoshis to donate to the Miner.
     * @param {number} validityStartHeight The validityStartHeight for the transaction.
     * @returns {Transaction} A prepared Transaction object.
     */
    async createTransaction(recipientAddr, value, fee, validityStartHeight) {
        const transaction = new ExtendedTransaction(this._address, Account.Type.BASIC,
            recipientAddr, Account.Type.BASIC, value, fee, validityStartHeight, Transaction.Flag.NONE, new Uint8Array(0));
        return transaction;
    }

    /**
     * Creates a commitment pair for signing a transaction.
     * @returns {Promise.<CommitmentPair>} The commitment pair.
     */
    createCommitment() {
        return CommitmentPair.generate();
    }

    /**
     * @param {Transaction} transaction
     * @param {Array.<PublicKey>} publicKeys
     * @param {Commitment} aggregatedCommitment
     * @param {RandomSecret} secret
     * @returns {Promise.<PartialSignature>}
     */
    async signTransaction(transaction, publicKeys, aggregatedCommitment, secret) {
        return await PartialSignature.create(this._keyPair.privateKey, this._keyPair.publicKey, publicKeys,
            secret, aggregatedCommitment, transaction.serializeContent());
    }

    /**
     * @param {Transaction} transaction
     * @param {PublicKey} aggregatedPublicKey
     * @param {Commitment} aggregatedCommitment
     * @param {Array.<PartialSignature>} signatures
     * @returns {Promise.<Transaction>}
     */
    async completeTransaction(transaction, aggregatedPublicKey, aggregatedCommitment, signatures) {
        if (signatures.length !== this._minSignatures) {
            throw 'Not enough signatures to complete this transaction';
        }

        const signature = await Signature.fromPartialSignatures(aggregatedCommitment, signatures);
        const proof = await SignatureProof.multiSig(aggregatedPublicKey, this._publicKeys, signature);
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
