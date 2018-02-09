/* abstract */
class Signer {
    /** @async */
    constructor($, address, enforcedType = null) {
        this.$ = $;
        this._address = address;
        this._enforcedType = enforcedType;
        return Utils.getAccount($, address).then(account => {
            if (!account) throw Error(`Account ${address.toUserFriendlyAddress()} not found.`);
            if (account.type !== this.realType) throw Error('Account type does not match address.');
            this._account = account;
            return this;
        });
    }

    get address() {
        return this._address;
    }

    get type() {
        return this._enforcedType || this.realType;
    }

    get realType() {
        throw Error('Abstract Class');
    }

    sign(tx) {
        throw Error('Abstract Class');
    }
}

class SingleSigSigner extends Signer {
    /** @async */
    constructor($, address, enforcedType = null) {
        let _this;
        return super($, address, enforcedType)
            .then(instance => {
                _this = instance;
                return $.walletStore.get(_this._address);
            })
            .then(wallet => {
                _this._wallet = wallet;
                return _this;
            });
    }

    get realType() {
        return Nimiq.Account.Type.BASIC;
    }

    get publicKey() {
        return this._wallet.keyPair.publicKey;
    }

    sign(tx) {
        const keyPair = this._wallet.keyPair;
        const signature = Nimiq.Signature.create(keyPair.privateKey, keyPair.publicKey, tx.serializeContent());
        const proof = Nimiq.SignatureProof.singleSig(keyPair.publicKey, signature).serialize();
        return {
            signature: signature,
            proof: proof
        };
    }
}

class MultiSigSigner extends Signer {
    /** @async */
    constructor($, address, signingAddresses, enforcedType = null) {
        let _this;
        return super($, address, enforcedType)
            .then(instance => {
                _this = instance;
                return Promise.all(signingAddresses.map(address => $.walletStore.get(address)));
            })
            .then(wallets => wallets.map(wallet => wallet.keyPair))
            .then(keyPairs => {
                _this._publicKeys = keyPairs.map(keyPair => keyPair.publicKey);
                _this._signingWallets =  keyPairs.map(keyPair =>
                    Nimiq.MultiSigWallet.fromPublicKeys(keyPair, signingAddresses.length, _this._publicKeys));
                _this._aggregatedPublicKey = Nimiq.PublicKey.sum(_this._publicKeys);
                return _this;
            });
    }

    get realType() {
        return Nimiq.Account.Type.BASIC;
    }

    get publicKey() {
        return this._aggregatedPublicKey;
    }

    sign(tx) {
        const commitmentPairs = this._signingWallets.map(wallet => wallet.createCommitment());
        const aggregatedCommitment = Nimiq.Commitment.sum(commitmentPairs.map(pair => pair.commitment));
        const partialSignatures = this._signingWallets.map((wallet, index) =>
            wallet.signTransaction(tx, this._publicKeys, aggregatedCommitment, commitmentPairs[index].secret));
        const signature = Nimiq.Signature.fromPartialSignatures(aggregatedCommitment, partialSignatures);
        const proof = Nimiq.SignatureProof.multiSig(this._aggregatedPublicKey, this._publicKeys, signature).serialize();
        return {
            signature: signature,
            proof: proof
        };
    }
}

class VestingSigner extends Signer {
    /** @async */
    constructor($, address, vestingOwnerSigner = null, enforcedType = null) {
        let _this;
        return super($, address, enforcedType).then(instance => {
            _this = instance;
            if (vestingOwnerSigner === null) {
                return new SingleSigSigner($, _this._account.owner).then(signer => {
                    _this._vestingOwnerSigner = signer;
                    return _this;
                });
            } else {
                _this._vestingOwnerSigner = vestingOwnerSigner;
                return _this;
            }
        });
    }

    get realType() {
        return Nimiq.Account.Type.VESTING;
    }

    sign(tx) {
        return this._vestingOwnerSigner.sign(tx);
    }
}

class HtlcSigner extends Signer {
    /** @async */
    constructor($, address, proofType = Nimiq.HashedTimeLockedContract.ProofType.REGULAR_TRANSFER,
                proofHashAlgorithm = Nimiq.Hash.Algorithm.BLAKE2B, proofHashPreImage = '',
                proofHashDepth = 0, proofHashCount = 0, htlcSenderSigner = null, htlcRecipientSigner = null,
                enforcedType = null) {
        let _this;
        return super($, address, enforcedType).then(instance => {
            _this = instance;
            _this._proofType = proofType;
            _this._proofHashAlgorithm = proofHashAlgorithm;
            _this._proofHashPreImage = proofHashPreImage;
            _this._proofHashDepth = proofHashDepth;
            _this._proofHashCount = proofHashCount;
            return _this._getSigners(htlcSenderSigner, htlcRecipientSigner).then(signers => {
                _this._signers = signers;
                return _this;
            });
        });
    }

    get realType() {
        return Nimiq.Account.Type.HTLC;
    }

    sign(tx) {
        const signatureProofs = this._signers.map(signer => signer.sign(tx).proof);

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

        signatureProofs.forEach(signatureProof => proof.write(signatureProof));
        return {
            proof: proof
        };
    }

    /** @async */
    _getSigners(htlcSenderSigner = null, htlcRecipientSigner = null) {
        const signerPromises = [];
        if (this._proofType === Nimiq.HashedTimeLockedContract.ProofType.REGULAR_TRANSFER
            || this._proofType === Nimiq.HashedTimeLockedContract.ProofType.EARLY_RESOLVE) {
            signerPromises.push(htlcRecipientSigner? Promise.resolve(htlcRecipientSigner)
                : new SingleSigSigner($, this._account.recipient));
        }
        if (this._proofType === Nimiq.HashedTimeLockedContract.ProofType.EARLY_RESOLVE
            || this._proofType === Nimiq.HashedTimeLockedContract.ProofType.TIMEOUT_RESOLVE) {
            signerPromises.push(htlcSenderSigner? Promise.resolve(htlcSenderSigner)
                : new SingleSigSigner($, this._account.sender));
        }
        return Promise.all(signerPromises);
    }

    _calculateTotalProofSize(proofType, hashAlgorithm, signatureProofs) {
        const expectedProofCount = proofType === Nimiq.HashedTimeLockedContract.ProofType.EARLY_RESOLVE? 2 : 1;
        if (signatureProofs.length !== expectedProofCount) throw Error('Unexpected number of proofs.');

        const signatureProofsSize = signatureProofs.reduce(
            (size, signatureProof) => size + signatureProof.byteLength, 0);

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
