const Dummy = {};

Dummy.hash1 = 'LPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ='; // "hello"
Dummy.hash2 = 'hymMwvMfunMYHqKp5u8Q3OIe2V6YvaycThUE6hb0huQ='; // "hello2"
Dummy.hash3 = 'R+pwzwiHK9tK+tNDKwHZY6x9Fl9rV1zXLvR0mPRFmpA='; // "hello3"

Dummy.publicKey1 = 'q7fOuowiDsCY9ScBMye1BFIL8OqgAzhKhtmt9ekPLdSO+hnvpoJ26ENwPpZ1lSYA7sYLye4AIEzBTKYrgYWLgA=='; // "hello1"
Dummy.publicKey2 = 'dMix+J868YX/8Mu8CSo2muRk+nm+kbtARLK/c1b7QsY+udhv35ppjbQaWdauBt7PWvIX4NeNwt0TMMfT7XXr/A=='; // "hello1"
Dummy.publicKey3 = '41gtV3yVcTDtEhsKtQVdm63WATyCd9aTR2FVCW6xbSiM47/YgNjYtLHO1zNG32TFADIkWFF/0hHrz3Ovo3cduQ=='; // "hello1"

Dummy.address1 = 'kekkD0FSI5gu3DRVMmMHEOlKf1I='; // "hello1"
Dummy.address2 = 'hymMwvMfunMYHqKp5u8Q3OIe2V4='; // "hello2"
Dummy.address3 = 'R+pwzwiHK9tK+tNDKwHZY6x9Fl8='; // "hello3"

Dummy.signature1 = 'yn57dWMc9EQVuvuzmoi+36ftTKXLBvpPkLkSUvi33gtUbq6iY5LtiaQzr5Z9DXBxoyBlFllubqpWMzdcLTyesA==';
Dummy.signature2 = '00v2Siqx3zh1bcoofmw4LVzYFuDKpcmStEl8zZeBpYZ6chVU0eeuP+i+/CuNIRhomW5HRybcPvhTUqhxFpl/sw==';
Dummy.signature3 = 'mU04AuXE5QcLPPvQbtdWzjHeB6oNVjxdfPRXfPWmJx/YgBAIFfogOT7wasBiOIx8n/YKMoK0VWLVarl2KLiKvQ==';



 /* 

# Dummy Generators 


## Address

Crypto
	.sha256(BufferUtils.fromUnicode('hello'))
    .then(hash => hash.slice(0,20))
    .then(BufferUtils.toBase64)
    .then(copy)


## sha256 hash

Crypto
	.sha256(BufferUtils.fromUnicode('hello'))
    .then(BufferUtils.toBase64)
    .then(copy)

## publicKey

Crypto
	.generateKeys()
	.then(keys => Crypto.exportPublic(keys.publicKey))
	.then(BufferUtils.toBase64)
	.then(copy)


  */