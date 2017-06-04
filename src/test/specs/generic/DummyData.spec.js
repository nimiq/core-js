const Dummy = {};

Dummy.hash1 = 'LPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ='; // "hello"
Dummy.hash2 = 'hymMwvMfunMYHqKp5u8Q3OIe2V6YvaycThUE6hb0huQ='; // "hello2"
Dummy.hash3 = 'R+pwzwiHK9tK+tNDKwHZY6x9Fl9rV1zXLvR0mPRFmpA='; // "hello3"

Dummy.publicKey1 = 'jzCk2TjUEw0aM5be3hUFxyt/dayfm4DRrX42iznzsQUXN0opCANPARUmEQ9iqKE4D/rTkY3EfT1ffEYisrA/rw==';
Dummy.publicKey2 = 'cz/rSo+0DVR8U76kmDLUBORFQQ5PuHRt0BT6Zliiq0MkYUALY9mWCDPGSbuli4vORAdz7ALjTl8dXVbmMNfpAA==';
Dummy.publicKey3 = 'cpuVovyj7DCI7a8R7wyc/swZyl+S5IYhdZBcnZJVoRKCropHrWo/4dES7ieso2jlZteOzAds4dddWpC/H+ElIQ==';
Dummy.publicKey4 = '3pQ3TSNu94KriSoWCMZorAE7N1EhYsOTYxWeCkZt9f8x/FUvq16gRqK7Te12Xrqgj2hD5DJZSoukxlwima5W0Q==';
Dummy.publicKey5 = 'nfiNBLRtgH6ImIEthsxUsayGnvYGCXAGutocYeTWRYcCnt4db0ermqIPA3qlj9CgmoASMj9XtFxEm88XxoNszg==';

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

if (typeof global !== 'undefined') {
    global.Dummy = Dummy;
}

/* Testing Genesis Block */
Block.GENESIS = new Block(
    new BlockHeader(
        new Hash(null),
        new Hash(BufferUtils.fromBase64('b/JHHIpQ1pV0PO+38ep0q8xH1jHdPduqJhSzQOd8BUE=')),
        new Hash(BufferUtils.fromBase64('V9adVnWYF9TDwq6YR3Tz8NlOEh8dQQfdUGMGf0Wa+B0=')),
        BlockUtils.difficultyToCompact(1),
        1,
        0,
        0),
    new BlockBody(new Address(BufferUtils.fromBase64('ySpv9NQBK2YgycXIfMH8Mr+JfaM=')), [])
);
// Store hash for synchronous access
Block.GENESIS.hash().then(hash => {
    Block.GENESIS.HASH = hash;
    Object.freeze(Block.GENESIS);
});

