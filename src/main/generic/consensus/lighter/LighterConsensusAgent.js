class LighterConsensusAgent extends LightConsensusAgent {
    /**
     * @param {LighterChain} blockchain
     * @param {Mempool} mempool
     * @param {Time} time
     * @param {Peer} peer
     * @param {InvRequestManager} invRequestManager
     * @param {Subscription} targetSubscription
     */
    constructor(blockchain, mempool, time, peer, invRequestManager, targetSubscription) {
        super(blockchain, mempool, time, peer, invRequestManager, targetSubscription);
        /** @type {LighterChain} */
        this._blockchain = blockchain;
        /** @type {ProofPartialAccountsTree} */
        this._partialTree = null;
        /** @type {Array.<Block>} */
        this._pendingBlocks = [];
        /** @type {HashSet.<Address>} */
        this._pendingTxProofs = new HashSet();
        /** @type {Array.<function>} */
        this._pendingTxProofResolves = [];

        peer.channel.on('accounts-proof', (msg) => this._onAccountsProof(msg));
    }

    async _syncPartialChain() {
        switch (this._partialChain.state) {
            case PartialLightChain.State.PROVE_CHAIN:
                this._requestChainProof();
                this.fire('sync-chain-proof', this._peer.peerAddress);
                break;
            case PartialLightChain.State.BEFORE_PROVE_ACCOUNTS:
                this._requestProofBlocks();
                this.fire('load-blocks');
                break;
            case PartialLightChain.State.PROVE_ACCOUNTS_TREE:
                await this._requestAccountsTree();
                this.fire('sync-accounts-tree', this._peer.peerAddress);
                break;
            case PartialLightChain.State.COMPLETE:
                // Commit state on success.
                this.fire('sync-finalize', this._peer.peerAddress);
                this._busy = true;
                await this._partialChain.commit();
                await this._applyOrphanedBlocks();
                this._syncFinished();
                break;
            case PartialLightChain.State.ABORTED:
                this._peer.channel.close(CloseType.ABORTED_SYNC, 'aborted sync');
                break;
            case PartialLightChain.State.WEAK_PROOF:
                Log.d(LighterConsensusAgent, `Not syncing with ${this._peer.peerAddress} - weaker proof`);
                this._numWeakProofs++;
                if (this._numWeakProofs >= LightConsensusAgent.WEAK_PROOFS_MAX) {
                    this._peer.channel.close(CloseType.BLOCKCHAIN_SYNC_FAILED, 'too many weak proofs');
                } else {
                    this._syncFinished();
                }
                break;
        }
    }


    async _requestAccountsTree() {
        Assert.that(this._partialChain && this._partialChain.state === PartialLightChain.State.PROVE_ACCOUNTS_TREE);
        Assert.that(this._accountsRequest === null);
        this._busy = true;

        const addresses = PartialAccounts.gatherAllAddressesForBlocks(this._pendingBlocks).sort((a, b) => a.toHex() < b.toHex() ? -1 : a.toHex() > b.toHex() ? 1 : 0);
        const headHash = this._partialChain.headHash;
        this._partialTree = await this._blockchain.accounts._tree.transaction();

        for (let i = 0; i < addresses.length; i += GetAccountsProofMessage.ADDRESSES_MAX_COUNT) {
            const proof = await this.getAccountsProof(headHash, addresses.slice(i, i + GetAccountsProofMessage.ADDRESSES_MAX_COUNT));
            await this._partialTree.pushProof(proof, i === 0);
        }

        this._partialChain.setPartialTreeTx(this._partialTree.tx);
        this._partialChain.setAccountsTx(new PartialAccounts(await this._partialTree.transaction()));
        this._partialChain._state = PartialLightChain.State.PROVE_BLOCKS;
        for (let block of this._pendingBlocks.reverse()) {
            const hash = block.hash();
            const status = await this._chain.pushBlock(block);

            if (!(await this._handlePushBlockResult(hash, block, status))) {
                this._partialChain._state = PartialLightChain.State.ABORTED;
                break;
            }
        }
        this._pendingBlocks = [];
        this._busy = false;
        this.syncBlockchain().catch(Log.w.tag(LighterConsensusAgent));
    }

    /**
     * @param {AccountsProofMessage} msg
     * @returns {Promise.<void>}
     * @private
     */
    async _onAccountsProof(msg) {
        Log.d(LighterConsensusAgent, `[ACCOUNTS-PROOF] Received from ${this._peer.peerAddress}: blockHash=${msg.blockHash}, proof=${msg.proof} (${msg.serializedSize} bytes)`);

        // Check if we have requested an accounts proof, reject unsolicited ones.
        if (!this._accountsRequest) {
            Log.w(LighterConsensusAgent, `Unsolicited accounts proof received from ${this._peer.peerAddress}`);
            // TODO close/ban?
            return;
        }

        const addresses = this._accountsRequest.addresses;
        const blockHash = this._accountsRequest.blockHash;
        const resolve = this._accountsRequest.resolve;
        const reject = this._accountsRequest.reject;

        // Reset accountsRequest.
        this._accountsRequest = null;

        if (!msg.hasProof()) {
            reject(new Error('Accounts request was rejected'));
            return;
        }

        // Check that the reference block corresponds to the one we requested.
        if (!blockHash.equals(msg.blockHash)) {
            Log.w(LighterConsensusAgent, `Received AccountsProof for invalid reference block from ${this._peer.peerAddress}`);
            reject(new Error('Invalid reference block'));
            return;
        }

        // Verify the proof.
        const proof = msg.proof;
        if (!proof.verify()) {
            Log.w(LighterConsensusAgent, `Invalid AccountsProof received from ${this._peer.peerAddress}`);
            // TODO ban instead?
            this._peer.channel.close(CloseType.INVALID_ACCOUNTS_PROOF, 'Invalid AccountsProof');
            reject(new Error('Invalid AccountsProof'));
            return;
        }

        // Check that the proof root hash matches the accountsHash in the reference block.
        const rootHash = proof.root();
        const block = await this._blockchain.getBlock(blockHash) || (this._partialChain && await this._partialChain.getBlock(blockHash));
        if (block && !block.accountsHash.equals(rootHash)) {
            Log.w(LighterConsensusAgent, `Invalid AccountsProof (root hash) received from ${this._peer.peerAddress}`);
            // TODO ban instead?
            this._peer.channel.close(CloseType.ACCOUNTS_PROOF_ROOT_HASH_MISMATCH, 'AccountsProof root hash mismatch');
            reject(new Error('AccountsProof root hash mismatch'));
            return;
        }

        // Check that all requested accounts are part of this proof.
        // XXX return a map address -> account instead?
        const accounts = [];
        for (const address of addresses) {
            try {
                const account = proof.getAccount(address);
                accounts.push(account);
            } catch (e) {
                Log.w(LighterConsensusAgent, `Incomplete AccountsProof received from ${this._peer.peerAddress}`);
                // TODO ban instead?
                this._peer.channel.close(CloseType.INCOMPLETE_ACCOUNTS_PROOF, 'Incomplete AccountsProof');
                reject(new Error('Incomplete AccountsProof'));
                return;
            }
        }

        // Return the retrieved accounts.
        resolve(msg.proof);
    }

    async _onAccountsTreeChunk(msg) {
        // Ignore
    }

    _onPartialChainProofAccepted() {
        this._pendingBlocks = [];
    }

    async _onPartialChainAborted() {
        this._pendingBlocks = [];
    }

    async _onPartialChainCommitted() {
        this._pendingBlocks = [];
    }

    /**
     * @param {Hash} hash
     * @param {Transaction} transaction
     * @returns {Promise.<boolean>}
     * @private
     */
    async _processTransaction(hash, transaction) {
        if (!this._partialChain) {
            const missing = await this._blockchain.accounts.missingAddreses([transaction.sender, transaction.recipient]);
            if (missing.length > 0) {
                Log.d(LighterConsensusAgent, `Fetch missing proof to apply tx ${transaction.hash()}`);
                await this.applyAccountsProofLater(missing);
            }
            return LightConsensusAgent.prototype._processTransaction.call(this, hash, transaction);
        }
        return false;
    }

    /**
     * @param {Array.<Address>} addresses
     * @returns {Promise}
     */
    applyAccountsProofLater(addresses) {
        return new Promise((resolve) => {
            this._pendingTxProofs.addAll(addresses);
            this._pendingTxProofResolves.push(resolve);
            this._timers.clearTimeout('applyAccountsProofLater');
            if (this._pendingTxProofs.length > 100) {
                this._applyAccountsProofLater();
            } else {
                this._timers.setTimeout('applyAccountsProofLater', this._applyAccountsProofLater.bind(this), 1000);
            }
        });
    }

    async _applyAccountsProofLater() {
        const addresses = this._pendingTxProofs.values();
        this._pendingTxProofs.clear();
        const resolves = this._pendingTxProofResolves;
        this._pendingTxProofResolves = [];
        const blockHash = this._blockchain.headHash;
        const proof = await this.getAccountsProof(blockHash, addresses);
        await this._blockchain.pushAccountsProof(blockHash, proof, addresses);
        for (let resolve of resolves) {
            resolve();
        }
    }

    /**
     * @param {Hash} blockHash
     * @param {Array.<Address>} addresses
     * @returns {Promise.<AccountsProof>}
     */
    getAccountsProof(blockHash, addresses) {
        return this._synchronizer.push('getAccountsProof',
            this._getAccountsProof.bind(this, blockHash, addresses));
    }

    /**
     * @param {Hash} blockHash
     * @param {Array.<Address>} addresses
     * @returns {Promise.<AccountsProof>}
     * @private
     */
    _getAccountsProof(blockHash, addresses) {
        Assert.that(this._accountsRequest === null);

        Log.d(LighterConsensusAgent, `Requesting AccountsProof for ${addresses.length < 5 ? addresses.map(addr => addr.toUserFriendlyAddress()).join(', ') : `${addresses.length} addresses`} from ${this._peer.peerAddress}`);

        return new Promise((resolve, reject) => {
            this._accountsRequest = {
                addresses: addresses,
                blockHash: blockHash,
                resolve: resolve,
                reject: reject
            };

            // Request AccountsProof from peer.
            this._peer.channel.getAccountsProof(blockHash, addresses);

            // Drop the peer if it doesn't send the accounts proof within the timeout.
            this._peer.channel.expectMessage(Message.Type.ACCOUNTS_PROOF, () => {
                this._peer.channel.close(CloseType.GET_ACCOUNTS_PROOF_TIMEOUT, 'getAccountsProof timeout');
                reject(new Error('timeout')); // TODO error handling
            }, LighterConsensusAgent.ACCOUNTSPROOF_REQUEST_TIMEOUT);
        });
    }

    async _processBlock(hash, block) {
        if (this._partialChain && this._partialChain.state === PartialLightChain.State.BEFORE_PROVE_ACCOUNTS) {
            if (this._pendingBlocks.length === 0) {
                this._pendingBlocks.push(block);
            } else if (this._pendingBlocks[0].prevHash.equals(hash)) {
                this._pendingBlocks.unshift(block);
            } else if (this._pendingBlocks[this._pendingBlocks.length - 1].hash().equals(block.prevHash)) {
                this._pendingBlocks.push(block);
            } else {
                Log.w(LighterConsensusAgent, `Unexpected block: ${hash}`);
            }
            if (this._pendingBlocks.length > Policy.NUM_BLOCKS_VERIFICATION) {
                this._partialChain._state = PartialLightChain.State.PROVE_ACCOUNTS_TREE;
            }
        } else if (this._syncing && this._catchup) {
            // If we find that we are on a fork far away from our chain, resync.
            if (block.height < this._chain.height - Policy.NUM_BLOCKS_VERIFICATION
                && (!this._partialChain || this._partialChain.state !== PartialLightChain.State.PROVE_BLOCKS)) {
                this._onMainChain = false;
                await this._initChainProofSync();
                this.syncBlockchain().catch(Log.w.tag(LightConsensusAgent));
                return;
            } else {
                this._onMainChain = true;
            }

            if (block.hash().equals(this._syncTarget)) {
                // Fetch missing proof and then apply together
                if (this._pendingBlocks.length > 0 && !this._pendingBlocks[this._pendingBlocks.length - 1].hash().equals(block.prevHash)) {
                    Log.w(LighterConsensusAgent, 'Sync failed, blocks are out of order');
                } else {
                    this._pendingBlocks.push(block);
                    let proofs = [];
                    const addresses = PartialAccounts.gatherAllAddressesForBlocks(this._pendingBlocks).sort((a, b) => a.toHex() < b.toHex() ? -1 : a.toHex() > b.toHex() ? 1 : 0);
                    for (let address of addresses) {
                        if (address.toHex() === 'cae129d9536749eb2abb4fe8d0b280d93b22541b') console.log('in addresses');
                    }
                    if (!(await this._blockchain.accounts.areAddressesAvailable(addresses))) {
                        Log.d(LighterConsensusAgent, `Fetch missing proof to apply orphan chain of ${this._pendingBlocks.length + 1} blocks`);
                        for (let i = 0; i < addresses.length; i += GetAccountsProofMessage.ADDRESSES_MAX_COUNT) {
                            proofs.push(await this.getAccountsProof(hash, addresses.slice(i, i + GetAccountsProofMessage.ADDRESSES_MAX_COUNT)));
                        }
                    }
                    if (proofs.length > 0) {
                        await this._blockchain.pushAccountsProofsForNewBlocks(this._pendingBlocks, proofs);
                    }
                    for (let block of this._pendingBlocks.reverse()) {
                        const hash = block.hash();
                        const status = await this._chain.pushBlock(block);

                        if (!(await this._handlePushBlockResult(hash, block, status))) {
                            Log.w(LighterConsensusAgent, 'Sync failed, blocks are not valid');
                            return;
                        }
                    }
                }
            } else if (this._pendingBlocks.length === 0) {
                this._pendingBlocks.push(block);
            } else if (this._pendingBlocks[0].prevHash.equals(hash)) {
                this._pendingBlocks.unshift(block);
            } else if (this._pendingBlocks[this._pendingBlocks.length - 1].hash().equals(block.prevHash)) {
                this._pendingBlocks.push(block);
            } else if (this._pendingBlocks[0].equals(block)) {
                Log.d(LighterConsensusAgent, `Ignoring block ${hash}, we already have it pending`);
            } else {
                Log.w(LighterConsensusAgent, `Unexpected block: ${hash}`);
            }

        } else if (this._partialChain) {
            Log.w(LighterConsensusAgent, 'Cannot apply block on partial chain');
        } else {
            let proofs = [];
            const addresses = block.body.getAddresses().sort((a, b) => a.toHex() < b.toHex() ? -1 : a.toHex() > b.toHex() ? 1 : 0);
            if (!(await this._blockchain.accounts.areAddressesAvailable(addresses))) {
                Log.d(LighterConsensusAgent, `Fetch missing proof to apply block ${block.height} ${block.hash()}`);
                for (let i = 0; i < addresses.length; i += GetAccountsProofMessage.ADDRESSES_MAX_COUNT) {
                    proofs.push(await this.getAccountsProof(hash, addresses.slice(i, i + GetAccountsProofMessage.ADDRESSES_MAX_COUNT)));
                }
            }

            // Put block into blockchain.
            Log.d(LighterConsensusAgent, `Push block height=${block.height} hash=${hash} with ${addresses.length} addresses, ${proofs.length} proofs`);
            const status = await this._chain.pushBlockWithProofs(block, proofs);
            Log.d(LighterConsensusAgent, `Applied block height=${block.height} hash=${hash} status=${status}`);

            await this._handlePushBlockResult(hash, block, status);
        }
    }

    /**
     * @param {Hash} hash
     * @param {Block} block
     * @param {number} status
     * @returns {Promise.<boolean>}
     * @private
     */
    async _handlePushBlockResult(hash, block, status) {
        switch (status) {
            case FullChain.ERR_INVALID:
                this._peer.channel.close(CloseType.RECEIVED_INVALID_BLOCK, 'received invalid block');
                return false;

            case FullChain.OK_EXTENDED:
            case FullChain.OK_REBRANCHED:
                if (this._syncing) this._numBlocksExtending++;
                return true;

            case FullChain.OK_FORKED:
                if (this._syncing) {
                    this._numBlocksForking++;
                    this._forkHead = block;
                }
                return true;

            case LightChain.ERR_ORPHAN:
                this._onOrphanBlock(hash, block);
                return true;

            case LighterChain.ERR_CANNOT_APPLY_PROOF:
                this._peer.channel.close(CloseType.INVALID_ACCOUNTS_PROOF, 'received invalid block accounts proof');
                return false;
        }
        return true;
    }
}

/**
 * Maximum time (ms) to wait for accounts-proof after sending out get-accounts-proof before dropping the peer.
 * @type {number}
 */
LighterConsensusAgent.ACCOUNTS_PROOF_REQUEST_TIMEOUT = 1000 * 8;
/**
 * Maximum time (ms) to wait for accounts-proof after sending out get-accounts-proof before dropping the peer.
 * @type {number}
 */
LighterConsensusAgent.ACCOUNTSPROOF_REQUEST_TIMEOUT = 1000 * 5;

Class.register(LighterConsensusAgent);
