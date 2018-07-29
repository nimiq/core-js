describe('Hash', () => {

    it('is 32 bytes long', () => {
        const hash = Hash.unserialize(BufferUtils.fromBase64(Dummy.hash1));
        expect(hash.serializedSize).toEqual(32);
        expect(() => {
            const sign = new Hash(new Uint8Array(16));
        }).toThrow(new Error('Primitive: Invalid length'));

        expect(() => {
            const sign = new Hash('test');
        }).toThrow(new Error('Primitive: Invalid type'));

        expect(() => {
            const sign = new Hash(new Uint8Array(33));
        }).toThrow(new Error('Primitive: Invalid length'));
    });

    it('is serializable and unserializable', () => {
        const hash1 = Hash.unserialize(BufferUtils.fromBase64(Dummy.hash1));
        const hash2 = Hash.unserialize(hash1.serialize());

        expect(hash2.toBase64()).toBe(Dummy.hash1);
    });

    it('has an equals method', () => {
        const hash1 = Hash.unserialize(BufferUtils.fromBase64(Dummy.hash1));
        const hash2 = Hash.unserialize(BufferUtils.fromBase64(Dummy.hash2));

        expect(hash1.equals(hash1))
            .toBe(true, 'because hash1 == hash1');
        expect(hash1.equals(hash2))
            .toBe(false, 'because hash1 !== hash2');
        expect(hash1.equals(null))
            .toBe(false, 'because hash1 !== null');
        expect(hash1.equals(1))
            .toBe(false, 'because hash1 !== 1');
    });

    it('can hash data with blake2b', () => {
        const dataToHash = BufferUtils.fromAscii('hello');
        const expectedHash = Dummy.hash1;
        const hash = Hash.blake2b(dataToHash);
        expect(BufferUtils.toBase64(hash.serialize())).toBe(expectedHash);
    });

    it('can hash data with sha256', () => {
        const dataToHash = BufferUtils.fromAscii(Dummy.shaHash.input);
        const expectedHash = Dummy.shaHash.sha256Hex;
        const hash = Hash.sha256(dataToHash);
        expect(BufferUtils.toHex(hash.serialize())).toBe(expectedHash);
    });

    it('can hash data with sha512', () => {
        const dataToHash = BufferUtils.fromAscii(Dummy.shaHash.input);
        const expectedHash = Dummy.shaHash.sha512Hex;
        const hash = Hash.sha512(dataToHash);
        expect(BufferUtils.toHex(hash.serialize())).toBe(expectedHash);
    });

    it('can correctly computes hmacSha512', () => {
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
            let hash = BufferUtils.toHex(Hash.computeHmacSha512(BufferUtils.fromHex(vector.key), BufferUtils.fromHex(vector.data)));
            if (i === 4) hash = hash.substr(0, 32); // Simulate truncated output.
            expect(hash).toBe(vector.hash);
        }
    });
});
