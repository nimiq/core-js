const Dummy = {};

Dummy.hash1 = 'LPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ='; // "hello"
Dummy.hash2 = 'hymMwvMfunMYHqKp5u8Q3OIe2V6YvaycThUE6hb0huQ='; // "hello2"
Dummy.hash3 = 'R+pwzwiHK9tK+tNDKwHZY6x9Fl9rV1zXLvR0mPRFmpA='; // "hello3"

Dummy.publicKey1 = 'BI8wpNk41BMNGjOW3t4VBccrf3Wsn5uA0a1+Nos587EFFzdKKQgDTwEVJhEPYqihOA/605GNxH09X3xGIrKwP68=';
Dummy.publicKey2 = 'BHM/60qPtA1UfFO+pJgy1ATkRUEOT7h0bdAU+mZYoqtDJGFAC2PZlggzxkm7pYuLzkQHc+wC405fHV1W5jDX6QA=';
Dummy.publicKey3 = 'BHKblaL8o+wwiO2vEe8MnP7MGcpfkuSGIXWQXJ2SVaESgq6KR61qP+HREu4nrKNo5WbXjswHbOHXXVqQvx/hJSE=';
Dummy.publicKey4 = 'BN6UN00jbveCq4kqFgjGaKwBOzdRIWLDk2MVngpGbfX/MfxVL6teoEaiu03tdl66oI9oQ+QyWUqLpMZcIpmuVtE=';
Dummy.publicKey5 = 'BJ34jQS0bYB+iJiBLYbMVLGshp72BglwBrraHGHk1kWHAp7eHW9Hq5qiDwN6pY/QoJqAEjI/V7RcRJvPF8aDbM4=';

Dummy.address1 = 'kekkD0FSI5gu3DRVMmMHEOlKf1I='; // "hello1"
Dummy.address2 = 'hymMwvMfunMYHqKp5u8Q3OIe2V4='; // "hello2"
Dummy.address3 = 'R+pwzwiHK9tK+tNDKwHZY6x9Fl8='; // "hello3"
Dummy.address5 = 'xhjzRboKle+Qj5h5fG/WUF81DHQ=';

Dummy.signature1 = 'yn57dWMc9EQVuvuzmoi+36ftTKXLBvpPkLkSUvi33gtUbq6iY5LtiaQzr5Z9DXBxoyBlFllubqpWMzdcLTyesA==';
Dummy.signature2 = '00v2Siqx3zh1bcoofmw4LVzYFuDKpcmStEl8zZeBpYZ6chVU0eeuP+i+/CuNIRhomW5HRybcPvhTUqhxFpl/sw==';
Dummy.signature3 = 'mU04AuXE5QcLPPvQbtdWzjHeB6oNVjxdfPRXfPWmJx/YgBAIFfogOT7wasBiOIx8n/YKMoK0VWLVarl2KLiKvQ==';
Dummy.signature5 = 'QPwwvbwjQKTkB/L33A7Y3ZOIF4MHhzjRGVi3nmQSmvpz8+/xPjcU/tlh9lfmpAQDesMu2NI6WtFeVHWSDMoysA==';

// Transaction {_recipientAddr: Dummy.address1, _value: 9007199254740991, _fee: 1, _nonce: 4}
Dummy.validTransaction = 'BHRjt7rp/Rt0BfsHyEDpJcCdpLS9811yp76Yy1An/NJ0voiRWw2sOtLZvxSoflYm7sVL963psAntQ3bmxOKH/UiR6SQPQVIjmC7cNFUyYwcQ6Up/UkM/////////P/AAAAAAAAAAAAAEpKNUjs8tXJjrrcRcAzDH4HUMpN8gSIiZT32G+iJZPejR5hWu24Z9NX73DzssJCsyTIM6iIG/z9UGQL3ucF7eKg==';

Dummy.users = (() => {

})();

if (typeof global !== 'undefined') {
    global.Dummy = Dummy;
}

Dummy.users = new Array(20);

Dummy.users[0] = {
    'privateKey':
    { kty: 'EC',
        crv: 'P-256',
        key_ops: [ 'sign' ],
        x: '_7L1hlc0EKcqL7h6U_ZBNUEHMz9lKJOFcwPHzbrAC70',
        y: 'GzyECCdU95htx3t2s04hJ3IuLLr2lnTCufY9HIcg1k4',
        d: 'gZ7SKjWbbhTAWFgxHKLjZ8jkaS5JOZfM7k0zIH0jMKE' }
,
    'publicKey': 'BP+y9YZXNBCnKi+4elP2QTVBBzM/ZSiThXMDx826wAu9GzyECCdU95htx3t2s04hJ3IuLLr2lnTCufY9HIcg1k4=',
    'address': 'EiJjyealvCC4ebY23bEzy4aoF90='
};
Dummy.users[1] = {
    'privateKey':
    { kty: 'EC',
        crv: 'P-256',
        key_ops: [ 'sign' ],
        x: 'j2JptRsuAn6Cz-av23qAc30RWHPuhEptI2jw5plPh7Q',
        y: 'mDNR1guAishdQ8nLpxCV60h6rwiyx-dQxD6hPVCnib0',
        d: 'PL46PUCAknBczZujzdaTormhe2OeyTmrVQvuu_1jNLE' }
,
    'publicKey': 'BI9iabUbLgJ+gs/mr9t6gHN9EVhz7oRKbSNo8OaZT4e0mDNR1guAishdQ8nLpxCV60h6rwiyx+dQxD6hPVCnib0=',
    'address': 'tBf1wakQFmnQ22orQXAihfHmOVY='
};
Dummy.users[2] = {
    'privateKey':
    { kty: 'EC',
        crv: 'P-256',
        key_ops: [ 'sign' ],
        x: 'U1kbjurBv9m0FCsHMVGN7fPI3Eg2elj6q6oCxtEfGFQ',
        y: 'SaZFt9E2B2WEt1uuso1J4ZjXt5MRa3WRReBkbBSqUh8',
        d: 'SftFe2Hg6VsTSH2PMECq3YLXuXIQcj3vsDkf0MRSX0E' }
,
    'publicKey': 'BFNZG47qwb/ZtBQrBzFRje3zyNxINnpY+quqAsbRHxhUSaZFt9E2B2WEt1uuso1J4ZjXt5MRa3WRReBkbBSqUh8=',
    'address': 'JuSa99IZZnW6gqb/evpo1y3iEyg='
};
Dummy.users[3] = {
    'privateKey':
    { kty: 'EC',
        crv: 'P-256',
        key_ops: [ 'sign' ],
        x: '1myLS7mb8wGo68WcyyNS9TZdqHvTjKOTEG9Q8j7Tizw',
        y: 'RhzLDVeNgTUMH_0mQZQOtbOU2hjYPsIrZPCfFakHL2E',
        d: '0-tTxjaI97yvzrxr_VigL-zvPaylHePGtsV4yiv4gyk' }
,
    'publicKey': 'BNZsi0u5m/MBqOvFnMsjUvU2Xah704yjkxBvUPI+04s8RhzLDVeNgTUMH/0mQZQOtbOU2hjYPsIrZPCfFakHL2E=',
    'address': 'Rz9YPtK+sM3tN6B72lkP9kHXexs='
};
Dummy.users[4] = {
    'privateKey':
    { kty: 'EC',
        crv: 'P-256',
        key_ops: [ 'sign' ],
        x: 'TEl4cxjPyulW8gIUSA90fn8JOC7t0w_vXTO4YyTDvz4',
        y: 'PrdAqGyT3-PQqpiFyxSOtLTAxk0j7odeoa7lcsVhgTY',
        d: '54fUAfRXDId_KJKmkpRw7QzqeBq7snQMYsDreVb6fCA' }
,
    'publicKey': 'BExJeHMYz8rpVvICFEgPdH5/CTgu7dMP710zuGMkw78+PrdAqGyT3+PQqpiFyxSOtLTAxk0j7odeoa7lcsVhgTY=',
    'address': '2Sg8nj3U5KrglOhqSs4jbvu/R5c='
};
Dummy.users[5] = {
    'privateKey':
    { kty: 'EC',
        crv: 'P-256',
        key_ops: [ 'sign' ],
        x: '3FGVfKTU4GbR2NrVzVrR1N25Wr38AepowhS1swWid5Q',
        y: 'W3sBk7YeMCG51cMUTkzPGN4Bn6fajbUK6LNTMssQWOU',
        d: 'ZhTC7xh41Ae6h4brw8fyYQjNUGUFPp3hTUYSR2-f5Bs' }
,
    'publicKey': 'BNxRlXyk1OBm0dja1c1a0dTduVq9/AHqaMIUtbMFoneUW3sBk7YeMCG51cMUTkzPGN4Bn6fajbUK6LNTMssQWOU=',
    'address': 'l9gVHMf/vCG6UcrBwSJoSieYXdM='
};
Dummy.users[6] = {
    'privateKey':
    { kty: 'EC',
        crv: 'P-256',
        key_ops: [ 'sign' ],
        x: 'aH39JfZTjtfb4Hg_I59UTqPMrgop_JVWVrLGFm5Ra6U',
        y: '5TmFn35563HPgpOav5RLZdn6Dp5ULNZWyyoAtavwVmY',
        d: 'noNpRgwgavuqxChE_VL-FQ7Bfp00SvSzHlMETgNmClQ' }
,
    'publicKey': 'BGh9/SX2U47X2+B4PyOfVE6jzK4KKfyVVlayxhZuUWul5TmFn35563HPgpOav5RLZdn6Dp5ULNZWyyoAtavwVmY=',
    'address': 'wrjYUwfd2/iLzhYUpXgR5n6wm5M='
};
Dummy.users[7] = {
    'privateKey':
    { kty: 'EC',
        crv: 'P-256',
        key_ops: [ 'sign' ],
        x: 'yHCRdHm-qzZeXwaBkdUa0ZyPkOe9MHaVpCW9A3lBTTc',
        y: '4g2m2-h-377k7cgB2e5TNIEO-D0jA2N3bNE-XdCOxbk',
        d: 'uKQa9X1BRh9jWR62jV5vuCGWbT-rePsILGu0rDlIU0M' }
,
    'publicKey': 'BMhwkXR5vqs2Xl8GgZHVGtGcj5DnvTB2laQlvQN5QU034g2m2+h+377k7cgB2e5TNIEO+D0jA2N3bNE+XdCOxbk=',
    'address': 'RPvwxcvHXtmu1Qx6c6eKeu7hTdo='
};
Dummy.users[8] = {
    'privateKey':
    { kty: 'EC',
        crv: 'P-256',
        key_ops: [ 'sign' ],
        x: 'c5fZKKSZOEAMnBpFRyOEY53tDLwhjC-o-hLTJozhHzU',
        y: 'YkN0J7DSFWNH2WN9qTfZeJ2mEcHYRyO9Cj-PyC-dFws',
        d: 'WmbQIFMZ2Dk188SrBYbRYKVUeqgn-KW_UuwDsBEap9o' }
,
    'publicKey': 'BHOX2SikmThADJwaRUcjhGOd7Qy8IYwvqPoS0yaM4R81YkN0J7DSFWNH2WN9qTfZeJ2mEcHYRyO9Cj+PyC+dFws=',
    'address': 'skF/1eBvaQOQm3/ZVhp1tJ/RnRs='
};
Dummy.users[9] = {
    'privateKey':
    { kty: 'EC',
        crv: 'P-256',
        key_ops: [ 'sign' ],
        x: 'kHwNjM_zo_u0fkZIEC8visWFRkwhb4H2PrNM7atXcOM',
        y: '2UzvmDuzcQDpRmBU0nC8tecvKpL366q2_vvYtjO97P4',
        d: 'alDlRbwrtGrkQAGvmbRavh2JDdeKNuQMCFniOlTszfY' }
,
    'publicKey': 'BJB8DYzP86P7tH5GSBAvL4rFhUZMIW+B9j6zTO2rV3Dj2UzvmDuzcQDpRmBU0nC8tecvKpL366q2/vvYtjO97P4=',
    'address': 'aJV96bAI3rBweFZKNr9lhafY/CM='
};
Dummy.users[10] = {
    'privateKey':
    { kty: 'EC',
        crv: 'P-256',
        key_ops: [ 'sign' ],
        x: '7w-Lqll5uc-g8PpDaFpOFMYBzF_hCokDK_sW56GvQaM',
        y: '-JCq34fXSgqgxNwFBR62wHQN9cNTtQ3tVWFoSFNpXfo',
        d: 'BBE5wmpJp9IU2LjEBrAqyH1Mdzh2gwpFoaofcwrNxi8' }
,
    'publicKey': 'BO8Pi6pZebnPoPD6Q2haThTGAcxf4QqJAyv7Fuehr0Gj+JCq34fXSgqgxNwFBR62wHQN9cNTtQ3tVWFoSFNpXfo=',
    'address': 'zb46AUjhM0W8GtfOP+fj/zo/q1U='
};
Dummy.users[11] = {
    'privateKey':
    { kty: 'EC',
        crv: 'P-256',
        key_ops: [ 'sign' ],
        x: 'yXAtdxhwC-reGvMK5ki0tF6ot2Lyo3PsL1CXXqIZSAU',
        y: 'pcqRhXSN6vXXaqnRijCcvtMPGHLgTbR10j2SzqwNNRk',
        d: 'RnYaPxwexBRF0rbHuSkAHuEypzR8AzkX0fiT8twT200' }
,
    'publicKey': 'BMlwLXcYcAvq3hrzCuZItLReqLdi8qNz7C9Ql16iGUgFpcqRhXSN6vXXaqnRijCcvtMPGHLgTbR10j2SzqwNNRk=',
    'address': 'uFOB7oHrrWITqvEBEw+ojDHCSh0='
};
Dummy.users[12] = {
    'privateKey':
    { kty: 'EC',
        crv: 'P-256',
        key_ops: [ 'sign' ],
        x: 'wUh8qGP4DHL7kPLEFrKFARZlU9nd6Gn1cSdPkY13iCk',
        y: '1LvoAzyvbCK8xEFmYn-okWx0WxGaisZHOlwex12ORxU',
        d: 'j-Z3GUKVM5Yxpk44CuT0KSEtLezz4ef66PjNP-j0KDk' }
,
    'publicKey': 'BMFIfKhj+Axy+5DyxBayhQEWZVPZ3ehp9XEnT5GNd4gp1LvoAzyvbCK8xEFmYn+okWx0WxGaisZHOlwex12ORxU=',
    'address': 'L4ft0n9dU7GMBcQKBWhrNH7Clms='
};
Dummy.users[13] = {
    'privateKey':
    { kty: 'EC',
        crv: 'P-256',
        key_ops: [ 'sign' ],
        x: 'fQQxkEKtzcNv6V0BI_TAiCDWilzp1s74VWJ46g3bee4',
        y: 'Ebonb4BlUfhN-iGwExjwJU6c4nZk21Mcn0aMBjhbZN4',
        d: 'HaqN_TZs9NbRmwHzLpySO6c9MrD-YpU7IAO0BzxpmOI' }
,
    'publicKey': 'BH0EMZBCrc3Db+ldASP0wIgg1opc6dbO+FVieOoN23nuEbonb4BlUfhN+iGwExjwJU6c4nZk21Mcn0aMBjhbZN4=',
    'address': '8aQosufZjtJN/HeyaPVezHmpIds='
};
Dummy.users[14] = {
    'privateKey':
    { kty: 'EC',
        crv: 'P-256',
        key_ops: [ 'sign' ],
        x: '8rAk0jhEO8wRpkCBuJYJKj7SzaiX-_gbkvu2by8atyY',
        y: 'RCNuDBm_iAm4bLmQsy3NmZcZQA7yyP56BhpG3t8SoAo',
        d: 'Y9084h0XZsUz5nAtD1b5uEK9555slt3tnKcHK0EPmNE' }
,
    'publicKey': 'BPKwJNI4RDvMEaZAgbiWCSo+0s2ol/v4G5L7tm8vGrcmRCNuDBm/iAm4bLmQsy3NmZcZQA7yyP56BhpG3t8SoAo=',
    'address': 'i0NVaEanhLKn5g/yCERjKL5+124='
};
Dummy.users[15] = {
    'privateKey':
    { kty: 'EC',
        crv: 'P-256',
        key_ops: [ 'sign' ],
        x: 'JIywbNYp-Asiy_DhR5EDLbmq7PoGaUm-exyv7On21ho',
        y: 'Pu95D6S1UgvAoCMeonafbb6LgfrgZ91r_-dTNyBiJ-M',
        d: 'YsOI6PPDg7G4DzsKFNK-CT9CxeJMKD1fvIt0x-AkwzU' }
,
    'publicKey': 'BCSMsGzWKfgLIsvw4UeRAy25quz6BmlJvnscr+zp9tYaPu95D6S1UgvAoCMeonafbb6LgfrgZ91r/+dTNyBiJ+M=',
    'address': 'gVHmYax4sLpoBtRiz9mqmbz6JKw='
};
Dummy.users[16] = {
    'privateKey':
    { kty: 'EC',
        crv: 'P-256',
        key_ops: [ 'sign' ],
        x: 'e4qe9xa2y69YZa-NoxRARBk4jHIv92n3CFIAXtPfLKo',
        y: 'Hi6nGpk43slcOIpAgtfvATtB9S-bJXUf_eJU5LlCdmU',
        d: 'jsJBHZsrj8mrxu02ZeDHuFnUp7BoWSmjPOW-ilTA5UU' }
,
    'publicKey': 'BHuKnvcWtsuvWGWvjaMUQEQZOIxyL/dp9whSAF7T3yyqHi6nGpk43slcOIpAgtfvATtB9S+bJXUf/eJU5LlCdmU=',
    'address': 'uytXu0m1+nnY62zpILhPi7pakho='
};
Dummy.users[17] = {
    'privateKey':
    { kty: 'EC',
        crv: 'P-256',
        key_ops: [ 'sign' ],
        x: 'eQiNL4_u7w0M7YETvpOYGAtAHEnd-M7K-6E-cxQAX0A',
        y: '__PVVnLYXM1mzIyShGiVqLH1PJmPZXNqX6Jp3AcYRyM',
        d: '08VVxX6efkYj_-r3cuuE3SGc5Cm-Lje5k9i0oDQKicY' }
,
    'publicKey': 'BHkIjS+P7u8NDO2BE76TmBgLQBxJ3fjOyvuhPnMUAF9A//PVVnLYXM1mzIyShGiVqLH1PJmPZXNqX6Jp3AcYRyM=',
    'address': 'pQMKW4qMn7QCw2N/b9dcVJlRRc0='
};
Dummy.users[18] = {
    'privateKey':
    { kty: 'EC',
        crv: 'P-256',
        key_ops: [ 'sign' ],
        x: 'vIDR3qtGE_E1GbOU6cN-B4F-ms4BdpcgBbxrp1sMQLg',
        y: 'TMNrr4YAE_K6e9ztk2c9S1npt4nzjzzvRTmunCg7El8',
        d: 'Ru-aVl9tgBufFjnXz2CbiMkDyJeAnkclNmxe6twcFuA' }
,
    'publicKey': 'BLyA0d6rRhPxNRmzlOnDfgeBfprOAXaXIAW8a6dbDEC4TMNrr4YAE/K6e9ztk2c9S1npt4nzjzzvRTmunCg7El8=',
    'address': 'L+GZprcuXkhfhzSiPDbT8TrHqkM='
};
Dummy.users[19] = {
    'privateKey':
    { kty: 'EC',
        crv: 'P-256',
        key_ops: [ 'sign' ],
        x: 'kBwVcbE01QdINiKlysy4vjIbFyqz7CTurRakfxr0bOo',
        y: 'ZoOpfaLyNxdRs_aQTUOIC9ktjvIryBaez9Ap8T1gXCI',
        d: 'UFSq2f6cwySXCW8klAnLww9lIo572MJnbgNmbfasbdw' }
,
    'publicKey': 'BJAcFXGxNNUHSDYipcrMuL4yGxcqs+wk7q0WpH8a9GzqZoOpfaLyNxdRs/aQTUOIC9ktjvIryBaez9Ap8T1gXCI=',
    'address': '8mBo0QlQITWiAI8qON6KGsqsYvQ='
};







// # Dummy Generators
//
// ## sha256 hash
//
// Crypto
// 	.sha256(BufferUtils.fromAscii('hello'))
//     .then(BufferUtils.toBase64)
//     .then(copy)
//
//
//
// ## Address
//
// Crypto
// 	.sha256(BufferUtils.fromAscii('should be the public key'))
//     .then(hash => hash.slice(0,20))
//     .then(BufferUtils.toBase64)
//     .then(copy)
//
//
//
// ## publicKey
//
// Crypto
// 	.generateKeys()
// 	.then(keys => Crypto.exportPublic(keys.publicKey))
// 	.then(BufferUtils.toBase64)
// 	.then(copy)

//
// ## users
//
// Dummy.generatedUsers = (async () => {
//     console.log('generate users');
//     const users = await TestBlockchain.generateUsers(20);
//     for (let i = 0; i < users.length; i++) {
//         const user = users[i];
//         console.log(`Dummy.users[${i}] = {`);
//         console.log('\'privateKey\':');
//         console.log(user.privateKey);
//         console.log(',');
//         console.log(`'public key': '${  user.publicKey.toBase64()  }',`);
//         console.log(`'address': '${  user.address.toBase64()}'`);
//         console.log('}');
//     }
//     return users;
// })();
