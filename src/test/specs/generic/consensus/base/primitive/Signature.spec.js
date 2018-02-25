describe('Signature', () => {

    it('is 64 bytes long', () => {
        const signature1 = Signature.unserialize(BufferUtils.fromBase64(Dummy.signature1));

        expect(signature1.serializedSize).toEqual(64);

        expect(() => {
            const sign = new Signature(new Uint8Array(16));
        }).toThrow(new Error('Primitive: Invalid length'));

        expect(() => {
            const sign = new Signature('wrong test string');
        }).toThrow(new Error('Primitive: Invalid type'));

        expect(() => {
            const sign = new Signature(new Uint8Array(65));
        }).toThrow(new Error('Primitive: Invalid length'));
    });

    it('has an equals method', () => {
        const signature1 = Signature.unserialize(BufferUtils.fromBase64(Dummy.signature1));
        const signature2 = Signature.unserialize(BufferUtils.fromBase64(Dummy.signature2));

        expect(signature1.equals(signature1)).toEqual(true);
        expect(signature2.equals(signature2)).toEqual(true);
        expect(signature1.equals(signature2)).toEqual(false);
        expect(signature1.equals(null)).toEqual(false);
        expect(signature1.equals(1)).toEqual(false);
    });


    it('is serializable and unserializable', () => {
        const signature1 = Signature.unserialize(BufferUtils.fromBase64(Dummy.signature1));
        const signature2 = Signature.unserialize(signature1.serialize());

        expect(signature2.toBase64()).toEqual(Dummy.signature1);
        expect(signature2.toBase64()).toEqual(Dummy.signature1);
    });

    it('can be used to sign and verify with a given public key', (done) => {
        const keyPair = KeyPair.generate();
        const data = new Uint8Array([1, 2, 3, 4, 5, 6]);
        const signature = Signature.create(keyPair.privateKey, keyPair.publicKey, data);
        expect(signature.verify(keyPair.publicKey, data)).toBe(true);
        done();
    });

    it('can serialize, unserialize keys and use them afterwards', (done) => {
        (async function () {
            const keyPair = KeyPair.generate();
            const data = new Uint8Array([1, 2, 3]);
            const data2 = new Uint8Array([1, 2, 4]);
            const privateSerialized = keyPair.privateKey.serialize();
            const publicSerialized = keyPair.publicKey.serialize();
            const sign = Signature.create(keyPair.privateKey, keyPair.publicKey, data);
            const verify = sign.verify(keyPair.publicKey, data);
            const falsify = sign.verify(keyPair.publicKey, data2);

            const privateUnserialized = PrivateKey.unserialize(privateSerialized);
            const publicUnserialized = PublicKey.unserialize(publicSerialized);

            const verify2 = sign.verify(publicUnserialized, data);
            expect(verify2).toBe(verify);

            const falsify2 = sign.verify(publicUnserialized, data2);
            expect(falsify2).toBe(falsify);

            const sign2 = Signature.create(privateUnserialized, publicUnserialized, data);
            expect(sign2.length).toBe(sign.length);
        })().then(done, done.fail);
    });

    it('can verify RFC8032 test vectors', (done) => {
        // For the test vectors see https://tools.ietf.org/html/rfc8032#page-24
        // For a test of all test vectors see: https://github.com/danimoh/ed25519/tree/master/test
        function hexToBytes(hexString) {
            const byteCount = hexString.length / 2; // 2 hex chars per byte
            const result = new Uint8Array(byteCount);
            for (let i=0; i<byteCount; ++i) {
                result[i] = parseInt(hexString.substr(i * 2, 2), 16);
            }
            return result;
        }

        (async function () {
            const testCases = [
                {
                    priv: '9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60',
                    pub: 'd75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a',
                    sig: 'e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b',
                    msg: ''
                }, {
                    priv: '4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4fb8a6fb',
                    pub: '3d4017c3e843895a92b70aa74d1b7ebc9c982ccf2ec4968cc0cd55f12af4660c',
                    sig: '92a009a9f0d4cab8720e820b5f642540a2b27b5416503f8fb3762223ebdb69da085ac1e43e15996e458f3613d0f11d8c387b2eaeb4302aeeb00d291612bb0c00',
                    msg: '72'
                }, {
                    priv: 'c5aa8df43f9f837bedb7442f31dcb7b166d38535076f094b85ce3a2e0b4458f7',
                    pub: 'fc51cd8e6218a1a38da47ed00230f0580816ed13ba3303ac5deb911548908025',
                    sig: '6291d657deec24024827e69c3abe01a30ce548a284743a445e3680d7db5ac3ac18ff9b538d16f290ae67f760984dc6594a7c15e9716ed28dc027beceea1ec40a',
                    msg: 'af82'
                }, {
                    priv: 'f5e5767cf153319517630f226876b86c8160cc583bc013744c6bf255f5cc0ee5',
                    pub: '278117fc144c72340f67d0f2316e8386ceffbf2b2428c9c51fef7c597f1d426e',
                    sig: '0aab4c900501b3e24d7cdf4663326a3a87df5e4843b2cbdb67cbf6e460fec350aa5371b1508f9f4528ecea23c436d94b5e8fcd4f681e30a6ac00a9704a188a03',
                    msg: '08b8b2b733424243760fe426a4b54908632110a66c2f6591eabd3345e3e4eb98fa6e264bf09efe12ee50f8f54e9f77b1e355f6c50544e23fb1433ddf73be84d879de7c0046dc4996d9e773f4bc9efe5738829adb26c81b37c93a1b270b20329d658675fc6ea534e0810a4432826bf58c941efb65d57a338bbd2e26640f89ffbc1a858efcb8550ee3a5e1998bd177e93a7363c344fe6b199ee5d02e82d522c4feba15452f80288a821a579116ec6dad2b3b310da903401aa62100ab5d1a36553e06203b33890cc9b832f79ef80560ccb9a39ce767967ed628c6ad573cb116dbefefd75499da96bd68a8a97b928a8bbc103b6621fcde2beca1231d206be6cd9ec7aff6f6c94fcd7204ed3455c68c83f4a41da4af2b74ef5c53f1d8ac70bdcb7ed185ce81bd84359d44254d95629e9855a94a7c1958d1f8ada5d0532ed8a5aa3fb2d17ba70eb6248e594e1a2297acbbb39d502f1a8c6eb6f1ce22b3de1a1f40cc24554119a831a9aad6079cad88425de6bde1a9187ebb6092cf67bf2b13fd65f27088d78b7e883c8759d2c4f5c65adb7553878ad575f9fad878e80a0c9ba63bcbcc2732e69485bbc9c90bfbd62481d9089beccf80cfe2df16a2cf65bd92dd597b0707e0917af48bbb75fed413d238f5555a7a569d80c3414a8d0859dc65a46128bab27af87a71314f318c782b23ebfe808b82b0ce26401d2e22f04d83d1255dc51addd3b75a2b1ae0784504df543af8969be3ea7082ff7fc9888c144da2af58429ec96031dbcad3dad9af0dcbaaaf268cb8fcffead94f3c7ca495e056a9b47acdb751fb73e666c6c655ade8297297d07ad1ba5e43f1bca32301651339e22904cc8c42f58c30c04aafdb038dda0847dd988dcda6f3bfd15c4b4c4525004aa06eeff8ca61783aacec57fb3d1f92b0fe2fd1a85f6724517b65e614ad6808d6f6ee34dff7310fdc82aebfd904b01e1dc54b2927094b2db68d6f903b68401adebf5a7e08d78ff4ef5d63653a65040cf9bfd4aca7984a74d37145986780fc0b16ac451649de6188a7dbdf191f64b5fc5e2ab47b57f7f7276cd419c17a3ca8e1b939ae49e488acba6b965610b5480109c8b17b80e1b7b750dfc7598d5d5011fd2dcc5600a32ef5b52a1ecc820e308aa342721aac0943bf6686b64b2579376504ccc493d97e6aed3fb0f9cd71a43dd497f01f17c0e2cb3797aa2a2f256656168e6c496afc5fb93246f6b1116398a346f1a641f3b041e989f7914f90cc2c7fff357876e506b50d334ba77c225bc307ba537152f3f1610e4eafe595f6d9d90d11faa933a15ef1369546868a7f3a45a96768d40fd9d03412c091c6315cf4fde7cb68606937380db2eaaa707b4c4185c32eddcdd306705e4dc1ffc872eeee475a64dfac86aba41c0618983f8741c5ef68d3a101e8a3b8cac60c905c15fc910840b94c00a0b9d0'
                }, {
                    // this test case is taken from https://tools.ietf.org/html/rfc8032#page-27
                    priv: '833fe62409237b9d62ec77587520911e9a759cec1d19755b7da901b96dca3d42',
                    pub: 'ec172b93ad5e563bf4932c70e1245034c35467ef2efd4d64ebf819683467e2bf',
                    sig: 'dc2a4459e7369633a52b1bf277839a00201009a3efbf3ecb69bea2186c26b58909351fc9ac90b3ecfdfbc7c66431e0303dca179c138ac17ad9bef1177331a704',
                    msg: 'ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f'
                }
            ];

            for (const testCase of testCases) {
                const privateKey = new PrivateKey(hexToBytes(testCase.priv));
                const referencePublicKey = new PublicKey(hexToBytes(testCase.pub));
                const referenceSignature = new Signature(hexToBytes(testCase.sig));
                const message = hexToBytes(testCase.msg);

                const computedPublicKey = PublicKey.derive(privateKey);
                expect(referencePublicKey.equals(computedPublicKey)).toBe(true, 'calculated wrong public key');

                const computedSignature = Signature.create(privateKey, referencePublicKey, message);
                expect(referenceSignature.equals(computedSignature)).toBe(true, 'calculated wrong signature');

                expect(referenceSignature.verify(referencePublicKey, message)).toBe(true, 'could not verify valid signature');

                // try whether the signature also verifies for a manipulated message
                let forgedMessage;
                if (message.byteLength === 0) {
                    forgedMessage = new Uint8Array([42]);
                } else {
                    // change the last byte as in http://ed25519.cr.yp.to/python/sign.py
                    forgedMessage = new Uint8Array(message);
                    forgedMessage[forgedMessage.length-1]++;
                }
                expect(referenceSignature.verify(referencePublicKey, forgedMessage)).toBe(false, 'Accepted signature for wrong message');

                // try whether a manipulated signature verifies the original message
                // change a single bit of a single byte
                referenceSignature._obj[Math.floor(Math.random() * Signature.SIZE)] ^= 1 << (Math.floor(Math.random() * 8));
                expect(referenceSignature.verify(referencePublicKey, message)).toBe(false, 'Accepted wrong signature');
            }
        })().then(done, done.fail);
    });

    it('can verify custom signature set', (done) => {
        (async function () {
            const testData = [
                [
                    '/wkQNXvCZ5/y1Sw/JjtQP8AliE552VZJxqRmyYqvKoP2HJ+odLyneb3b4f45VlRj/+NGKTpysWVgyMkfdo0zDg==', // signature
                    'W8uW2Jrl/pfj3JfJWWTYVeL2E/TobX+yipKxFLeVfGU=', // pub key
                    'AAF2F6Gc0OZmc8W/5CRs1A0G0Y+s7QK+4oBhQTYHJ8jHr50cj2/StGARCqGkqNKvGoi6xom8JPmxOdsvQUjIfenWztto/gO1+//6q+jM1LHWoTl4BL1Br1HZegAAAEGfUdl4AAAAAAAAAg==' // data
                ],
                [
                    'rA3GsMGnrTTnfSaQM5qcKfxGWeQXvIFIl5TA+DJVTXK+Rm2lkQcF8XIb/fMnMznchRHh/O34n7yxN2F+X5niBg==',
                    'c7+7HyyPJntaosgJJhjtncRiiQx1Qm7xceih1FZukE0=',
                    'AAEAUCcJnHMAKL3oovwLVzrimvAElh5YHi07RQLO4ZXCxdIbEvjxV0ilfWBcq9BObQGyTLhbt04/SaDl2j4XC1mSHouh62k1wVYQkY9TFDgqnJiuvP7nQfKgXyAAAAAAAAAAAAAAAAAAAAE='
                ]
            ];

            for (const entry of testData) {
                const publicKey = PublicKey.unserialize(BufferUtils.fromBase64(entry[1]));
                const signature = Signature.unserialize(BufferUtils.fromBase64(entry[0]));
                const message = BufferUtils.fromBase64(entry[2]);
                expect(signature.verify(publicKey, message)).toBeTruthy();
            }
        })().then(done, done.fail);
    });

    it('can sign and verify data', (done) => {
        // http://www.ietf.org/rfc/rfc6090.txt
        (async function () {
            const dataToSign = BufferUtils.fromAscii('test data to sign');
            const keyPair = KeyPair.generate();
            const signature = Signature.create(keyPair.privateKey, keyPair.publicKey, dataToSign);
            expect(signature.verify(keyPair.publicKey, dataToSign)).toBeTruthy();
        })().then(done, done.fail);
    });

    it('can verify serialized signature', (done) => {
        (async function () {
            const dataToSign = BufferUtils.fromAscii('test data to sign');
            const keyPair = KeyPair.generate();
            let signature = Signature.create(keyPair.privateKey, keyPair.publicKey, dataToSign);
            signature = Signature.unserialize(signature.serialize());
            const proof = signature.verify(keyPair.publicKey, dataToSign);
            expect(proof).toEqual(true);
        })().then(done, done.fail);
    });

    it('can detect wrong signatures', (done) => {
        (async function () {
            const dataToSign = BufferUtils.fromAscii('test data to sign');
            const wrongData = BufferUtils.fromAscii('wrong test data to sign');
            const keyPair = KeyPair.generate();
            const signature = Signature.create(keyPair.privateKey, keyPair.publicKey, dataToSign);
            const proof = signature.verify(keyPair.publicKey, wrongData);
            expect(proof).toEqual(false);
        })().then(done, done.fail);
    });

    it('correctly aggregates partial signatures', (done) => {
        (async function () {
            for (const testCase of Dummy.partialSignatureTestVectors) {
                const aggSignatures = Signature._aggregatePartialSignatures(testCase.partialSignatures);
                expect(BufferUtils.equals(aggSignatures, testCase.aggSignature)).toBe(true);
            }
        })().then(done, done.fail);
    });

    it('correctly combines partial signatures', (done) => {
        (async function () {
            for (const testCase of Dummy.partialSignatureTestVectors) {
                const aggPartialSig = Signature._combinePartialSignatures(testCase.aggCommitment, testCase.partialSignatures);
                expect(BufferUtils.equals(aggPartialSig, testCase.signature)).toBe(true, 'could not compute signature correctly');
                const result = Signature._signatureVerify(testCase.aggPubKey, testCase.message, aggPartialSig);
                expect(result).toBe(true, 'could not verify signature');
            }
        })().then(done, done.fail);
    });

    it('can create valid delinearized multisignatures', (done) => {
        (async function () {
            const message = BufferUtils.fromAscii('to be authenticated');
            const pubKeys = [], privKeys = [], secrets = [], commitments = [], partialSignatures = [];
            for (let i = 0; i < 3; ++i) {
                const keyPair = KeyPair.generate();
                const nonce = CommitmentPair.generate();

                // pubKeys.push(Dummy.partialSignatureTestVectors[3].pubKeys[i]);
                // privKeys.push(Dummy.partialSignatureTestVectors[3].privKeys[i]);
                pubKeys.push(keyPair.publicKey);
                privKeys.push(keyPair.privateKey);
                secrets.push(nonce.secret);
                commitments.push(nonce.commitment);
            }
            const aggCommitment = Commitment.sum(commitments);
            const aggPubKey = PublicKey._delinearizeAndAggregatePublicKeys(pubKeys);

            for (let i = 0; i < 3; ++i) {
                const partialSignature = PartialSignature.create(privKeys[i], pubKeys[i], pubKeys, secrets[i], aggCommitment, message);
                partialSignatures.push(partialSignature);
            }
            const signature = Signature.fromPartialSignatures(aggCommitment, partialSignatures);

            expect(signature.verify(aggPubKey, message)).toBeTruthy();
        })().then(done, done.fail);
    });
});
