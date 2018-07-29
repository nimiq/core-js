describe('ExtendedPrivateKey', () => {

    it('correctly derives keys', () => {
        // Test vectors from https://github.com/satoshilabs/slips/blob/master/slip-0010.md
        const seeds = [
            '000102030405060708090a0b0c0d0e0f',
            'fffcf9f6f3f0edeae7e4e1dedbd8d5d2cfccc9c6c3c0bdbab7b4b1aeaba8a5a29f9c999693908d8a8784817e7b7875726f6c696663605d5a5754514e4b484542'
        ];

        const vectors = [
            [
                {
                    path: 'm',
                    chainCode: '90046a93de5380a72b5e45010748567d5ea02bbf6522f979e05c0d8d8ca9fffb',
                    private: '2b4be7f19ee27bbf30c667b642d5f4aa69fd169872f8fc3059c08ebae2eb19e7',
                    public: '00a4b2856bfec510abab89753fac1ac0e1112364e7d250545963f135f2a33188ed'
                },
                {
                    path: 'm/0\'',
                    chainCode: '8b59aa11380b624e81507a27fedda59fea6d0b779a778918a2fd3590e16e9c69',
                    private: '68e0fe46dfb67e368c75379acec591dad19df3cde26e63b93a8e704f1dade7a3',
                    public: '008c8a13df77a28f3445213a0f432fde644acaa215fc72dcdf300d5efaa85d350c'
                },
                {
                    path: 'm/0\'/1\'',
                    chainCode: 'a320425f77d1b5c2505a6b1b27382b37368ee640e3557c315416801243552f14',
                    private: 'b1d0bad404bf35da785a64ca1ac54b2617211d2777696fbffaf208f746ae84f2',
                    public: '001932a5270f335bed617d5b935c80aedb1a35bd9fc1e31acafd5372c30f5c1187'
                },
                {
                    path: 'm/0\'/1\'/2\'',
                    chainCode: '2e69929e00b5ab250f49c3fb1c12f252de4fed2c1db88387094a0f8c4c9ccd6c',
                    private: '92a5b23c0b8a99e37d07df3fb9966917f5d06e02ddbd909c7e184371463e9fc9',
                    public: '00ae98736566d30ed0e9d2f4486a64bc95740d89c7db33f52121f8ea8f76ff0fc1'
                },
                {
                    path: 'm/0\'/1\'/2\'/2\'',
                    chainCode: '8f6d87f93d750e0efccda017d662a1b31a266e4a6f5993b15f5c1f07f74dd5cc',
                    private: '30d1dc7e5fc04c31219ab25a27ae00b50f6fd66622f6e9c913253d6511d1e662',
                    public: '008abae2d66361c879b900d204ad2cc4984fa2aa344dd7ddc46007329ac76c429c'
                },
                {
                    path: 'm/0\'/1\'/2\'/2\'/1000000000\'',
                    chainCode: '68789923a0cac2cd5a29172a475fe9e0fb14cd6adb5ad98a3fa70333e7afa230',
                    private: '8f94d394a8e8fd6b1bc2f3f49f5c47e385281d5c17e65324b0f62483e37e8793',
                    public: '003c24da049451555d51a7014a37337aa4e12d41e485abccfa46b47dfb2af54b7a'
                }
            ],
            [
                {
                    path: 'm',
                    chainCode: 'ef70a74db9c3a5af931b5fe73ed8e1a53464133654fd55e7a66f8570b8e33c3b',
                    private: '171cb88b1b3c1db25add599712e36245d75bc65a1a5c9e18d76f9f2b1eab4012',
                    public: '008fe9693f8fa62a4305a140b9764c5ee01e455963744fe18204b4fb948249308a'
                },
                {
                    path: 'm/0\'',
                    chainCode: '0b78a3226f915c082bf118f83618a618ab6dec793752624cbeb622acb562862d',
                    private: '1559eb2bbec5790b0c65d8693e4d0875b1747f4970ae8b650486ed7470845635',
                    public: '0086fab68dcb57aa196c77c5f264f215a112c22a912c10d123b0d03c3c28ef1037'
                },
                {
                    path: 'm/0\'/2147483647\'',
                    chainCode: '138f0b2551bcafeca6ff2aa88ba8ed0ed8de070841f0c4ef0165df8181eaad7f',
                    private: 'ea4f5bfe8694d8bb74b7b59404632fd5968b774ed545e810de9c32a4fb4192f4',
                    public: '005ba3b9ac6e90e83effcd25ac4e58a1365a9e35a3d3ae5eb07b9e4d90bcf7506d'
                },
                {
                    path: 'm/0\'/2147483647\'/1\'',
                    chainCode: '73bd9fff1cfbde33a1b846c27085f711c0fe2d66fd32e139d3ebc28e5a4a6b90',
                    private: '3757c7577170179c7868353ada796c839135b3d30554bbb74a4b1e4a5a58505c',
                    public: '002e66aa57069c86cc18249aecf5cb5a9cebbfd6fadeab056254763874a9352b45'
                },
                {
                    path: 'm/0\'/2147483647\'/1\'/2147483646\'',
                    chainCode: '0902fe8a29f9140480a00ef244bd183e8a13288e4412d8389d140aac1794825a',
                    private: '5837736c89570de861ebc173b1086da4f505d4adb387c6a1b1342d5e4ac9ec72',
                    public: '00e33c0f7d81d843c572275f287498e8d408654fdf0d1e065b84e2e6f157aab09b'
                },
                {
                    path: 'm/0\'/2147483647\'/1\'/2147483646\'/2\'',
                    chainCode: '5d70af781f3a37b829f0d060924d5e960bdc02e85423494afc0b1a41bbe196d4',
                    private: '551d333177df541ad876a60ea71f00447931c0a9da16f227c11ea080d7391b8d',
                    public: '0047150c75db263559a70d5778bf36abbab30fb061ad69f69ece61a72b0cfa4fc0'
                }
            ]
        ];

        for (let i = 0; i < vectors.length; i++) {
            for (let j = 0; j < vectors[i].length; j++) {
                const vector = vectors[i][j];

                const extendedKey = ExtendedPrivateKey.derivePathFromSeed(vector.path, BufferUtils.fromHex(seeds[i]));

                const chainCode = BufferUtils.toHex(extendedKey._chainCode);
                expect(chainCode).toBe(vector.chainCode);

                const privateKey = extendedKey.privateKey;
                expect(privateKey.toHex()).toBe(vector.private);

                const publicKey = PublicKey.derive(privateKey);
                expect(`00${publicKey.toHex()}`).toBe(vector.public);
            }
        }
    });
});
