describe('PrivateKey', () => {

    it('correctly derives the delinearized private key', (done) => {
        (async function () {
            for (const testCase of Dummy.partialSignatureTestVectors) {
                for (let i = 0; i < testCase.privKeys.length; ++i) {
                    const publicKeysHash = PublicKey._publicKeysHash(testCase.pubKeys);
                    const delinearizedPrivKey = PrivateKey._privateKeyDelinearize(testCase.privKeys[i], testCase.pubKeys[i], publicKeysHash);
                    expect(BufferUtils.equals(delinearizedPrivKey, testCase.delinearizedPrivKeys[i])).toBe(true);
                }
            }
        })().then(done, done.fail);
    });
});
