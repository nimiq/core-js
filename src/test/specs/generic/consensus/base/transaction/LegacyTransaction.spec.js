describe('LegacyTransaction', () => {
    const senderPubKey = PublicKey.unserialize(BufferUtils.fromBase64(Dummy.publicKey1));
    let senderAddress = null;
    const recipientAddr = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));
    const value = 1;
    const fee = 1;
    const nonce = 1;
    const signature = Signature.unserialize(BufferUtils.fromBase64(Dummy.signature1));

    beforeAll((done) => {
        (async () => {
            await Crypto.prepareSyncCryptoWorker();
            senderAddress = senderPubKey.toAddressSync();
        })().then(done, done.fail);
    });

    it('is 139 bytes long', () => {

        //   2 bytes version
        //   1 byte  type
        //  32 bytes senderPubKey
        //  20 bytes recipient
        //   8 bytes value
        //   8 bytes fee
        //   4 bytes nonce
        //  64 bytes signature
        // ----------------------------
        // 139 bytes

        const transaction1 = new LegacyTransaction(senderPubKey, recipientAddr, value, fee, nonce, signature);
        const serialized = transaction1.serialize();
        expect(serialized.byteLength).toBe(139);
        expect(transaction1.serializedSize).toBe(139);
    });

    it('must have a well defined signature (64 bytes)', () => {
        // expect( () => {
        //     const test1 = new LegacyTransaction(senderPubKey,recipientAddr,value,fee,nonce, undefined);
        // }).toThrow('Malformed signature');
        expect(() => {
            const test2 = new LegacyTransaction(senderPubKey, recipientAddr, value, fee, nonce, null);
        }).toThrowError('Malformed signature');
        expect(() => {
            const test3 = new LegacyTransaction(senderPubKey, recipientAddr, value, fee, nonce, true);
        }).toThrowError('Malformed signature');
        expect(() => {
            const test4 = new LegacyTransaction(senderPubKey, recipientAddr, value, fee, nonce, -20);
        }).toThrowError('Malformed signature');
        expect(() => {
            const test5 = new LegacyTransaction(senderPubKey, recipientAddr, value, fee, nonce, new Uint8Array(64));
        }).toThrowError('Malformed signature');
        expect(() => {
            const test5 = new LegacyTransaction(senderPubKey, recipientAddr, value, fee, nonce, new ArrayBuffer(64));
        }).toThrowError('Malformed signature');
    });

    it('must have a well defined senderPubKey (32 bytes)', () => {
        expect(() => {
            const test1 = new LegacyTransaction(undefined, recipientAddr, value, fee, nonce, signature);
        }).toThrowError('Malformed senderPubKey');
        expect(() => {
            const test2 = new LegacyTransaction(null, recipientAddr, value, fee, nonce, signature);
        }).toThrowError('Malformed senderPubKey');
        expect(() => {
            const test3 = new LegacyTransaction(true, recipientAddr, value, fee, nonce, signature);
        }).toThrowError('Malformed senderPubKey');
        expect(() => {
            const test4 = new LegacyTransaction(new Address(new Uint8Array(20)), recipientAddr, value, fee, nonce, signature);
        }).toThrowError('Malformed senderPubKey');
        expect(() => {
            const test5 = new LegacyTransaction(new Signature(new Uint8Array(Crypto.signatureSize)), recipientAddr, value, fee, nonce, signature);
        }).toThrowError('Malformed senderPubKey');
        expect(() => {
            const test5 = new LegacyTransaction(new Uint8Array(32), recipientAddr, value, fee, nonce, signature);
        }).toThrowError('Malformed senderPubKey');
        expect(() => {
            const test5 = new LegacyTransaction(new ArrayBuffer(32), recipientAddr, value, fee, nonce, signature);
        }).toThrowError('Malformed senderPubKey');
    });

    it('must have a well defined recipient (20 bytes)', () => {
        expect(() => {
            const test1 = new LegacyTransaction(senderPubKey, undefined, value, fee, nonce, signature);
        }).toThrowError('Malformed recipient');
        expect(() => {
            const test2 = new LegacyTransaction(senderPubKey, null, value, fee, nonce, signature);
        }).toThrowError('Malformed recipient');
        expect(() => {
            const test3 = new LegacyTransaction(senderPubKey, true, value, fee, nonce, signature);
        }).toThrowError('Malformed recipient');
        expect(() => {
            const test4 = new LegacyTransaction(senderPubKey, new PublicKey(new Uint8Array(Crypto.publicKeySize)), value, fee, nonce, signature);
        }).toThrowError('Malformed recipient');
        expect(() => {
            const test5 = new LegacyTransaction(senderPubKey, new Signature(new Uint8Array(Crypto.signatureSize)), value, fee, nonce, signature);
        }).toThrowError('Malformed recipient');
        expect(() => {
            const test5 = new LegacyTransaction(senderPubKey, new Uint8Array(20), value, fee, nonce, signature);
        }).toThrowError('Malformed recipient');
    });

    it('must have a well defined value (8 bytes)', () => {
        expect(() => {
            const test1 = new LegacyTransaction(senderPubKey, recipientAddr, undefined, fee, nonce, signature);
        }).toThrowError('Malformed value');
        expect(() => {
            const test2 = new LegacyTransaction(senderPubKey, recipientAddr, null, fee, nonce, signature);
        }).toThrowError('Malformed value');
        expect(() => {
            const test3 = new LegacyTransaction(senderPubKey, recipientAddr, true, fee, nonce, signature);
        }).toThrowError('Malformed value');
        expect(() => {
            const test4 = new LegacyTransaction(senderPubKey, recipientAddr, -20, fee, nonce, signature);
        }).toThrowError('Malformed value');
        expect(() => {
            const test5 = new LegacyTransaction(senderPubKey, recipientAddr, 0, fee, nonce, signature);
        }).toThrowError('Malformed value');
        expect(() => {
            const test5 = new LegacyTransaction(senderPubKey, recipientAddr, new Uint8Array(20), fee, nonce, signature);
        }).toThrowError('Malformed value');
        expect(() => {
            const test5 = new LegacyTransaction(senderPubKey, recipientAddr, Number.MAX_SAFE_INTEGER + 1, fee, nonce, signature);
        }).toThrowError('Malformed value');
    });

    it('must have a well defined fee (8 bytes)', () => {
        expect(() => {
            const test1 = new LegacyTransaction(senderPubKey, recipientAddr, value, undefined, nonce, signature);
        }).toThrowError('Malformed fee');
        expect(() => {
            const test2 = new LegacyTransaction(senderPubKey, recipientAddr, value, null, nonce, signature);
        }).toThrowError('Malformed fee');
        expect(() => {
            const test3 = new LegacyTransaction(senderPubKey, recipientAddr, value, true, nonce, signature);
        }).toThrowError('Malformed fee');
        expect(() => {
            const test4 = new LegacyTransaction(senderPubKey, recipientAddr, value, -20, nonce);
        }).toThrowError('Malformed fee');
        expect(() => {
            const test5 = new LegacyTransaction(senderPubKey, recipientAddr, value, new Uint8Array(20), nonce, signature);
        }).toThrowError('Malformed fee');
        expect(() => {
            const test5 = new LegacyTransaction(senderPubKey, recipientAddr, value, Number.MAX_SAFE_INTEGER + 1, nonce, signature);
        }).toThrowError('Malformed fee');
    });

    it('must have a well defined nonce (4 bytes)', () => {
        expect(() => {
            const test1 = new LegacyTransaction(senderPubKey, recipientAddr, value, fee, undefined, signature);
        }).toThrowError('Malformed nonce');
        expect(() => {
            const test2 = new LegacyTransaction(senderPubKey, recipientAddr, value, fee, null, signature);
        }).toThrowError('Malformed nonce');
        expect(() => {
            const test3 = new LegacyTransaction(senderPubKey, recipientAddr, value, fee, true, signature);
        }).toThrowError('Malformed nonce');
        expect(() => {
            const test4 = new LegacyTransaction(senderPubKey, recipientAddr, value, fee, -20, signature);
        }).toThrowError('Malformed nonce');
        expect(() => {
            const test5 = new LegacyTransaction(senderPubKey, recipientAddr, value, fee, new Uint8Array(20), signature);
        }).toThrowError('Malformed nonce');
        expect(() => {
            const test5 = new LegacyTransaction(senderPubKey, recipientAddr, value, fee, Number.MAX_SAFE_INTEGER - 1, signature);
        }).toThrowError('Malformed nonce');

    });

    it('is correctly created', () => {
        const tx1 = new LegacyTransaction(senderPubKey, recipientAddr, value, fee, nonce, signature);

        expect(tx1.type).toEqual(Transaction.Type.LEGACY);
        expect(tx1.senderPubKey.equals(senderPubKey)).toEqual(true);
        expect(tx1.recipient.equals(recipientAddr)).toEqual(true);
        expect(tx1.value).toEqual(value);
        expect(tx1.fee).toEqual(fee);
        expect(tx1.nonce).toEqual(nonce);
        expect(tx1.signature.equals(signature)).toBeTruthy();
    });

    it('is serializable and unserializable', () => {
        const tx1 = new LegacyTransaction(senderPubKey, recipientAddr, value, fee, nonce, signature);
        const tx2 = Transaction.unserialize(tx1.serialize());

        expect(tx2.type).toEqual(Transaction.Type.LEGACY);
        expect(tx2.senderPubKey.equals(senderPubKey)).toEqual(true);
        expect(tx2.recipient.equals(recipientAddr)).toEqual(true);
        expect(tx2.value).toEqual(value);
        expect(tx2.fee).toEqual(fee);
        expect(tx2.nonce).toEqual(nonce);
        expect(tx2.signature.equals(signature)).toBeTruthy();
    });

    it('can falsify an invalid signature', (done) => {
        (async function () {
            const tx1 = new LegacyTransaction(senderPubKey, recipientAddr, value, fee, nonce, signature);
            expect(await tx1.verifySignature()).toBeFalsy();
        })().then(done, done.fail);
    });

    it('can verify a valid signature', (done) => {
        (async function () {
            const users = await TestBlockchain.getUsers(2);
            const tx = await TestBlockchain.createLegacyTransaction(users[0].publicKey, users[1].address, 1000, 20, 0, users[0].privateKey);
            expect(await tx.verify()).toBeTruthy();
        })().then(done, done.fail);
    });

    it('does not allow sender == receiver', (done) => {
        (async function () {
            const users = await TestBlockchain.getUsers(1);
            const tx = await TestBlockchain.createLegacyTransaction(users[0].publicKey, users[0].address, 1000, 20, 0, users[0].privateKey);
            expect(await tx.verify()).toBeFalsy();
        })().then(done, done.fail);
    });

    it('is well-ordered', () => {
        const nonce = 2;
        const tx1 = new LegacyTransaction(senderPubKey, recipientAddr, value, fee, nonce, signature);

        let tx2 = new LegacyTransaction(senderPubKey, recipientAddr, value, fee, nonce, signature);
        expect(tx1.compareBlockOrder(tx2)).toBe(0);
        expect(tx2.compareBlockOrder(tx1)).toBe(0);
        expect(() => tx1.compareAccountOrder(tx2)).toThrow();
        expect(() => tx2.compareAccountOrder(tx1)).toThrow();

        tx2 = new LegacyTransaction(senderPubKey, recipientAddr, value, fee + 1, nonce, signature);
        expect(tx1.compareBlockOrder(tx2)).toBeGreaterThan(0);
        expect(tx2.compareBlockOrder(tx1)).toBeLessThan(0);
        expect(() => tx1.compareAccountOrder(tx2)).toThrow();
        expect(() => tx2.compareAccountOrder(tx1)).toThrow();

        tx2 = new LegacyTransaction(senderPubKey, recipientAddr, value, fee, nonce - 1, signature);
        expect(tx1.compareBlockOrder(tx2)).toBeGreaterThan(0);
        expect(tx2.compareBlockOrder(tx1)).toBeLessThan(0);
        expect(tx1.compareAccountOrder(tx2)).toBeGreaterThan(0);
        expect(tx2.compareAccountOrder(tx1)).toBeLessThan(0);

        tx2 = new LegacyTransaction(senderPubKey, recipientAddr, value + 1, fee, nonce, signature);
        expect(tx1.compareBlockOrder(tx2)).toBeGreaterThan(0);
        expect(tx2.compareBlockOrder(tx1)).toBeLessThan(0);
        expect(() => tx1.compareAccountOrder(tx2)).toThrow();
        expect(() => tx2.compareAccountOrder(tx1)).toThrow();

        tx2 = new LegacyTransaction(PublicKey.unserialize(BufferUtils.fromBase64(Dummy.publicKey2)), recipientAddr, value, fee, nonce, signature);
        expect(tx1.compareBlockOrder(tx2)).not.toBe(0);
        expect(tx2.compareBlockOrder(tx1)).not.toBe(0);
        expect(tx1.compareAccountOrder(tx2)).not.toBe(0);
        expect(tx2.compareAccountOrder(tx1)).not.toBe(0);
    });
});
