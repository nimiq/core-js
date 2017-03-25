# Development
Run `./serve`


# Philosophy

- Complexity is the enemy. 
	- There is only a single feature: secure & fast transactions from userA to userB.
	- Reduce code => reduce effort to review => reduce bugs => increase security 
	- Aim for clean, simple, reviewable and testable code.
	- This project is all about the minimum viable core. No UI.

- Use standards, use the platform.
	- WebCrypto, WebRTC, IndexedDB, ES6, Promises, Password Storage, ...
	- Avoid frameworks and hypes. Target modern browser APIs. 
	- Functional programming is awesome. Immutable objects are awesome.
	- Build light-weight single-purpose libraries on top of the platform.
		- A library isn't secure when you need to ship it minified!
	- Don't give a fuck about outdated browsers. Backwards compatibilty may not harm the core. 

- Tools are the enemy.
	- The longer the toolchain the harder to get involved, review, and build trust.
	- Reduce dependencies wherever you can.
		- Use one-line dev-servers 
		- No build tools except for concatenation into a single html-file  
		- static hosting ( even from file:// )

- Everything is decentralized. 
	- There is no single point of failure or centralized power accepted.

- It is based on the ideas of 	
	- [The Mini-Blockchain Scheme](http://cryptonite.info/files/mbc-scheme-rev2.pdf)
- Blueprint is the Bitcoin whitepaper and the bitcoin core implementation. 
	- [Bitcoin Protocol Documentation](https://en.bitcoin.it/wiki/Protocol_documentation)
		- [Protocol Rules](https://en.bitcoin.it/wiki/Protocol_rules)
		- [Block Exchange](https://en.bitcoin.it/wiki/Satoshi_Client_Block_Exchange)
		- [Download Behavior](https://en.bitcoin.it/wiki/Block_chain_download)
		- [DOS Protection](https://en.bitcoin.it/wiki/Weaknesses#Denial_of_Service_.28DoS.29_attacks)
	- Decentralized mining
	- [What does it take to make a crypro currency?](https://www.quora.com/What-does-it-take-to-make-a-cryptocurrency) 
		- [Complete Guide on How to Create a New Alt Coin](https://bitcointalk.org/index.php?topic=225690.0)
	- [Light-weight design](https://docs.google.com/spreadsheets/d/1UBwjSX0oDtPKUYTN0e0m4W62zGxgku6RADbmM9kEJrQ/
	edit?usp=sharing) 
		- limited in features
		- no "smart" contracts - webcoin is dead simple
		- ultra compressed, zero-trust blockchain 
			- [Thin Clients in Bitcoin](https://en.bitcoin.it/wiki/Thin_Client_Security#Header-Only_Clients)
			- [On the Security and Performance of Proof of Work Blockchains](https://eprint.iacr.org/2016/555.pdf)
			- [One-way Accumulators](http://download.springer.com/static/pdf/481/chp%253A10.1007%252F3-540-48285-7_24.pdf?originUrl=http%3A%2F%2Flink.springer.com%2Fchapter%2F10.1007%2F3-540-48285-7_24&token2=exp=1486134314~acl=%2Fstatic%2Fpdf%2F481%2Fchp%25253A10.1007%25252F3-540-48285-7_24.pdf%3ForiginUrl%3Dhttp%253A%252F%252Flink.springer.com%252Fchapter%252F10.1007%252F3-540-48285-7_24*~hmac=08e95c31be59503fcb5771ea0412338df4d126b07626a0fe0ed181f010e6fac7)
- Built-in Features
	- [Lightning Network](https://lightning.network/lightning-network-paper.pdf)
		- [Necessary Contract](https://youtu.be/8zVzw912wPo?t=21m56s)
	- [P2P Cloud Storage](https://storj.io/storj.pdf)

# WebCoin Architecture 

## Core 
- Signatures
- Proof of Work
- State Consensus
- P2P Network
- Local Database
- Modern Browser Features

## Signatures
- Space efficiency target: 
	- addresses: max 20 byte 
	- signed-transaction: max 100 bytes  
- Method: 
	- Public Key Recovery 
		- http://crypto.stackexchange.com/questions/18105/how-does-recovering-the-public-key-from-an-ecdsa-signature-work
		- http://crypto.stackexchange.com/questions/42134/ecdsa-pubkey-recovery-issue
		- [elliptic.js](https://github.com/indutny/elliptic/issues/36)
			- [PCR implementation](https://github.com/indutny/elliptic/blob/cbace4683a4a548dc0306ef36756151a20299cd5/lib/elliptic/ec/index.js#L190)
		- [Stanford Crypto Library](http://bitwiseshiftleft.github.io/sjcl/doc/symbols/sjcl.ecc.curve.html)
		- https://hal-lirmm.ccsd.cnrs.fr/lirmm-00424288/file/article-parco09.pdf
		- https://eprint.iacr.org/2014/198.pdf
- Candidates: 
	- SECP256k1
		- [Is the seed for SECP256r1 cooked by the NSA?](http://crypto.stackexchange.com/questions/10263/should-we-trust-the-nist-recommended-ecc-parameters)
	- Lamport Signatures 
	- [WebCrypto](https://github.com/diafygi/webcrypto-examples)
		- [ECDSA](https://github.com/cryptocoinjs/ecdsa/blob/master/lib/ecdsa.js#L114-L152)
		- [EC Arithmetic](https://cdn.rawgit.com/andreacorbellini/ecc/920b29a/interactive/modk-add.html)
- [Key Storage](https://www.w3.org/TR/2016/PR-WebCryptoAPI-20161215/#concepts-key-storage)


## Mining & Proof of Work
- How to dezentralize mining power? 
- ASIC-resitant Hash functions
	- [webGl scrypt](https://github.com/Kukunin/webgl-scrypt)
	- [Memory hard POW](http://bitcoin.stackexchange.com/questions/36622/is-there-a-proof-of-work-system-which-takes-significantly-more-memory-to-generat)
	- [M7 POW](http://cryptonite.info/wiki/index.php?title=M7_PoW)
	- [Cuckoo Cycle](https://github.com/tromp/cuckoo)
- Policy & Fees
	- [Fees in Bitcoin](https://github.com/bitcoin/bitcoin/blob/master/src/policy/fees.h)
	- [Policy in Bitcoin](https://github.com/bitcoin/bitcoin/blob/master/src/policy/policy.h)

## State Consensus
- Space efficiency target: 
	- Less then 10mb for proof of current state and transactions
- Methods
	- [Cryptographic Data Structures](https://blog.bren2010.io/2015/04/07/data-structures.html)
		- [Efficient cryptographic datastructures](http://www.cse.msstate.edu/~ramkumar/gw-102.pdf)
	- transactions operate on the world-state instead of outputs
	- patricia merkle tries to represent world-state
		- [Introduction to Tries](http://courses.csail.mit.edu/6.851/spring12/lectures/L16.html)
		- [Merke-Patricia Tries](https://github.com/ethereum/wiki/wiki/Patricia-Tree) 
	- [GHOST Protocol](http://www.cs.huji.ac.il/~avivz/pubs/13/btc_scalability_full.pdf)

## P2P Network
- WebRTC 
- [WebRTC Protocol](https://mdn.mozillademos.org/files/6119/webrtc-complete-diagram.png)
	- https://rtcweb-wg.github.io/security-arch/
	- http://webrtc-security.github.io/
	- http://strews.ercim.eu/images/webrtc.pdf
	- https://webrtchacks.com/webrtc-and-man-in-the-middle-attacks/
	- [ECDSA Signatures](https://developers.google.com/web/updates/2016/06/webrtc-ecdsa)
- Minimal Signaling 
	- [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)
	- [WebSockets]() ?
	- [WebRTC DTMF](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Using_DTMF) ?
	- [QR-codes](http://franklinta.com/2014/10/19/serverless-webrtc-using-qr-codes/) ?
	- [PWNAT](http://samy.pl/pwnat/pwnat.pdf)
	- [SSH Tunneling](https://vimeo.com/54505525)

## Local Database
- IndexedDB

## Modern Browser Features
- ES6 Classes
- ES6 Arrow Functions
- Promises, async, await
- ArrayBuffer
- [Memory efficient JS](https://www.smashingmagazine.com/2012/11/writing-fast-memory-efficient-javascript/)
- Not supported yet: WebASM
- Not supported yet: require, import
- IndexedDB [Persistent Storage](https://developers.google.com/web/updates/2016/06/persistent-storage)
- [Payment API](https://developers.google.com/web/fundamentals/discovery-and-monetization/payment-request/)
- [parallel primitives](https://hacks.mozilla.org/2016/05/a-taste-of-javascripts-new-parallel-primitives/)

## Platform constrains
- [Integer Precision](http://stackoverflow.com/questions/307179/what-is-javascripts-highest-integer-value-that-a-number-can-go-to-without-losin)
	- `Note that the bitwise operators and shift operators operate on 32-bit ints, so in that case, the max safe integer is 231-1, or 2147483647.`
	- `Number.MAX_SAFE_INTEGER`

# Privacy 
- [Mimblewimble](https://download.wpsoftware.net/bitcoin/wizardry/mimblewimble.txt)

# Peer2Peer Exchanges 
- [Paypal APIs]()
- [Visa APIs](https://developer.visa.com/)

# Roadmap
1. Testnet with MVP chain
2. Launch MVP Chain 
3. Optimize Space 
4. Optimize POW
5. Optimize Privacy



