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

if (typeof global !== 'undefined') {
    global.Dummy = Dummy;
}
