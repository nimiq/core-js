describe('HashedTimeLockedContract', () => {
    const recipient = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));
    const sender = Address.unserialize(BufferUtils.fromBase64(Dummy.address2));

    beforeAll((done) => {
        Crypto.prepareSyncCryptoWorker().then(done, done.fail);
    });

    it('can serialize and unserialize itself', () => {
        const account = new HashedTimeLockedContract(1000, 1, sender, recipient, Hash.NULL, 42, 1000, 800);
        const account2 = /** @type {HashedTimeLockedContract} */ Account.unserialize(account.serialize());

        expect(account2 instanceof HashedTimeLockedContract).toBeTruthy();
        expect(account2.type).toEqual(account.type);
        expect(account2.balance).toEqual(account.balance);
        expect(account2.nonce).toEqual(account.nonce);
        expect(account2.recipient.equals(account.recipient)).toBeTruthy();
        expect(account2.sender.equals(account.sender)).toBeTruthy();
        expect(account2.hashRoot.equals(account.hashRoot)).toBeTruthy();
        expect(account2.hashCount).toEqual(account.hashCount);
        expect(account2.totalAmount).toEqual(account.totalAmount);
        expect(account2.timeout).toEqual(account.timeout);
    });

    it('will deny incoming transaction after creation', () => {
        const account = new HashedTimeLockedContract();
        const transaction = new ExtendedTransaction(Address.NULL, Account.Type.BASIC, Address.NULL, Account.Type.BASIC, 1000, 0, 0, new Uint8Array(0));
        expect(() => account.withIncomingTransaction(transaction, 1)).toThrowError('Data Error!');
    });

    it('can falsify invalid outgoing transaction', (done) => {
        (async () => {
            const keyPair = await KeyPair.generate();
            const addr = await keyPair.publicKey.toAddress();

            // No proof
            let transaction = new ExtendedTransaction(sender, Account.Type.HTLC, addr, Account.Type.BASIC, 100, 0, 0, new Uint8Array(0));
            expect(await HashedTimeLockedContract.verifyOutgoingTransaction(transaction)).toBeFalsy();

            // regular: invalid pre-image
            let signatureProof = new SignatureProof(keyPair.publicKey, new MerklePath([]), await Signature.create(keyPair.privateKey, keyPair.publicKey, transaction.serializeContent()));
            let proof = new SerialBuffer(2 + 2 * Crypto.hashSize + signatureProof.serializedSize);
            proof.writeUint8(HashedTimeLockedContract.ProofType.REGULAR_TRANSFER);
            proof.writeUint8(1);
            Hash.NULL.serialize(proof);
            Hash.NULL.serialize(proof);
            signatureProof.serialize(proof);
            transaction.proof = proof;
            expect(await HashedTimeLockedContract.verifyOutgoingTransaction(transaction)).toBeFalsy();

            // regular: invalid signature
            proof = new SerialBuffer(2 + 2 * Crypto.hashSize + signatureProof.serializedSize);
            proof.writeUint8(HashedTimeLockedContract.ProofType.REGULAR_TRANSFER);
            proof.writeUint8(1);
            (await Hash.light(Hash.NULL.serialize())).serialize(proof);
            Hash.NULL.serialize(proof);
            transaction.proof = proof;
            expect(await HashedTimeLockedContract.verifyOutgoingTransaction(transaction)).toBeFalsy();

            // early resolve: invalid second signature
            proof = new SerialBuffer(1 + Address.SERIALIZED_SIZE + 2 * signatureProof.serializedSize);
            proof.writeUint8(HashedTimeLockedContract.ProofType.EARLY_RESOLVE);
            addr.serialize(proof);
            signatureProof.serialize(proof);
            transaction.proof = proof;
            expect(await HashedTimeLockedContract.verifyOutgoingTransaction(transaction)).toBeFalsy();

            // early resolve: invalid first signature
            proof = new SerialBuffer(1 + Address.SERIALIZED_SIZE + 2 * signatureProof.serializedSize);
            proof.writeUint8(HashedTimeLockedContract.ProofType.EARLY_RESOLVE);
            addr.serialize(proof);
            proof.writePos += signatureProof.serializedSize;
            signatureProof.serialize(proof);
            transaction.proof = proof;
            expect(await HashedTimeLockedContract.verifyOutgoingTransaction(transaction)).toBeFalsy();

            // early resolve: mismatch first signature
            proof = new SerialBuffer(1 + Address.SERIALIZED_SIZE + 2 * signatureProof.serializedSize);
            proof.writeUint8(HashedTimeLockedContract.ProofType.EARLY_RESOLVE);
            recipient.serialize(proof);
            signatureProof.serialize(proof);
            signatureProof.serialize(proof);
            transaction.proof = proof;
            expect(await HashedTimeLockedContract.verifyOutgoingTransaction(transaction)).toBeFalsy();

            // timeout resolve: invalid signature
            proof = new SerialBuffer(1 + signatureProof.serializedSize);
            proof.writeUint8(HashedTimeLockedContract.ProofType.TIMEOUT_RESOLVE);
            transaction.proof = proof;
            expect(await HashedTimeLockedContract.verifyOutgoingTransaction(transaction)).toBeFalsy();

            transaction = new ExtendedTransaction(sender, Account.Type.HTLC, recipient, Account.Type.BASIC, 100, 0, 0, new Uint8Array(0));
            signatureProof = new SignatureProof(keyPair.publicKey, new MerklePath([]), await Signature.create(keyPair.privateKey, keyPair.publicKey, transaction.serializeContent()));

            // timeout resolve: mismatch signature
            proof = new SerialBuffer(1 + signatureProof.serializedSize);
            proof.writeUint8(HashedTimeLockedContract.ProofType.TIMEOUT_RESOLVE);
            signatureProof.serialize(proof);
            transaction.proof = proof;
            expect(await HashedTimeLockedContract.verifyOutgoingTransaction(transaction)).toBeFalsy();

            // early resolve: mismatch second signature
            proof = new SerialBuffer(1 + Address.SERIALIZED_SIZE + 2 * signatureProof.serializedSize);
            proof.writeUint8(HashedTimeLockedContract.ProofType.EARLY_RESOLVE);
            addr.serialize(proof);
            signatureProof.serialize(proof);
            signatureProof.serialize(proof);
            transaction.proof = proof;
            expect(await HashedTimeLockedContract.verifyOutgoingTransaction(transaction)).toBeFalsy();

            // regular: mismatch signature
            proof = new SerialBuffer(2 + 2 * Crypto.hashSize + signatureProof.serializedSize);
            proof.writeUint8(HashedTimeLockedContract.ProofType.REGULAR_TRANSFER);
            proof.writeUint8(1);
            (await Hash.light(Hash.NULL.serialize())).serialize(proof);
            Hash.NULL.serialize(proof);
            signatureProof.serialize(proof);
            transaction.proof = proof;
            expect(await HashedTimeLockedContract.verifyOutgoingTransaction(transaction)).toBeFalsy();
        })().then(done, done.fail);
    });

    it('can verify valid outgoing transaction', (done) => {
        (async () => {
            const keyPair = await KeyPair.generate();
            const addr = await keyPair.publicKey.toAddress();
            const transaction = new ExtendedTransaction(sender, Account.Type.HTLC, addr, Account.Type.BASIC, 100, 0, 0, new Uint8Array(0));

            // regular
            const signatureProof = new SignatureProof(keyPair.publicKey, new MerklePath([]), await Signature.create(keyPair.privateKey, keyPair.publicKey, transaction.serializeContent()));
            let proof = new SerialBuffer(2 + 2 * Crypto.hashSize + signatureProof.serializedSize);
            proof.writeUint8(HashedTimeLockedContract.ProofType.REGULAR_TRANSFER);
            proof.writeUint8(1);
            (await Hash.light(Hash.NULL.serialize())).serialize(proof);
            Hash.NULL.serialize(proof);
            signatureProof.serialize(proof);
            transaction.proof = proof;
            expect(await HashedTimeLockedContract.verifyOutgoingTransaction(transaction)).toBeTruthy();

            // early resolve
            proof = new SerialBuffer(1 + Address.SERIALIZED_SIZE + 2 * signatureProof.serializedSize);
            proof.writeUint8(HashedTimeLockedContract.ProofType.EARLY_RESOLVE);
            addr.serialize(proof);
            signatureProof.serialize(proof);
            signatureProof.serialize(proof);
            transaction.proof = proof;
            expect(await HashedTimeLockedContract.verifyOutgoingTransaction(transaction)).toBeTruthy();

            // timeout resolve
            proof = new SerialBuffer(1 + signatureProof.serializedSize);
            proof.writeUint8(HashedTimeLockedContract.ProofType.TIMEOUT_RESOLVE);
            signatureProof.serialize(proof);
            transaction.proof = proof;
            expect(await HashedTimeLockedContract.verifyOutgoingTransaction(transaction)).toBeTruthy();
        })().then(done, done.fail);
    });

    it('can redeem funds regularly before timeout', (done) => {
        (async () => {
            const keyPair = await KeyPair.generate();
            const addr = await keyPair.publicKey.toAddress();
            const hashRoot = await Hash.light(Hash.NULL.serialize());
            const transaction = new ExtendedTransaction(recipient, Account.Type.HTLC, addr, Account.Type.BASIC, 100, 0, 0, new Uint8Array(0));
            const account = new HashedTimeLockedContract(1000, 0, sender, addr, hashRoot, 1, 1000, 1000);
            const signatureProof = new SignatureProof(keyPair.publicKey, new MerklePath([]), await Signature.create(keyPair.privateKey, keyPair.publicKey, transaction.serializeContent()));
            const proof = new SerialBuffer(2 + 2 * Crypto.hashSize + signatureProof.serializedSize);
            proof.writeUint8(HashedTimeLockedContract.ProofType.REGULAR_TRANSFER);
            proof.writeUint8(1);
            hashRoot.serialize(proof);
            Hash.NULL.serialize(proof);
            signatureProof.serialize(proof);
            transaction.proof = proof;
            expect(await HashedTimeLockedContract.verifyOutgoingTransaction(transaction)).toBeTruthy();
            expect(() => account.withOutgoingTransaction(transaction, 2000)).toThrowError();
            const account2 = account.withOutgoingTransaction(transaction, 100);
            expect(account2.balance).toBe(900);
            expect(account2.nonce).toBe(1);
        })().then(done, done.fail);
    });

    it('blocks regular redemption of too many funds', (done) => {
        (async () => {
            const keyPair = await KeyPair.generate();
            const addr = await keyPair.publicKey.toAddress();
            const hashRoot = await Hash.light(Hash.NULL.serialize());
            const transaction = new ExtendedTransaction(recipient, Account.Type.HTLC, addr, Account.Type.BASIC, 600, 0, 0, new Uint8Array(0));
            const account = new HashedTimeLockedContract(1000, 0, sender, addr, hashRoot, 2, 1000, 1000);
            const signatureProof = new SignatureProof(keyPair.publicKey, new MerklePath([]), await Signature.create(keyPair.privateKey, keyPair.publicKey, transaction.serializeContent()));
            const proof = new SerialBuffer(2 + 2 * Crypto.hashSize + signatureProof.serializedSize);
            proof.writeUint8(HashedTimeLockedContract.ProofType.REGULAR_TRANSFER);
            proof.writeUint8(1);
            hashRoot.serialize(proof);
            Hash.NULL.serialize(proof);
            signatureProof.serialize(proof);
            transaction.proof = proof;
            expect(await HashedTimeLockedContract.verifyOutgoingTransaction(transaction)).toBeTruthy();
            expect(() => account.withOutgoingTransaction(transaction, 100)).toThrowError();
        })().then(done, done.fail);
    });

    it('correctly allows to resolve after timeout', (done) => {
        (async () => {
            const keyPair = await KeyPair.generate();
            const addr = await keyPair.publicKey.toAddress();
            const hashRoot = await Hash.light(Hash.NULL.serialize());
            const transaction = new ExtendedTransaction(sender, Account.Type.HTLC, addr, Account.Type.BASIC, 100, 0, 0, new Uint8Array(0));
            const account = new HashedTimeLockedContract(1000, 0, addr, recipient, hashRoot, 1, 1000, 1000);
            const signatureProof = new SignatureProof(keyPair.publicKey, new MerklePath([]), await Signature.create(keyPair.privateKey, keyPair.publicKey, transaction.serializeContent()));
            const proof = new SerialBuffer(1 + signatureProof.serializedSize);
            proof.writeUint8(HashedTimeLockedContract.ProofType.TIMEOUT_RESOLVE);
            signatureProof.serialize(proof);
            transaction.proof = proof;
            expect(await HashedTimeLockedContract.verifyOutgoingTransaction(transaction)).toBeTruthy();
            expect(() => account.withOutgoingTransaction(transaction, 500)).toThrowError();
            const account2 = account.withOutgoingTransaction(transaction, 2000);
            expect(account2.balance).toBe(900);
            expect(account2.nonce).toBe(1);
        })().then(done, done.fail);
    });

    it('correctly allows to resolve before timeout', (done) => {
        (async () => {
            const keyPair = await KeyPair.generate();
            const addr = await keyPair.publicKey.toAddress();
            const hashRoot = await Hash.light(Hash.NULL.serialize());
            const transaction = new ExtendedTransaction(sender, Account.Type.HTLC, addr, Account.Type.BASIC, 100, 0, 0, new Uint8Array(0));
            const account = new HashedTimeLockedContract(1000, 0, addr, addr, hashRoot, 1, 1000, 1000);
            const signatureProof = new SignatureProof(keyPair.publicKey, new MerklePath([]), await Signature.create(keyPair.privateKey, keyPair.publicKey, transaction.serializeContent()));
            const proof = new SerialBuffer(1 + Address.SERIALIZED_SIZE + 2 * signatureProof.serializedSize);
            proof.writeUint8(HashedTimeLockedContract.ProofType.EARLY_RESOLVE);
            addr.serialize(proof);
            signatureProof.serialize(proof);
            signatureProof.serialize(proof);
            transaction.proof = proof;
            expect(await HashedTimeLockedContract.verifyOutgoingTransaction(transaction)).toBeTruthy();
            const account2 = account.withOutgoingTransaction(transaction, 100);
            expect(account2.balance).toBe(900);
            expect(account2.nonce).toBe(1);
            const account3 = new HashedTimeLockedContract(1000, 0, addr, recipient, hashRoot, 1, 1000, 1000);
            expect(() => account3.withOutgoingTransaction(transaction, 100)).toThrowError();
        })().then(done, done.fail);
    });

    it('can create contract from transaction', () => {
        const preContract = new HashedTimeLockedContract(100, 0, sender, recipient, Hash.NULL, 2, 1000);
        const data = new SerialBuffer(Address.SERIALIZED_SIZE + Crypto.hashSize + 5);
        recipient.serialize(data);
        Hash.NULL.serialize(data);
        data.writeUint8(2);
        data.writeUint32(1000);
        const transaction = new ExtendedTransaction(sender, Account.Type.HTLC, Address.fromHash(Hash.lightSync(preContract.serialize())), Account.Type.BASIC, 100, 0, 0, data);
        expect(HashedTimeLockedContract.verifyIncomingTransaction(transaction)).toBeTruthy();
        const contract = /** @type {HashedTimeLockedContract} */ HashedTimeLockedContract.INITIAL.withIncomingTransaction(transaction, 1);

        expect(contract.balance).toBe(100);
        expect(contract.nonce).toBe(0);
        expect(contract.sender.equals(sender)).toBeTruthy();
        expect(contract.recipient.equals(recipient)).toBeTruthy();
        expect(contract.hashRoot.equals(Hash.NULL)).toBeTruthy();
        expect(contract.hashCount).toBe(2);
        expect(contract.timeout).toBe(1000);

        expect(contract.withIncomingTransaction(transaction, 1, true)).toBe(HashedTimeLockedContract.INITIAL);
    });
});
