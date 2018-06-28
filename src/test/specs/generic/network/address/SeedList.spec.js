describe('SeedList', () => {
    const publicKey = '184084e13c595816aa3cd5b479dc15255aad3778dadd58abb0503b3e4af61525';
    it('can be parsed from string', () => {
        const listStr1 = '#comment\n'
            + 'ws://foobar.com:8080/\n'
            + 'wss://bla.blub.fo-o.com:8443/abe25666ee12a71bda501239f230c760c84ee50eef0a3e567897e8d5307c0b4e\n'
            + '\n'
            + '#ws://nothere.com:8080/';
        const seedList1 = SeedList.parse(listStr1);
        expect(seedList1.seeds.length).toBe(2);

        const listStr2 = '#comment\n'
            + 'ws://foobar.com:8080/\n'
            + 'wss://bla.blub.fo-o.com:8443/abe25666ee12a71bda501239f230c760c84ee50eef0a3e567897e8d5307c0b4e\n'
            + '\n'
            + '#ws://nothere.com:8080/\n'
            + 'e587e9e866defb3a7cfb65262f3c2a334af1433ae0c0798ecf1c997e9f34ab0069d66a3bbcc514ea224992b4a577ddbac02d5e7cb01d6afea07d0b85ff69e80e';
        const seedList2 = SeedList.parse(listStr2, new PublicKey(BufferUtils.fromHex(publicKey)));
        expect(seedList2.seeds.length).toBe(2);
        expect(seedList2.publicKey.toHex()).toBe(publicKey);
        expect(seedList2.signature).toBeTruthy();
    });

    it('fails on missing signature', () => {
        const listStr = '#comment\n'
            + 'ws://foobar.com:8080/\n'
            + 'wss://bla.blub.fo-o.com:8443/abe25666ee12a71bda501239f230c760c84ee50eef0a3e567897e8d5307c0b4e\n'
            + '\n'
            + '#ws://nothere.com:8080/\n';
        expect(() => SeedList.parse(listStr, new PublicKey(BufferUtils.fromHex(publicKey)))).toThrowError('Missing signature');
    });

    it('fails on invalid signature', () => {
        const listStr1 = '#comment\n'
            + 'ws://foobar.com:8080/\n'
            + 'wss://bla.blub.fo-o.com:8443/abe25666ee12a71bda501239f230c760c84ee50eef0a3e567897e8d5307c0b4e\n'
            + '\n'
            + '#ws://nothere.com:8080/\n'
            + 'e587e9e866defb3a7cfb65262f3c2a334af1433ae0c0798ecf1c997e9f34ab0069d66a3bbcc514ea224992b4a577ddbac02d5e7cb01d6afea07d0b85ff69e80a';
        expect(() => SeedList.parse(listStr1, new PublicKey(BufferUtils.fromHex(publicKey)))).toThrowError('Invalid signature');

        const listStr2 = '#comment\n'
            + 'ws://foobar.com:8080/\n'
            + 'wss://bla.blub.fo-o.com:8443/abe25666ee12a71bda501239f230c760c84ee50eef0a3e567897e8d5307c0b4e\n'
            + '\n'
            + '#ws://nothere.com:8080/\n'
            + 'abcdef';
        expect(() => SeedList.parse(listStr2, new PublicKey(BufferUtils.fromHex(publicKey)))).toThrowError('Missing signature');

        const listStr3 = '#comment\n'
            + 'ws://foobar.com:8080/\n'
            + 'wss://bla.blub.fo-o.com:8443/abe25666ee12a71bda501239f230c760c84ee50eef0a3e567897e8d5307c0b4e\n'
            + '\n'
            + '#ws://nothere.com:8080/\n'
            + 'abcXXX';
        expect(() => SeedList.parse(listStr3, new PublicKey(BufferUtils.fromHex(publicKey)))).toThrowError('Missing signature');
    });
});
