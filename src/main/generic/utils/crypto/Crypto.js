class Crypto {
    static get lib() { return CryptoLib.instance; }

    /**
     * @returns {Promise.<CryptoWorkerImpl>}
     */
    static async prepareSyncCryptoWorker() {
        const impl = IWorker._workerImplementation[CryptoWorker.name];
        await impl.init('crypto');
        Crypto._workerSync = impl;
        return impl;
    }

    /**
     * @returns {CryptoWorkerImpl}
     * @private
     */
    static _cryptoWorkerSync() {
        if (Crypto._workerSync === null) throw new Error('Synchronous crypto worker not yet prepared');
        return Crypto._workerSync;
    }

    /**
     * @returns {Promise.<CryptoWorker>}
     * @private
     */
    static async _cryptoWorkerAsync() {
        if (!Crypto._workerAsync) {
            Crypto._workerAsync = await IWorker.startWorkerPoolForProxy(CryptoWorker, 'crypto', 4);
        }
        return Crypto._workerAsync;
    }


    /* Public Key */

    static get publicKeyType() {
        return Uint8Array;
    }

    static get publicKeySize() {
        return 32;
    }

    static publicKeySerialize(key) {
        // key is already a Uint8Array
        return key;
    }

    static publicKeyUnserialize(key) {
        return key;
    }

    /**
     * @param {Uint8Array} privateKey
     * @returns {Uint8Array}
     */
    static publicKeyDerive(privateKey) {
        const worker = Crypto._cryptoWorkerSync();
        return worker.publicKeyDerive(privateKey);
    }


    /* Private Key */

    static get privateKeyType() {
        return Uint8Array;
    }

    static get privateKeySize() {
        return 32;
    }

    static privateKeySerialize(key) {
        // already a Uint8Array
        return key;
    }

    static privateKeyUnserialize(key) {
        return key;
    }

    /**
     * @returns {Uint8Array}
     */
    static privateKeyGenerate() {
        const privateKey = new Uint8Array(Crypto.privateKeySize);
        Crypto.lib.getRandomValues(privateKey);
        return privateKey;
    }


    /* Key Pair */

    static get keyPairType() {
        return Object;
    }

    /**
     * @returns {{privateKey: Uint8Array, publicKey: Uint8Array}}
     */
    static keyPairGenerate() {
        return Crypto.keyPairDerive(Crypto.privateKeyGenerate());
    }

    /**
     * @param {Uint8Array} privateKey
     * @returns {{privateKey: Uint8Array, publicKey: Uint8Array}}
     */
    static keyPairDerive(privateKey) {
        return {
            privateKey,
            publicKey: Crypto.publicKeyDerive(privateKey)
        };
    }

    static keyPairPrivate(obj) {
        return obj.privateKey;
    }

    static keyPairPublic(obj) {
        return obj.publicKey;
    }

    static keyPairFromKeys(privateKey, publicKey) {
        return { privateKey, publicKey };
    }


    /* Simple Signature */

    static get signatureType() {
        return Uint8Array;
    }

    static get signatureSize() {
        return 64;
    }

    static signatureSerialize(obj) {
        return obj;
    }

    static signatureUnserialize(arr) {
        return arr;
    }

    /**
     * @param {Uint8Array} privateKey
     * @param {Uint8Array} publicKey
     * @param {Uint8Array} data
     * @returns {Uint8Array}
     */
    static signatureCreate(privateKey, publicKey, data) {
        const worker = Crypto._cryptoWorkerSync();
        return worker.signatureCreate(privateKey, publicKey, data);
    }

    /**
     * @param {Uint8Array} publicKey
     * @param {Uint8Array} data
     * @param {Uint8Array} signature
     * @returns {boolean}
     */
    static signatureVerify(publicKey, data, signature) {
        const worker = Crypto._cryptoWorkerSync();
        return worker.signatureVerify(publicKey, data, signature);
    }

    /**
     * @param {Uint8Array} block
     * @param {Array.<bool>} transactionValid
     * @param {number} timeNow
     * @returns {Promise.<{valid: boolean, pow: SerialBuffer, interlinkHash: SerialBuffer, bodyHash: SerialBuffer}>}
     */
    static async blockVerify(block, transactionValid, timeNow) {
        const worker = await Crypto._cryptoWorkerAsync();
        return worker.blockVerify(block, transactionValid, timeNow, Block.GENESIS.HASH.serialize());
    }


    /* Hash Functions */

    static get hashType() {
        return Uint8Array;
    }

    /**
     * @deprecated
     */
    static get hashSize() {
        return 32;
    }

    static get blake2bSize() {
        return 32;
    }

    /**
     * @param {Uint8Array} data
     * @returns {Uint8Array}
     */
    static blake2bSync(data) {
        const worker = Crypto._cryptoWorkerSync();
        return worker.computeBlake2b(data);
    }

    /**
     * @param {Uint8Array} data
     * @returns {Promise.<Uint8Array>}
     */
    static async blake2bAsync(data) {
        const worker = await Crypto._cryptoWorkerAsync();
        return worker.computeBlake2b(data);
    }

    static get argon2dSize() {
        return 32;
    }

    /**
     * @param {Uint8Array} data
     * @returns {Promise.<Uint8Array>}
     */
    static async argon2d(data) {
        const worker = await Crypto._cryptoWorkerAsync();
        return worker.computeArgon2d(data);
    }

    static get sha256Size() {
        return 32;
    }

    /**
     * @param {Uint8Array} data
     * @returns {Uint8Array}
     */
    static sha256(data) {
        const worker = Crypto._cryptoWorkerSync();
        return worker.computeSha256(data);
    }


    /* Multi Signature */

    static get randomnessSize() {
        return 32;
    }

    static get commitmentPairType() {
        return Object;
    }

    /**
     * @returns {{commitment: Uint8Array, secret: Uint8Array}}
     */
    static commitmentPairGenerate() {
        const randomness = new Uint8Array(Crypto.randomnessSize);
        Crypto.lib.getRandomValues(randomness);
        const worker = Crypto._cryptoWorkerSync();
        return worker.commitmentCreate(randomness);
    }

    static commitmentPairFromValues(secret, commitment) {
        return { secret, commitment };
    }

    static commitmentPairRandomSecret(obj) {
        return obj.secret;
    }

    static commitmentPairCommitment(obj) {
        return obj.commitment;
    }

    static get randomSecretType() {
        return Uint8Array;
    }

    static get randomSecretSize() {
        return 32;
    }

    static randomSecretSerialize(key) {
        // secret is already a Uint8Array
        return key;
    }

    static randomSecretUnserialize(key) {
        return key;
    }

    static get commitmentType() {
        return Uint8Array;
    }

    static get commitmentSize() {
        return 32;
    }

    static commitmentSerialize(key) {
        // commitment is already a Uint8Array
        return key;
    }

    static commitmentUnserialize(key) {
        return key;
    }

    static get partialSignatureType() {
        return Uint8Array;
    }

    static get partialSignatureSize() {
        return 32;
    }

    static partialSignatureSerialize(obj) {
        return obj;
    }

    static partialSignatureUnserialize(arr) {
        return arr;
    }

    /**
     * @param {Array.<Uint8Array>} publicKeys
     * @returns {Uint8Array}
     */
    static hashPublicKeys(publicKeys) {
        const worker = Crypto._cryptoWorkerSync();
        return worker.publicKeysHash(publicKeys);
    }

    /**
     * @param {Array.<Uint8Array>} publicKeys
     * @param {Uint8Array} publicKey
     * @returns {Uint8Array}
     */
    static delinearizePublicKey(publicKeys, publicKey) {
        const worker = Crypto._cryptoWorkerSync();
        const publicKeysHash = worker.publicKeysHash(publicKeys);
        return worker.publicKeyDelinearize(publicKey, publicKeysHash);
    }

    /**
     * @param {Array.<Uint8Array>} publicKeys
     * @param {Uint8Array} publicKey
     * @param {Uint8Array} privateKey
     * @returns {Uint8Array}
     */
    static delinearizePrivateKey(publicKeys, publicKey, privateKey) {
        const worker = Crypto._cryptoWorkerSync();
        const publicKeysHash = worker.publicKeysHash(publicKeys);
        return worker.privateKeyDelinearize(privateKey, publicKey, publicKeysHash);
    }

    /**
     * @param {Array.<Uint8Array>} publicKeys
     * @returns {Uint8Array}
     */
    static delinearizeAndAggregatePublicKeys(publicKeys) {
        const worker = Crypto._cryptoWorkerSync();
        const publicKeysHash = worker.publicKeysHash(publicKeys);
        return worker.publicKeysDelinearizeAndAggregate(publicKeys, publicKeysHash);
    }

    /**
     * @param {Uint8Array} privateKey
     * @param {Uint8Array} publicKey
     * @param {Array.<Uint8Array>} publicKeys
     * @param {Uint8Array} secret
     * @param {Uint8Array} combinedCommitment
     * @param {Uint8Array} data
     * @returns {Uint8Array}
     */
    static delinearizedPartialSignatureCreate(privateKey, publicKey, publicKeys, secret, combinedCommitment, data) {
        const worker = Crypto._cryptoWorkerSync();
        return worker.delinearizedPartialSignatureCreate(publicKeys, privateKey, publicKey, secret, combinedCommitment, data);
    }

    /**
     * @param {Array.<Uint8Array>} commitments
     * @returns {Uint8Array}
     */
    static aggregateCommitments(commitments) {
        const worker = Crypto._cryptoWorkerSync();
        return worker.commitmentsAggregate(commitments);
    }

    /**
     * @param {Array.<Uint8Array>} partialSignatures
     * @returns {Uint8Array}
     */
    static aggregatePartialSignatures(partialSignatures) {
        const worker = Crypto._cryptoWorkerSync();
        return partialSignatures.reduce((sigA, sigB) => worker.scalarsAdd(sigA, sigB));
    }

    /**
     * @param {Uint8Array} combinedCommitment
     * @param {Array.<Uint8Array>} partialSignatures
     * @returns {Uint8Array}
     */
    static combinePartialSignatures(combinedCommitment, partialSignatures) {
        const combinedSignature = Crypto.aggregatePartialSignatures(partialSignatures);
        return BufferUtils.concatTypedArrays(combinedCommitment, combinedSignature);
    }


    /* Utils */

    /**
     * @param {Uint8Array} key
     * @param {Uint8Array} salt
     * @param {number} iterations
     * @returns {Promise.<Uint8Array>}
     */
    static async kdf(key, salt, iterations = 256) {
        const worker = await Crypto._cryptoWorkerAsync();
        return worker.kdf(key, salt, iterations);
    }

    /**
     * @param {Array.<BlockHeader>} headers
     * @return {Promise.<void>}
     */
    static async manyPow(headers) {
        const worker = await Crypto._cryptoWorkerAsync();
        const size = worker.poolSize || 1;
        const partitions = [];
        let j = 0;
        for (let i = 0; i < size; ++i) {
            partitions.push([]);
            for (; j < ((i + 1) / size) * headers.length; ++j) {
                partitions[i].push(headers[j].serialize());
            }
        }
        const promises = [];
        for (const part of partitions) {
            promises.push(worker.computeArgon2dBatch(part));
        }
        const pows = (await Promise.all(promises)).reduce((a, b) => [...a, ...b], []);
        for(let i = 0; i < headers.length; ++i) {
            headers[i]._pow = new Hash(pows[i]);
        }
    }
}

/** @type {CryptoWorkerImpl} */
Crypto._workerSync = null;
/** @type {CryptoWorker} */
Crypto._workerAsync = null;

Class.register(Crypto);
