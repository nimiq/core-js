/* abstract */
class Sender {
    /* async */
    constructor(address, $) {
        this.$ = $;
        this._address = address;
        return Utils.getAccount($, address).then(account => {
            if (!account) throw Error(`Account ${address.toUserFriendlyAddress()} not found.`);
            if (this.type !== account.type) throw Error('Address has wrong sender type.');
            this._account = account;
            return this;
        });
    }

    get address() {
        return this._address;
    }

    get type() {
        throw Error('Abstract method.');
    }

    get signingAddress() {
        return this._address;
    }

    /* async */
    sign(tx) {
        return this.$.walletStore.get(this.signingAddress).then(wallet => {
            const keyPair = wallet.keyPair;
            const signature = Nimiq.Signature.create(keyPair.privateKey, keyPair.publicKey, tx.serializeContent());
            tx.signature = signature;
            tx.proof =  Nimiq.SignatureProof.singleSig(keyPair.publicKey, signature).serialize();
        }).catch(e => {
            alert(`KeyPair for address ${this.signingAddress.toUserFriendlyAddress()} not available.`);
            throw e;
        });
    }
}

class WalletSender extends Sender {
    constructor(address, $) {
        let _this;
        return super(address, $)
            .then(instance => {
                _this = instance;
                return _this.$.walletStore.get(_this.signingAddress);
            })
            .then(wallet => {
                _this._publicKey = wallet.keyPair.publicKey;
                return _this;
            });
    }

    get type() {
        return Nimiq.Account.Type.BASIC;
    }

    get publicKey() {
        return this._publicKey;
    }
}

class VestingSender extends Sender {
    constructor(address, $, enforcedVestingOwner = null) {
        let _this;
        return super(address, $).then(instance => {
            _this = instance;
            _this._vestingOwner = enforcedVestingOwner || _this._account.owner;
            return _this;
        });
    }

    get type() {
        return Nimiq.Account.Type.VESTING;
    }

    get signingAddress() {
        return this._vestingOwner;
    }
}

class HtlcSender extends Sender {
    /* async */
    constructor(address, $, proofType = Nimiq.HashedTimeLockedContract.ProofType.REGULAR_TRANSFER,
                proofHashAlgorithm = Nimiq.Hash.Algorithm.BLAKE2B, proofHashPreImage = '',
                proofHashDepth = 0, proofHashCount = 0, enforcedHtlcSender = null, enforcedHtlcRecipient = null) {
        let _this;
        return super(address, $).then(instance => {
            _this = instance;
            _this._proofType = proofType;
            _this._proofHashAlgorithm = proofHashAlgorithm;
            _this._proofHashPreImage = proofHashPreImage;
            _this._proofHashDepth = proofHashDepth;
            _this._proofHashCount = proofHashCount;
            _this._htlcSender = enforcedHtlcSender || _this._account.sender;
            _this._htlcRecipient = enforcedHtlcRecipient || _this._account.recipient;
            return _this;
        });
    }

    get type() {
        return Nimiq.Account.Type.HTLC;
    }

    get signingAddress() {
        switch (this._proofType) {
            case Nimiq.HashedTimeLockedContract.ProofType.REGULAR_TRANSFER:
                return this._htlcRecipient;
            case Nimiq.HashedTimeLockedContract.ProofType.EARLY_RESOLVE:
                return [this._htlcRecipient, this._htlcSender];
            case Nimiq.HashedTimeLockedContract.ProofType.TIMEOUT_RESOLVE:
                return this._htlcSender;
        }
        throw Error('Unknown HTLC Proof Type.');
    }

    /* async */
    sign(tx) {
        let signingAddresses = this.signingAddress;
        if (!Array.isArray(signingAddresses)) signingAddresses = [signingAddresses];

        return Promise.all(
            signingAddresses.map(address => this.$.walletStore.get(address))
        ).then(wallets => {
            const serializedTransaction = tx.serializeContent();
            const signatureProofs = wallets.map(wallet => {
                const keyPair = wallet.keyPair;
                const signature = Nimiq.Signature.create(keyPair.privateKey, keyPair.publicKey, serializedTransaction);
                return Nimiq.SignatureProof.singleSig(keyPair.publicKey, signature);
            });

            const proofSize = this._calculateTotalProofSize(this._proofType, this._proofHashAlgorithm, signatureProofs);
            const proof = new Nimiq.SerialBuffer(proofSize);

            proof.writeUint8(this._proofType);

            if (this._proofType === Nimiq.HashedTimeLockedContract.ProofType.REGULAR_TRANSFER) {
                let hash = Nimiq.BufferUtils.fromAscii(this._proofHashPreImage);
                for (let i = 0; i < this._proofHashCount - this._proofHashDepth; ++i) {
                    hash = Utils.hash(hash, this._proofHashAlgorithm);
                }
                let root = hash;
                for (let i = 0; i < this._proofHashDepth; i++) {
                    root = Utils.hash(root, this._proofHashAlgorithm);
                }

                proof.writeUint8(this._proofHashAlgorithm);
                proof.writeUint8(this._proofHashDepth);
                proof.write(root);
                proof.write(hash);
            }

            signatureProofs.forEach(signatureProof => signatureProof.serialize(proof));
            tx.proof = proof;
        }).catch(e => {
            alert(e || 'KeyPair not available.');
            throw e;
        });
    }

    _calculateTotalProofSize(proofType, hashAlgorithm, signatureProofs) {
        const expectedProofCount = proofType === Nimiq.HashedTimeLockedContract.ProofType.EARLY_RESOLVE? 2 : 1;
        if (signatureProofs.length !== expectedProofCount) throw Error('Unexpected number of proofs.');

        const signatureProofsSize = signatureProofs.reduce(
            (size, signatureProof) => size + signatureProof.serializedSize, 0);

        if (proofType === Nimiq.HashedTimeLockedContract.ProofType.REGULAR_TRANSFER) {
            return /* proof type */ 1
                + /* algorithm */ 1
                + /* hash depth */ 1
                + /* hash root */ Nimiq.Hash.getSize(hashAlgorithm)
                + /* hashed pre image */ Nimiq.Hash.getSize(hashAlgorithm)
                + /* signature proof */ signatureProofsSize;
        } else {
            return /* proof type */ 1 + signatureProofsSize;
        }
    }
}
