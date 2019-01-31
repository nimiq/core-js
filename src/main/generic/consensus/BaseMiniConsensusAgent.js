/**
 * @abstract
 */
class BaseMiniConsensusAgent extends BaseConsensusAgent {
    /**
     * @param {BaseChain} blockchain
     * @param {Time} time
     * @param {Peer} peer
     * @param {InvRequestManager} invRequestManager
     * @param {Subscription} [targetSubscription]
     */
    constructor(blockchain, time, peer, invRequestManager, targetSubscription) {
        super(time, peer, invRequestManager, targetSubscription);

        /** @type {BaseChain} */
        this._blockchain = blockchain;

        this._subscribeTarget();

        // Helper object to keep track of the accounts we're requesting from the peer.
        this._accountsRequest = null;
        this.onToDisconnect(peer.channel, 'accounts-proof', msg => this._onAccountsProof(msg));
    }

    requestMempool() {
        // Request the peer's mempool.
        // XXX Use a random delay here to prevent requests to multiple peers at once.
        const delay = BaseMiniConsensusAgent.MEMPOOL_DELAY_MIN
            + Math.random() * (BaseMiniConsensusAgent.MEMPOOL_DELAY_MAX - BaseMiniConsensusAgent.MEMPOOL_DELAY_MIN);
        setTimeout(() => this._peer.channel.mempool(), delay);
    }


    /**
     * @param {Hash} blockHash
     * @param {Array.<Address>} addresses
     * @returns {Promise.<Array.<Account>>}
     */
    getAccounts(blockHash, addresses) {
        return this._synchronizer.push('getAccounts',
            this._getAccounts.bind(this, blockHash, addresses));
    }

    /**
     * @param {Hash} blockHash
     * @param {Array.<Address>} addresses
     * @returns {Promise.<Array<Account>>}
     * @private
     */
    _getAccounts(blockHash, addresses) {
        Assert.that(this._accountsRequest === null);

        Log.d(BaseMiniConsensusAgent, `Requesting AccountsProof for ${addresses} from ${this._peer.peerAddress}`);

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
            }, BaseMiniConsensusAgent.ACCOUNTSPROOF_REQUEST_TIMEOUT);
        });
    }

    /**
     * @param {AccountsProofMessage} msg
     * @returns {Promise.<void>}
     * @private
     */
    async _onAccountsProof(msg) {
        Log.d(BaseMiniConsensusAgent, `[ACCOUNTS-PROOF] Received from ${this._peer.peerAddress}: blockHash=${msg.blockHash}, proof=${msg.proof} (${msg.serializedSize} bytes)`);

        // Check if we have requested an accounts proof, reject unsolicited ones.
        if (!this._accountsRequest) {
            Log.w(BaseMiniConsensusAgent, `Unsolicited accounts proof received from ${this._peer.peerAddress}`);
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
            Log.w(BaseMiniConsensusAgent, `Received AccountsProof for invalid reference block from ${this._peer.peerAddress}`);
            reject(new Error('Invalid reference block'));
            return;
        }

        // Verify the proof.
        const proof = msg.proof;
        if (!proof.verify()) {
            Log.w(BaseMiniConsensusAgent, `Invalid AccountsProof received from ${this._peer.peerAddress}`);
            // TODO ban instead?
            this._peer.channel.close(CloseType.INVALID_ACCOUNTS_PROOF, 'Invalid AccountsProof');
            reject(new Error('Invalid AccountsProof'));
            return;
        }

        // Check that the proof root hash matches the accountsHash in the reference block.
        const rootHash = proof.root();
        const block = await this._blockchain.getBlock(blockHash);
        if (!block.accountsHash.equals(rootHash)) {
            Log.w(BaseMiniConsensusAgent, `Invalid AccountsProof (root hash) received from ${this._peer.peerAddress}`);
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
                Log.w(BaseMiniConsensusAgent, `Incomplete AccountsProof received from ${this._peer.peerAddress}`);
                // TODO ban instead?
                this._peer.channel.close(CloseType.INCOMPLETE_ACCOUNTS_PROOF, 'Incomplete AccountsProof');
                reject(new Error('Incomplete AccountsProof'));
                return;
            }
        }

        // Return the retrieved accounts.
        resolve(accounts);
    }

}

/**
 * Maximum time (ms) to wait for accounts-proof after sending out get-accounts-proof before dropping the peer.
 * @type {number}
 */
BaseMiniConsensusAgent.ACCOUNTSPROOF_REQUEST_TIMEOUT = 1000 * 5;
/**
 * Minimum time {ms} to wait before triggering the initial mempool request.
 * @type {number}
 */
BaseMiniConsensusAgent.MEMPOOL_DELAY_MIN = 1000 * 2; // 2 seconds
/**
 * Maximum time {ms} to wait before triggering the initial mempool request.
 * @type {number}
 */
BaseMiniConsensusAgent.MEMPOOL_DELAY_MAX = 1000 * 20; // 20 seconds
Class.register(BaseMiniConsensusAgent);
