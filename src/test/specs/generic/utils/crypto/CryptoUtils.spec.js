describe('CryptoUtils', () => {
    it('can correctly compute hmacSha512', () => {
        // Test vectors from https://tools.ietf.org/html/rfc4231
        const vectors = [
            {
                key: '0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b',
                data: '4869205468657265',
                hash: '87aa7cdea5ef619d4ff0b4241a1d6cb02379f4e2ce4ec2787ad0b30545e17cdedaa833b7d6b8a702038b274eaea3f4e4be9d914eeb61f1702e696c203a126854'
            },
            {
                key: '4a656665',
                data: '7768617420646f2079612077616e7420666f72206e6f7468696e673f',
                hash: '164b7a7bfcf819e2e395fbe73b56e0a387bd64222e831fd610270cd7ea2505549758bf75c05a994a6d034f65f8f0e6fdcaeab1a34d4a6b4b636e070a38bce737'
            },
            {
                key: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                data: 'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
                hash: 'fa73b0089d56a284efb0f0756c890be9b1b5dbdd8ee81a3655f83e33b2279d39bf3e848279a722c806b485a47e67c807b946a337bee8942674278859e13292fb'
            },
            {
                key: '0102030405060708090a0b0c0d0e0f10111213141516171819',
                data: 'cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd',
                hash: 'b0ba465637458c6990e5a8c5f61d4af7e576d97ff94b872de76f8050361ee3dba91ca5c11aa25eb4d679275cc5788063a5f19741120c4f2de2adebeb10a298dd'
            },
            {
                key: '0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c',
                data: '546573742057697468205472756e636174696f6e',
                hash: '415fad6271580a531d4179bc891d87a6'
            },
            {
                key: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                data: '54657374205573696e67204c6172676572205468616e20426c6f636b2d53697a65204b6579202d2048617368204b6579204669727374',
                hash: '80b24263c7c1a3ebb71493c1dd7be8b49b46d1f41b4aeec1121b013783f8f3526b56d037e05f2598bd0fd2215d6a1e5295e64f73f63f0aec8b915a985d786598'
            },
            {
                key: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                data: '5468697320697320612074657374207573696e672061206c6172676572207468616e20626c6f636b2d73697a65206b657920616e642061206c6172676572207468616e20626c6f636b2d73697a6520646174612e20546865206b6579206e6565647320746f20626520686173686564206265666f7265206265696e6720757365642062792074686520484d414320616c676f726974686d2e',
                hash: 'e37b6a775dc87dbaa4dfa9f96e5e3ffddebd71f8867289865df5a32d20cdc944b6022cac3c4982b10d5eeb55c3e4de15134676fb6de0446065c97440fa8c6a58'
            },
        ];

        for (let i = 0; i < vectors.length; i++) {
            const vector = vectors[i];
            let hash = BufferUtils.toHex(CryptoUtils.computeHmacSha512(BufferUtils.fromHex(vector.key), BufferUtils.fromHex(vector.data)));
            if (i === 4) hash = hash.substr(0, 32); // Simulate truncated output.
            expect(hash).toBe(vector.hash);
        }
    });

    it('can correctly compute computePBKDF2sha512', () => {
        const vectors = [
            {
                password: 'password',
                salt: 'salt',
                iterations: 1,
                derivedKeyLength: 64,
                derivedKey: '867f70cf1ade02cff3752599a3a53dc4af34c7a669815ae5d513554e1c8cf252c02d470a285a0501bad999bfe943c08f050235d7d68b1da55e63f73b60a57fce',
            },
            {
                password: 'password',
                salt: 'salt',
                iterations: 2,
                derivedKeyLength: 64,
                derivedKey: 'e1d9c16aa681708a45f5c7c4e215ceb66e011a2e9f0040713f18aefdb866d53cf76cab2868a39b9f7840edce4fef5a82be67335c77a6068e04112754f27ccf4e',
            },
            {
                password: 'password',
                salt: 'salt',
                iterations: 2,
                derivedKeyLength: 32,
                derivedKey: 'e1d9c16aa681708a45f5c7c4e215ceb66e011a2e9f0040713f18aefdb866d53c',
            },
            {
                password: 'password',
                salt: 'salt',
                iterations: 4096,
                derivedKeyLength: 64,
                derivedKey: 'd197b1b33db0143e018b12f3d1d1479e6cdebdcc97c5c0f87f6902e072f457b5143f30602641b3d55cd335988cb36b84376060ecd532e039b742a239434af2d5',
            },
            {
                password: 'passwordPASSWORDpassword',
                salt: 'saltSALTsaltSALTsaltSALTsaltSALTsalt',
                iterations: 4096,
                derivedKeyLength: 64,
                derivedKey: '8c0511f4c6e597c6ac6315d8f0362e225f3c501495ba23b868c005174dc4ee71115b59f9e60cd9532fa33e0f75aefe30225c583a186cd82bd4daea9724a3d3b8',
            },
        ];

        for (let i = 0; i < vectors.length; i++) {
            const vector = vectors[i];
            const key = BufferUtils.toHex(CryptoUtils.computePBKDF2sha512(BufferUtils.fromAscii(vector.password), BufferUtils.fromAscii(vector.salt), vector.iterations, vector.derivedKeyLength));
            expect(key).toBe(vector.derivedKey);
        }
    });

    it('can correctly compute legacy otpKdf', async () => {
        const vectors = [
            {
                data: '5643fb247fcd029881fad7f5e0c9434882b58b0a295344663326f67bd1aac430',
                password: 'password',
                salt: 'sixteen chars 01',
                encryptedData: 'e0fbcfa3d8c7d0d692476982c14fe53f669384d038d9ba37fa8baffeba41f8ed',
            },
            {
                data: '588d9f4b46b82520c6dd7af5a776268d1baeb6d3e21b91c6cd53888db0dff9fb',
                password: '12345678',
                salt: 'sixteen chars 02',
                encryptedData: '5863c454e8223c5e7ce4ee8af5f8a8f2b50093d3739fb5cc28377559b26d44c8',
            },
            {
                data: 'e055789cc8b5bd1c6eca0fac181744c3b26e1b095f2971abdc37c3f1faf82a5a',
                password: 'password',
                salt: 'sixteen chars 03',
                encryptedData: '7f6a666beeb8d72683637b9d3fde2477b358eae55067f4e3cc15ca26ec921bd8',
            },
            {
                data: 'c464700afaf363e8fa3d16c285bc5801b62e17a9a6d33b5a147a80700a2fa8ea',
                password: '12345678',
                salt: 'sixteen chars 04',
                encryptedData: 'f48bcc6049a5533d56efc406876db049a2cd9d4a8021612e438d513071182eb5',
            },
            {
                data: '13da41526eab8aa8b618f889b6f80b328c895a0e334b55f935d041206e99b69c',
                password: 'passwordPASSWORDpassword',
                salt: 'sixteen chars 05',
                encryptedData: '1654ff8f4bf52616c82a5af6a99c5b26a466d7c9099a4206895a9334ad44fe79',
            },
        ];

        for (let i = 0; i < vectors.length; i++) {
            const vector = vectors[i];
            const encrypted = BufferUtils.toHex(await CryptoUtils.otpKdfLegacy(BufferUtils.fromHex(vector.data), BufferUtils.fromAscii(vector.password), BufferUtils.fromAscii(vector.salt), 256));
            expect(encrypted).toBe(vector.encryptedData);
        }

        for (let i = 0; i < vectors.length; i++) {
            const vector = vectors[i];
            const data = BufferUtils.toHex(await CryptoUtils.otpKdfLegacy(BufferUtils.fromHex(vector.encryptedData), BufferUtils.fromAscii(vector.password), BufferUtils.fromAscii(vector.salt), 256));
            expect(data).toBe(vector.data);
        }
    });

    it('can correctly compute Imagewallet otpKdf', async () => {
        const vectors = [
            {
                data: '0000002a5643fb247fcd029881fad7f5e0c9434882b58b0a295344663326f67bd1aac4300000',
                password: 'password',
                salt: 'sixteen chars 01',
                encryptedData: 'e6ebda4816d10369be5e30a1f148f4aee93ae28d014a1ba6450c1871e0aad1f068bcc9c7305a',
            },
            {
                data: '0000002a588d9f4b46b82520c6dd7af5a776268d1baeb6d3e21b91c6cd53888db0dff9fb0000',
                password: '12345678',
                salt: 'sixteen chars 02',
                encryptedData: '3759ac3c615aa477de37a14d03fb0c7d2ff15f26af60334d14e9226ceb0e60bd2876b14774c8',
            },
            {
                data: '0000002ae055789cc8b5bd1c6eca0fac181744c3b26e1b095f2971abdc37c3f1faf82a5a0000',
                password: 'password',
                salt: 'sixteen chars 03',
                encryptedData: 'd2e978f2048f9392e726a415999d6b08705d722850fd350bf9f6fc94720ef422c9e97881b02e',
            },
            {
                data: '0000002ac464700afaf363e8fa3d16c285bc5801b62e17a9a6d33b5a147a80700a2fa8ea0000',
                password: '12345678',
                salt: 'sixteen chars 04',
                encryptedData: 'f213094b3408978d87afcb9a93b5c0cd8cda926157bff3ea962a564b2971ba5225cfca162d34',
            },
            {
                data: '0000002a13da41526eab8aa8b618f889b6f80b328c895a0e334b55f935d041206e99b69c0000',
                password: 'passwordPASSWORDpassword',
                salt: 'sixteen chars 05',
                encryptedData: '2ef5fd08f14777c0192e582772688fe84a63847b9cf74fcd0df47870b9d732b52fe69805f142',
            },
        ];

        for (let i = 0; i < vectors.length; i++) {
            const vector = vectors[i];
            const encryptedBytes = await CryptoUtils.otpKdf(BufferUtils.fromHex(vector.data), BufferUtils.fromAscii(vector.password), BufferUtils.fromAscii(vector.salt), 256);
            expect(encryptedBytes.length).toBe(38);
            expect(BufferUtils.toHex(encryptedBytes)).toBe(vector.encryptedData);
        }

        for (let i = 0; i < vectors.length; i++) {
            const vector = vectors[i];
            let data = BufferUtils.toHex(await CryptoUtils.otpKdf(BufferUtils.fromHex(vector.encryptedData), BufferUtils.fromAscii(vector.password), BufferUtils.fromAscii(vector.salt), 256));
            expect(data).toBe(vector.data);
        }
    });

    it('can correctly compute Imagewallet otpKdf (2)', async () => {
        const data = BufferUtils.fromHex('fc597b22416c2d4b696e6469223a22d8a3d8a8d98820d98ad988d8b3d98120d98ad8b9d982d988d8a820d8a8d98620d8a5d8b3d8add8a7d98220d8a7d984d8b5d8a8d991d8a7d8ad20d8a7d984d983d986d8afd98a227d');
        const password = BufferUtils.fromUtf8('a322c28cdfa2ef5691adfe2f1c63349b39c9f72518bf99e4179ef17123772bfe يعقوب بن إسحاق الصبّ');
        const salt = BufferUtils.fromHex('39c9f72518bf99e4179ef17123772bfe');
        const encryptedData = BufferUtils.fromHex('44cf43d90ef7c8c9ab0b30c9258340b83c4af3ca587c3ddd12796bbe989b401bb497925a29ece2d0a57e418c0c3af4f9d5d190001de782c06f7667382871f5efd61ae73bd41c4bc67fcd450e9bf45f95279cd4d26539ee');

        const encryptedBytes = await CryptoUtils.otpKdf(data, password, salt, 256);
        expect(encryptedBytes.length).toBe(87);
        expect(BufferUtils.equals(encryptedBytes, encryptedData)).toBe(true);

        const decryptedBytes = await CryptoUtils.otpKdf(encryptedData, password, salt, 256);
        expect(BufferUtils.equals(decryptedBytes, data)).toBe(true);
    });
});
