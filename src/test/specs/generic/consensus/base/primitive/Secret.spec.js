describe('Secret', () => {
    it('can encrypt/decrypt private key', (done) => {
        (async function () {
            const key = BufferUtils.fromAscii('password');
            const privateKey = PrivateKey.generate();
            const encrypted = await privateKey.exportEncrypted(key);
            const decrypted = await Secret.fromEncrypted(encrypted, key);
            expect(decrypted.type).toBe(Secret.Type.PRIVATE_KEY);
            expect(decrypted instanceof PrivateKey).toBe(true);
            expect(decrypted.equals(privateKey)).toBe(true);
        })().then(done, done.fail);
    });

    it('can encrypt/decrypt entropy', (done) => {
        (async function () {
            const key = BufferUtils.fromAscii('password');
            const entropy = Entropy.generate();
            const encrypted = await entropy.exportEncrypted(key);
            const decrypted = await Secret.fromEncrypted(encrypted, key);
            expect(decrypted.type).toBe(Secret.Type.ENTROPY);
            expect(decrypted instanceof Entropy).toBe(true);
            expect(decrypted.equals(entropy)).toBe(true);
        })().then(done, done.fail);
    });

    it('can decrypt ImageWallet payloads', async () => {
        const vectors = [
            { encrypted: '03080680e9141c6ecd555f42ca00650107d8cd1ce53d4fe3a7db24ac516aa066a512751d1fc8ad08d0688189851168532ba9084a91817c21', plain: '5b376ac75ee87b30d8ab0b980466166e75f402187ff9251dfb558b3ccd5e0827', password: 'P96P4Bdp6wMy4pBV' },
            { encrypted: '0308e2166f6a312878b2b0876a29c29e543b49fcd54fb8a206971e476dd04dfd0c44e47d3b2acd0374dd405497e5ce74f70bc4d40ae5f007', plain: '066c9ad6c254ae747be52ddfcd954dee93b0979334e0074dd14b9346938977ef', password: 'P96P4Bdp6wMy4pBV' },
            { encrypted: '0308c0c638e5ea8349f41825ae9b7b57ddf34f3ba3b898bf6b3f45127f2d5b2962c3959404d0b8445fa615898bfe198524f9eac0a6a086c3', plain: '52c61339e69b8bd2f81ba7d6d54789648807ae8ce5dbbf698622e60007506ebc', password: '田中さんにあげて下さい' },
            { encrypted: '030872ca416f4ec7e16e144d882b660e564a15c0bcd0273221cef45d3ff4d29c9b77c2556506e74545bf326ee8c8ce8db587014b4354165b', plain: '50ee2fe1774066444abf3ce693e794186de8309debbc13a03426767d71564893', password: 'أبو يوسف يعقوب بن إسحاق الصبّاح الكندي' },
            { encrypted: '030895b250c4f4a069ec0705ddc48b06afc731e33e67c398e9d841b6c133abd8983fd7da834506cb176889a108c05d708dee5a5b900270f2', plain: 'c1cc993996aeda06616c920b9666e38103ede338bbabe4f6c2dd38daa2666572', password: '﷽' },
            { encrypted: '03088230abd888e1fc1a38f7bbc85ac4583a37df1c75b31755162a0c62eefa767007827163d85e9afe7c9e9aadb07ab7ae87ce50953522c8', plain: '6f5782cd1812b363c1dc2c7abe2bfd26e5d7031797809cb777ebfa2b8a8c00aa', password: 'Ṱ̺̺̕o͞ ̷i̲̬͇̪͙n̝̗͕v̟̜̘̦͟o̶̙̰̠kè͚̮̺̪̹̱̤ ̖t̝͕̳̣̻̪͞h̼͓̲̦̳̘̲e͇̣̰̦̬͎ ̢̼̻̱̘h͚͎͙̜̣̲ͅi̦̲̣̰̤v̻͍e̺̭̳̪̰-m̢iͅn̖̺̞̲̯̰d̵̼̟͙̩̼̘̳ ̞̥̱̳̭r̛̗̘e͙p͠r̼̞̻̭̗e̺̠̣͟s̘͇̳͍̝͉e͉̥̯̞̲͚̬͜ǹ̬͎͎̟̖͇̤t͍̬̤͓̼̭͘ͅi̪̱n͠g̴͉ ͏͉ͅc̬̟h͡a̫̻̯͘o̫̟̖͍̙̝͉s̗̦̲.' },
        ];

        for (const vector of vectors) {
            const decrypted = await Secret.fromEncrypted(BufferUtils.fromHex(vector.encrypted), BufferUtils.fromUtf8(vector.password));
            expect(decrypted.type).toBe(Secret.Type.ENTROPY);
            expect(decrypted instanceof Entropy).toBe(true);
            expect(BufferUtils.equals(decrypted._obj, BufferUtils.fromHex(vector.plain))).toBe(true);
        }
    });
});
