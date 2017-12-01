describe('Transaction', () => {
    const senderPubKey = PublicKey.unserialize(BufferUtils.fromBase64(Dummy.publicKey1));
    const recipientAddr = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));
    const value = 1;
    const fee = 1;
    const nonce = 1;
    const signature = Signature.unserialize(BufferUtils.fromBase64(Dummy.signature1));

    it('is 171 bytes long', () => {

        //   2 bytes version
        //   1 byte  type
        //  32 bytes senderPubKey
        //  20 bytes recipientAddress
        //   8 bytes value
        //   8 bytes fee
        //   4 bytes nonce
        //  64 bytes signature
        // ----------------------------
        // 139 bytes

        const transaction1 = new Transaction(senderPubKey, recipientAddr, value, fee, nonce, signature);
        const serialized = transaction1.serialize();
        expect(serialized.byteLength).toBe(139);
    });

    it('must have a well defined signature (64 bytes)', () => {
        // expect( () => {
        //     const test1 = new Transaction(senderPubKey,recipientAddr,value,fee,nonce, undefined);
        // }).toThrow('Malformed signature');
        expect(() => {
            const test2 = new Transaction(senderPubKey, recipientAddr, value, fee, nonce, null);
        }).toThrow('Malformed signature');
        expect(() => {
            const test3 = new Transaction(senderPubKey, recipientAddr, value, fee, nonce, true);
        }).toThrow('Malformed signature');
        expect(() => {
            const test4 = new Transaction(senderPubKey, recipientAddr, value, fee, nonce, -20);
        }).toThrow('Malformed signature');
        expect(() => {
            const test5 = new Transaction(senderPubKey, recipientAddr, value, fee, nonce, new Uint8Array(64));
        }).toThrow('Malformed signature');
        expect(() => {
            const test5 = new Transaction(senderPubKey, recipientAddr, value, fee, nonce, new ArrayBuffer(64));
        }).toThrow('Malformed signature');
    });

    it('must have a well defined senderPubKey (32 bytes)', () => {
        expect(() => {
            const test1 = new Transaction(undefined, recipientAddr, value, fee, nonce, signature);
        }).toThrow('Malformed senderPubKey');
        expect(() => {
            const test2 = new Transaction(null, recipientAddr, value, fee, nonce, signature);
        }).toThrow('Malformed senderPubKey');
        expect(() => {
            const test3 = new Transaction(true, recipientAddr, value, fee, nonce, signature);
        }).toThrow('Malformed senderPubKey');
        expect(() => {
            const test4 = new Transaction(new Address(new Uint8Array(20)), recipientAddr, value, fee, nonce, signature);
        }).toThrow('Malformed senderPubKey');
        expect(() => {
            const test5 = new Transaction(new Signature(new Uint8Array(Crypto.signatureSize)), recipientAddr, value, fee, nonce, signature);
        }).toThrow('Malformed senderPubKey');
        expect(() => {
            const test5 = new Transaction(new Uint8Array(32), recipientAddr, value, fee, nonce, signature);
        }).toThrow('Malformed senderPubKey');
        expect(() => {
            const test5 = new Transaction(new ArrayBuffer(32), recipientAddr, value, fee, nonce, signature);
        }).toThrow('Malformed senderPubKey');
    });

    it('must have a well defined recipientAddr (20 bytes)', () => {
        expect(() => {
            const test1 = new Transaction(senderPubKey, undefined, value, fee, nonce, signature);
        }).toThrow('Malformed recipientAddr');
        expect(() => {
            const test2 = new Transaction(senderPubKey, null, value, fee, nonce, signature);
        }).toThrow('Malformed recipientAddr');
        expect(() => {
            const test3 = new Transaction(senderPubKey, true, value, fee, nonce, signature);
        }).toThrow('Malformed recipientAddr');
        expect(() => {
            const test4 = new Transaction(senderPubKey, new PublicKey(new Uint8Array(Crypto.publicKeySize)), value, fee, nonce, signature);
        }).toThrow('Malformed recipientAddr');
        expect(() => {
            const test5 = new Transaction(senderPubKey, new Signature(new Uint8Array(Crypto.signatureSize)), value, fee, nonce, signature);
        }).toThrow('Malformed recipientAddr');
        expect(() => {
            const test5 = new Transaction(senderPubKey, new Uint8Array(20), value, fee, nonce, signature);
        }).toThrow('Malformed recipientAddr');
    });

    it('must have a well defined value (8 bytes)', () => {
        expect(() => {
            const test1 = new Transaction(senderPubKey, recipientAddr, undefined, fee, nonce, signature);
        }).toThrowError('Malformed value');
        expect(() => {
            const test2 = new Transaction(senderPubKey, recipientAddr, null, fee, nonce, signature);
        }).toThrowError('Malformed value');
        expect(() => {
            const test3 = new Transaction(senderPubKey, recipientAddr, true, fee, nonce, signature);
        }).toThrowError('Malformed value');
        expect(() => {
            const test4 = new Transaction(senderPubKey, recipientAddr, -20, fee, nonce, signature);
        }).toThrowError('Malformed value');
        expect(() => {
            const test5 = new Transaction(senderPubKey, recipientAddr, 0, fee, nonce, signature);
        }).toThrowError('Malformed value');
        expect(() => {
            const test5 = new Transaction(senderPubKey, recipientAddr, new Uint8Array(20), fee, nonce, signature);
        }).toThrowError('Malformed value');
        expect(() => {
            const test5 = new Transaction(senderPubKey, recipientAddr, Number.MAX_SAFE_INTEGER + 1, fee, nonce, signature);
        }).toThrowError('Malformed value');
    });

    it('must have a well defined fee (8 bytes)', () => {
        expect(() => {
            const test1 = new Transaction(senderPubKey, recipientAddr, value, undefined, nonce);
        }).toThrow('Malformed fee');
        expect(() => {
            const test2 = new Transaction(senderPubKey, recipientAddr, value, null, nonce);
        }).toThrow('Malformed fee');
        expect(() => {
            const test3 = new Transaction(senderPubKey, recipientAddr, value, true, nonce);
        }).toThrow('Malformed fee');
        expect(() => {
            const test4 = new Transaction(senderPubKey, recipientAddr, value, -20, nonce);
        }).toThrow('Malformed fee');
        expect(() => {
            const test5 = new Transaction(senderPubKey, recipientAddr, value, new Uint8Array(20), nonce);
        }).toThrow('Malformed fee');
        expect(() => {
            const test5 = new Transaction(senderPubKey, recipientAddr, value, Number.MAX_SAFE_INTEGER + 1, nonce);
        }).toThrow('Malformed fee');
    });

    it('must have a well defined nonce (4 bytes)', () => {
        expect(() => {
            const test1 = new Transaction(senderPubKey, recipientAddr, value, fee, undefined);
        }).toThrow('Malformed nonce');
        expect(() => {
            const test2 = new Transaction(senderPubKey, recipientAddr, value, fee, null);
        }).toThrow('Malformed nonce');
        expect(() => {
            const test3 = new Transaction(senderPubKey, recipientAddr, value, fee, true);
        }).toThrow('Malformed nonce');
        expect(() => {
            const test4 = new Transaction(senderPubKey, recipientAddr, value, fee, -20);
        }).toThrow('Malformed nonce');
        expect(() => {
            const test5 = new Transaction(senderPubKey, recipientAddr, value, fee, new Uint8Array(20));
        }).toThrow('Malformed nonce');
        expect(() => {
            const test5 = new Transaction(senderPubKey, recipientAddr, value, fee, Number.MAX_SAFE_INTEGER - 1);
        }).toThrow('Malformed nonce');

    });

    it('is serializable and unserializable', () => {
        const tx1 = new Transaction(senderPubKey, recipientAddr, value, fee, nonce, signature);
        const tx2 = Transaction.unserialize(tx1.serialize());

        expect(tx2.senderPubKey.equals(senderPubKey)).toEqual(true);
        expect(tx2.recipientAddr.equals(recipientAddr)).toEqual(true);
        expect(tx2.signature.equals(signature)).toEqual(true);
        expect(tx2.value).toEqual(value);
        expect(tx2.fee).toEqual(fee);
        expect(tx2.nonce).toEqual(nonce);
    });

    it('can falsify an invalid signature', (done) => {
        const tx1 = new Transaction(senderPubKey, recipientAddr, value, fee, nonce, signature);
        tx1.verifySignature()
            .then(isValid => {
                expect(isValid).toBe(false);
                done();
            });
    });

    it('can verify a valid signature', (done) => {
        (async function () {
            const users = await TestBlockchain.getUsers(2);
            const tx = await TestBlockchain.createTransaction(users[0].publicKey, users[1].address, 1000, 20, 0, users[0].privateKey);
            tx.verifySignature()
                .then(isValid => {
                    expect(isValid).toBe(true);
                    done();
                });
        })();
    });

    it('does not allow sender == receiver', (done) => {
        (async function () {
            const users = await TestBlockchain.getUsers(1);
            const tx = await TestBlockchain.createTransaction(users[0].publicKey, users[0].address, 1000, 20, 0, users[0].privateKey);
            tx.verify()
                .then(isValid => {
                    expect(isValid).toBe(false);
                    done();
                });
        })();
    });

    it('is well-ordered', () => {
        const nonce = 2;
        const tx1 = new Transaction(senderPubKey, recipientAddr, value, fee, nonce, signature);

        let tx2 = new Transaction(senderPubKey, recipientAddr, value, fee, nonce, signature);
        expect(tx1.compareBlockOrder(tx2)).toBe(0);
        expect(tx2.compareBlockOrder(tx1)).toBe(0);
        expect(() => tx1.compareAccountOrder(tx2)).toThrow();
        expect(() => tx2.compareAccountOrder(tx1)).toThrow();

        tx2 = new Transaction(senderPubKey, recipientAddr, value, fee + 1, nonce, signature);
        expect(tx1.compareBlockOrder(tx2)).toBeGreaterThan(0);
        expect(tx2.compareBlockOrder(tx1)).toBeLessThan(0);
        expect(() => tx1.compareAccountOrder(tx2)).toThrow();
        expect(() => tx2.compareAccountOrder(tx1)).toThrow();

        tx2 = new Transaction(senderPubKey, recipientAddr, value, fee, nonce - 1, signature);
        expect(tx1.compareBlockOrder(tx2)).toBeGreaterThan(0);
        expect(tx2.compareBlockOrder(tx1)).toBeLessThan(0);
        expect(tx1.compareAccountOrder(tx2)).toBeGreaterThan(0);
        expect(tx2.compareAccountOrder(tx1)).toBeLessThan(0);

        tx2 = new Transaction(senderPubKey, recipientAddr, value + 1, fee, nonce, signature);
        expect(tx1.compareBlockOrder(tx2)).toBeGreaterThan(0);
        expect(tx2.compareBlockOrder(tx1)).toBeLessThan(0);
        expect(() => tx1.compareAccountOrder(tx2)).toThrow();
        expect(() => tx2.compareAccountOrder(tx1)).toThrow();

        tx2 = new Transaction(PublicKey.unserialize(BufferUtils.fromBase64(Dummy.publicKey2)), recipientAddr, value, fee, nonce, signature);
        expect(tx1.compareBlockOrder(tx2)).not.toBe(0);
        expect(tx2.compareBlockOrder(tx1)).not.toBe(0);
        expect(tx1.compareAccountOrder(tx2)).not.toBe(0);
        expect(tx2.compareAccountOrder(tx1)).not.toBe(0);
    });

});
