class Crypto {
    static get lib() { return CryptoLib.instance; }

    /**
     * @returns {Promise.<CryptoWorker>}
     * @private
     */
    static _cryptoWorkerSync() {
        if (!Crypto._cryptoWorkerPromiseSync) {
            Crypto._cryptoWorkerPromiseSync = new Promise(async (resolve) => {
                const impl = IWorker._workerImplementation[CryptoWorker.name];
                await impl.init('crypto');
                resolve(impl);
            });
        }
        return Crypto._cryptoWorkerPromiseSync;
    }

    /**
     * @returns {Promise.<CryptoWorker>}
     * @private
     */
    static _cryptoWorkerAsync() {
        if (!Crypto._cryptoWorkerPromiseAsync) {
            Crypto._cryptoWorkerPromiseAsync = IWorker.startWorkerPoolForProxy(CryptoWorker, 'crypto', 4);
        }
        return Crypto._cryptoWorkerPromiseAsync;
    }

    // Signature implementation using ED25519 through WebAssembly
    static get publicKeySize() {
        return 32;
    }

    static get publicKeyType() {
        return Uint8Array;
    }

    static publicKeySerialize(key) {
        // key is already a Uint8Array
        return key;
    }

    static publicKeyUnserialize(key) {
        return key;
    }

    static async publicKeyDerive(privateKey) {
        const worker = await Crypto._cryptoWorkerSync();
        return worker.publicKeyDerive(privateKey);
    }

    static get privateKeySize() {
        return 32;
    }

    static get privateKeyType() {
        return Uint8Array;
    }

    static privateKeySerialize(key) {
        // already a Uint8Array
        return key;
    }

    static privateKeyUnserialize(key) {
        return key;
    }

    static privateKeyGenerate() {
        const privateKey = new Uint8Array(Crypto.privateKeySize);
        Crypto.lib.getRandomValues(privateKey);
        return privateKey;
    }

    static get keyPairType() {
        return Object;
    }

    static async keyPairGenerate() {
        return Crypto.keyPairDerive(Crypto.privateKeyGenerate());
    }

    static async keyPairDerive(privateKey) {
        return {
            privateKey,
            publicKey: await Crypto.publicKeyDerive(privateKey)
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

    static get randomnessSize() {
        return 32;
    }

    static async noncePairGenerate() {
        const randomness = new Uint8Array(Crypto.randomnessSize);
        Crypto.lib.getRandomValues(randomness);
        const worker = await Crypto._cryptoWorkerSync();
        return worker.commitmentCreate(randomness);
    }

    static noncePairSecret(obj) {
        return obj.secret;
    }

    static noncePairCommitment(obj) {
        return obj.commitment;
    }

    static async sumPublicKeys(...publicKeys) {
        const worker = await Crypto._cryptoWorkerSync();
        return publicKeys.reduce((pubKeyA, pubKeyB) => worker.pointsAdd(pubKeyA, pubKeyB));
    }

    static async sumCommitments(...commitments) {
        const worker = await Crypto._cryptoWorkerSync();
        return commitments.reduce((commitment1, commitment2) => worker.pointsAdd(commitment1, commitment2));
    }

    static async sumPartialSignatures(...partialSignatures) {
        const worker = await Crypto._cryptoWorkerSync();
        return partialSignatures.reduce((sigA, sigB) => worker.scalarsAdd(sigA, sigB));
    }

    static async partialSignatureCreate(privateKey, combinedPublicKey, secret, combinedCommitment, data) {
        const worker = await Crypto._cryptoWorkerSync();
        return worker.partialSignatureCreate(privateKey, combinedPublicKey, secret, combinedCommitment, data);
    }

    static async combineSignatures(combinedCommitment, ...partialSignatures) {
        const combinedSignature = await Crypto.sumPartialSignatures(...partialSignatures);
        return BufferUtils.concatTypedArrays(combinedCommitment, combinedSignature);
    }

    static async signatureCreate(privateKey, publicKey, data) {
        const worker = await Crypto._cryptoWorkerSync();
        return worker.signatureCreate(privateKey, publicKey, data);
    }

    static async signatureVerify(publicKey, data, signature) {
        const worker = await Crypto._cryptoWorkerSync();
        return worker.signatureVerify(publicKey, data, signature);
    }

    static signatureSerialize(obj) {
        return obj;
    }

    static signatureUnserialize(arr) {
        return arr;
    }

    static get signatureSize() {
        return 64;
    }

    static get signatureType() {
        return Uint8Array;
    }

    // Light hash implementation using SHA-256 with WebCrypto API and fast-sha256 fallback
    //
    // static get sha256() { return require('fast-sha256'); }
    //
    // static async hashLight(arr) {
    //     if (Crypto.lib) {
    //         return new Uint8Array(await Crypto.lib.digest('SHA-256', arr));
    //     } else {
    //         return new Promise((res) => {
    //             // Performs badly, but better than a dead UI
    //             setTimeout(() => {
    //                 res(new Crypto.sha256.Hash().update(arr).digest());
    //             });
    //         });
    //     }
    // }


    // Light hash implementation using blake2b via WebAssembly WebWorker
    static async hashLight(arr) {
        const worker = await Crypto._cryptoWorkerSync();
        return worker.computeLightHash(arr);
    }

    // Light hash implementation using SHA-256 with WebCrypto API
    // static async hashLight(arr) {
    //     return new Uint8Array(await Crypto.lib.digest('SHA-256', arr));
    // }

    // Hard hash implementation using Argon2 via WebAssembly WebWorker
    static async hashHard(arr) {
        const worker = await Crypto._cryptoWorkerAsync();
        return worker.computeHardHash(arr);
    }

    static async hashHardBatch(arrarr) {
        const worker = await Crypto._cryptoWorkerAsync();
        return worker.computeHardHashBatch(arrarr);
    }

    /**
     * @param {Array.<BlockHeader>} headers
     * @return {Promise.<void>}
     */
    static async manyPow(headers) {
        const worker = await Crypto._cryptoWorkerAsync();
        const size = worker.poolSize || 1;
        let partitions = [];
        let j = 0;
        for (let i = 0; i < size; ++i) {
            partitions.push([]);
            for (; j < ((i + 1) / size) * headers.length; ++j) {
                partitions[i].push(headers[j].serialize());
            }
        }
        const promises = [];
        for (const part of partitions) {
            promises.push(worker.computeHardHashBatch(part));
        }
        const pows = (await Promise.all(promises)).reduce((a, b) => [...a, ...b], []);
        for(let i = 0; i < headers.length; ++i) {
            headers[i]._pow = new Hash(pows[i]);
        }
    }

    // Hard hash implementation using double light hash
    //static async hashHard(arr) {
    //    return Crypto.hashLight(await Crypto.hashLight(arr));
    //}

    // Hard hash implementation using light hash
    // static async hashHard(arr) {
    //     if (Crypto.lib._nimiq_callDigestDelayedWhenMining) {
    //         return await new Promise((resolve, error) => {
    //             window.setTimeout(() => {
    //                 Crypto.hashLight(arr).then(resolve);
    //             });
    //         });
    //     } else {
    //         return Crypto.hashLight(arr);
    //     }
    // }

    static get hashSize() {
        return 32;
    }

    static get hashType() {
        return Uint8Array;
    }
}

/** @type {CryptoWorker} */
Crypto._cryptoWorkerPromise = null;
Class.register(Crypto);
