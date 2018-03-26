/**
 * @abstract
 */
class BaseConsensusAgent extends Observable {
    /**
     * @param {Time} time
     * @param {Peer} peer
     * @param {Subscription} [targetSubscription]
     */
    constructor(time, peer, targetSubscription) {
        super();
        /** @type {Time} */
        this._time = time;
        /** @type {Peer} */
        this._peer = peer;

        // Flag indicating that have synced our blockchain with the peer's.
        /** @type {boolean} */
        this._synced = false;

        // Set of all objects (InvVectors) that we think the remote peer knows.
        /** @type {HashSet.<InvVector>} */
        this._knownObjects = new HashSet();
        this._knownObjects.add(new InvVector(InvVector.Type.BLOCK, peer.headHash));

        // InvVectors we want to request via getData are collected here and
        // periodically requested.
        /** @type {HashSet.<InvVector>} */
        this._objectsToRequest = new HashSet();

        // Objects that are currently being requested from the peer.
        /** @type {HashSet.<InvVector>} */
        this._objectsInFlight = new HashSet();

        // All objects that were requested from the peer but not received yet.
        /** @type {HashSet.<InvVector>} */
        this._objectsThatFlew = new HashSet();

        // Objects that are currently being processed by the blockchain/mempool.
        /** @type {HashSet.<InvVector>} */
        this._objectsProcessing = new HashSet();

        // A Subscription object specifying which objects should be announced to the peer.
        // Initially, we don't announce anything to the peer until it tells us otherwise.
        /** @type {Subscription} */
        this._remoteSubscription = Subscription.NONE;
        // Subscribe to all announcements from the peer.
        /** @type {Subscription} */
        this._localSubscription = Subscription.NONE;
        this._lastSubscriptionChange = null;
        /** @type {Subscription} */
        this._targetSubscription = targetSubscription || Subscription.ANY;

        // Helper object to keep track of timeouts & intervals.
        /** @type {Timers} */
        this._timers = new Timers();

        // Queue of transaction inv vectors waiting to be sent out
        /** @type {Queue.<InvVector>} */
        this._waitingInvVectors = new Queue();
        this._timers.setInterval('invVectors', () => this._sendWaitingInvVectors(), BaseConsensusAgent.TRANSACTION_RELAY_INTERVAL);

        // Queue of "free" transaction inv vectors waiting to be sent out
        /** @type {Queue.<{serializedSize:number, vector:InvVector}>} */
        this._waitingFreeInvVectors = new Queue();
        this._timers.setInterval('freeInvVectors', () => this._sendFreeWaitingInvVectors(), BaseConsensusAgent.FREE_TRANSACTION_RELAY_INTERVAL);

        // Helper object to keep track of block proofs we're requesting.
        this._blockProofRequest = null;

        // Helper object to keep track of transaction proofs we're requesting.
        this._transactionsProofRequest = null;

        // Helper object to keep track of transaction receipts we're requesting.
        this._transactionReceiptsRequest = null;

        /** @type {MultiSynchronizer} */
        this._synchronizer = new MultiSynchronizer();

        // Listen to consensus messages from the peer.
        peer.channel.on('inv', msg => this._onInv(msg));
        peer.channel.on('block', msg => this._onBlock(msg));
        peer.channel.on('header', msg => this._onHeader(msg));
        peer.channel.on('tx', msg => this._onTx(msg));
        peer.channel.on('not-found', msg => this._onNotFound(msg));

        peer.channel.on('subscribe', msg => this._onSubscribe(msg));
        peer.channel.on('get-data', msg => this._onGetData(msg));
        peer.channel.on('get-header', msg => this._onGetHeader(msg));

        peer.channel.on('block-proof', msg => this._onBlockProof(msg));
        peer.channel.on('transactions-proof', msg => this._onTransactionsProof(msg));
        peer.channel.on('transaction-receipts', msg => this._onTransactionReceipts(msg));

        // Clean up when the peer disconnects.
        peer.channel.on('close', () => this._onClose());
    }

    /**
     * @param {Subscription} subscription
     */
    subscribe(subscription) {
        this._targetSubscription = subscription;
        this._subscribe(subscription);
    }

    subscribeTarget() {
        this._subscribe(this._targetSubscription);
    }

    /**
     * @param {Subscription} subscription
     */
    _subscribe(subscription) {
        this._localSubscription = subscription;
        this._lastSubscriptionChange = Date.now();
        this._peer.channel.subscribe(this._localSubscription);
    }

    /**
     * @param {Block} block
     * @returns {boolean}
     */
    relayBlock(block) {
        // Don't relay block if have not synced with the peer yet.
        if (!this._synced) {
            return false;
        }

        // Only relay block if it matches the peer's subscription.
        if (!this._remoteSubscription.matchesBlock(block)) {
            return false;
        }

        // Create InvVector.
        const vector = InvVector.fromBlock(block);

        // Don't relay block to this peer if it already knows it.
        if (this._knownObjects.contains(vector)) {
            return false;
        }

        // Relay block to peer.
        this._peer.channel.inv([vector, ...this._waitingInvVectors.dequeueMulti(BaseInventoryMessage.VECTORS_MAX_COUNT - 1)]);

        // Assume that the peer knows this block now.
        this._knownObjects.add(vector);

        return true;
    }

    _sendWaitingInvVectors() {
        const invVectors = this._waitingInvVectors.dequeueMulti(BaseInventoryMessage.VECTORS_MAX_COUNT);
        if (invVectors.length > 0) {
            this._peer.channel.inv(invVectors);
            Log.v(BaseConsensusAgent, () => `[INV] Sent ${invVectors.length} vectors to ${this._peer.peerAddress}`);
        }
    }

    _sendFreeWaitingInvVectors() {
        const invVectors = [];
        let size = 0;
        while (invVectors.length <= BaseInventoryMessage.VECTORS_MAX_COUNT && this._waitingFreeInvVectors.length > 0
            && size < BaseConsensusAgent.FREE_TRANSACTION_SIZE_PER_INTERVAL) {
            const {serializedSize, vector} = this._waitingFreeInvVectors.dequeue();
            invVectors.push(vector);
            size += serializedSize;
        }
        if (invVectors.length > 0) {
            this._peer.channel.inv(invVectors);
            Log.v(BaseConsensusAgent, () => `[INV] Sent ${invVectors.length} vectors to ${this._peer.peerAddress}`);
        }
    }

    /**
     * @param {Transaction} transaction
     * @return {boolean}
     */
    relayTransaction(transaction) {
        // Only relay transaction if it matches the peer's subscription.
        if (!this._remoteSubscription.matchesTransaction(transaction)) {
            return false;
        }

        // Create InvVector.
        const vector = InvVector.fromTransaction(transaction);

        // Don't relay transaction to this peer if it already knows it.
        if (this._knownObjects.contains(vector)) {
            return false;
        }

        // Relay transaction to peer later.
        const serializedSize = transaction.serializedSize;
        if (transaction.fee / serializedSize < BaseConsensusAgent.TRANSACTION_RELAY_FEE_MIN) {
            this._waitingFreeInvVectors.enqueue({serializedSize, vector});
        } else {
            this._waitingInvVectors.enqueue(vector);
        }

        // Assume that the peer knows this transaction now.
        this._knownObjects.add(vector);

        return true;
    }

    /**
     * @param {Hash} blockHash
     * @returns {boolean}
     */
    knowsBlock(blockHash) {
        const vector = new InvVector(InvVector.Type.BLOCK, blockHash);
        return this._knownObjects.contains(vector);
    }

    /**
     * @param {SubscribeMessage} msg
     * @protected
     */
    _onSubscribe(msg) {
        Log.d(BaseConsensusAgent, `[SUBSCRIBE] ${this._peer.peerAddress} ${msg.subscription}`);
        this._remoteSubscription = msg.subscription;
    }

    /**
     * @param {InvMessage} msg
     * @returns {Promise.<void>}
     * @protected
     */
    async _onInv(msg) {
        // Keep track of the objects the peer knows.
        for (const vector of msg.vectors) {
            this._knownObjects.add(vector);
            this._waitingInvVectors.remove(vector);
        }

        // Check which of the advertised objects we know
        // Request unknown objects, ignore known ones.
        const unknownObjects = [];
        for (const vector of msg.vectors) {
            // Ignore objects that we are currently requesting / processing.
            if (this._objectsInFlight.contains(vector) || this._objectsProcessing.contains(vector)) {
                continue;
            }

            // Filter out objects that we are not interested in.
            if (!this._shouldRequestData(vector)) {
                continue;
            }

            switch (vector.type) {
                case InvVector.Type.BLOCK: {
                    const block = await this._getBlock(vector.hash, /*includeForks*/ true); // eslint-disable-line no-await-in-loop
                    if (!block) {
                        unknownObjects.push(vector);
                        this._onNewBlockAnnounced(vector.hash);
                    } else {
                        this._onKnownBlockAnnounced(vector.hash, block);
                    }
                    break;
                }
                case InvVector.Type.TRANSACTION: {
                    const transaction = await this._getTransaction(vector.hash); // eslint-disable-line no-await-in-loop
                    if (!transaction) {
                        unknownObjects.push(vector);
                        this._onNewTransactionAnnounced(vector.hash);
                    } else {
                        this._onKnownTransactionAnnounced(vector.hash, transaction);
                    }
                    break;
                }
                default:
                    throw `Invalid inventory type: ${vector.type}`;
            }
        }

        Log.v(BaseConsensusAgent, `[INV] ${msg.vectors.length} vectors (${unknownObjects.length} new) received from ${this._peer.peerAddress}`);

        if (unknownObjects.length > 0) {
            // Store unknown vectors in objectsToRequest.
            this._objectsToRequest.addAll(unknownObjects);

            // Clear the request throttle timeout.
            this._timers.clearTimeout('inv');

            // If there are enough objects queued up, send out a getData request.
            if (this._objectsToRequest.length >= BaseConsensusAgent.REQUEST_THRESHOLD) {
                this._requestData();
            }
            // Otherwise, wait a short time for more inv messages to arrive, then request.
            else {
                this._timers.setTimeout('inv', () => this._requestData(), BaseConsensusAgent.REQUEST_THROTTLE);
            }
        } else {
            this._onNoUnknownObjects();
        }
    }

    /**
     * @param {InvVector} vector
     * @returns {boolean}
     * @protected
     */
    _shouldRequestData(vector) {
        return true;
    }

    /**
     * @param {Hash} hash
     * @param {boolean} [includeForks]
     * @param {boolean} [includeBody]
     * @returns {Promise.<?Block>}
     * @protected
     * @abstract
     */
    _getBlock(hash, includeForks = false, includeBody = false) {
        // MUST be implemented by subclasses.
        throw new Error('not implemented');
    }
    /**
     * @param {Hash} hash
     * @returns {Promise.<?Transaction>}
     * @protected
     * @abstract
     */
    _getTransaction(hash) {
        // MUST be implemented by subclasses.
        throw new Error('not implemented');
    }

    /**
     * @param {Hash} hash
     * @returns {void}
     * @protected
     */
    _onNewBlockAnnounced(hash) {
    }
    /**
     * @param {Hash} hash
     * @param {Block} block
     * @returns {void}
     * @protected
     */
    _onKnownBlockAnnounced(hash, block) {
    }
    /**
     * @param {Hash} hash
     * @returns {void}
     * @protected
     */
    _onNewTransactionAnnounced(hash) {
    }
    /**
     * @param {Hash} hash
     * @param {Transaction} transaction
     * @returns {void}
     * @protected
     */
    _onKnownTransactionAnnounced(hash, transaction) {
    }

    /**
     * @returns {void}
     * @protected
     */
    _requestData() {
        // Only one request at a time.
        if (!this._objectsInFlight.isEmpty()) return;

        // Don't do anything if there are no objects queued to request.
        if (this._objectsToRequest.isEmpty()) return;

        // Request queued objects from the peer. Only request up to VECTORS_MAX_COUNT objects at a time.
        const vectorsMaxCount = BaseInventoryMessage.VECTORS_MAX_COUNT;
        /** @type {Array.<InvVector>} */
        const vectors = Array.from(new LimitIterable(this._objectsToRequest.valueIterator(), vectorsMaxCount));

        // Mark the requested objects as in-flight.
        this._objectsInFlight.addAll(vectors);

        // Remove requested objects from queue.
        this._objectsToRequest.removeAll(vectors);

        // Request data from peer.
        this._doRequestData(vectors);

        // Set timer to detect end of request / missing objects
        this._timers.setTimeout('getData', () => this._noMoreData(), BaseConsensusAgent.REQUEST_TIMEOUT);
    }

    /**
     * @param {Array.<InvVector>} vectors
     * @returns {void}
     * @protected
     */
    _doRequestData(vectors) {
        this._peer.channel.getData(vectors);
    }

    /**
     * @param {BlockMessage} msg
     * @return {Promise.<void>}
     * @protected
     */
    async _onBlock(msg) {
        const hash = msg.block.hash();

        // Check if we have requested this block.
        const vector = new InvVector(InvVector.Type.BLOCK, hash);
        if (!this._objectsInFlight.contains(vector) && !this._objectsThatFlew.contains(vector)) {
            Log.w(BaseConsensusAgent, `Unsolicited block ${hash} received from ${this._peer.peerAddress}, discarding`);
            return;
        }

        // Reuse already known (verified) transactions
        const transactions = msg.block.isFull() ? msg.block.body.transactions : [];
        const transactionPromises = transactions.map(t => this._getTransaction(t.hash()));
        for (let i = 0; i < transactions.length; i++) {
            const transaction = await transactionPromises[i]; // eslint-disable-line no-await-in-loop
            if (transaction) {
                transactions[i] = transaction;
            }
        }

        // Mark object as received.
        this._onObjectReceived(vector);

        // Process block.
        this._objectsProcessing.add(vector);

        // Check whether we subscribed for this block.
        if (this._localSubscription.matchesBlock(msg.block)) {
            await this._processBlock(hash, msg.block);
        } else if (this._lastSubscriptionChange + BaseConsensusAgent.SUBSCRIPTION_CHANGE_GRACE_PERIOD > Date.now()) {
            this._peer.channel.close(CloseType.RECEIVED_BLOCK_NOT_MATCHING_OUR_SUBSCRIPTION, 'received block not matching our subscription');
        }

        // Mark object as processed.
        this._onObjectProcessed(vector);
    }

    /**
     * @param {Hash} hash
     * @param {Block} block
     * @returns {Promise.<void>}
     * @protected
     */
    async _processBlock(hash, block) {
    }

    /**
     * @param {HeaderMessage} msg
     * @return {Promise.<void>}
     * @protected
     */
    async _onHeader(msg) {
        const hash = msg.header.hash();

        // Check if we have requested this header.
        const vector = new InvVector(InvVector.Type.BLOCK, hash);
        if (!this._objectsInFlight.contains(vector) && !this._objectsThatFlew.contains(vector)) {
            Log.w(BaseConsensusAgent, `Unsolicited header ${hash} received from ${this._peer.peerAddress}, discarding`);
            return;
        }

        // Mark object as received.
        this._onObjectReceived(vector);

        // Process header.
        this._objectsProcessing.add(vector);
        await this._processHeader(hash, msg.header);

        // Mark object as processed.
        this._onObjectProcessed(vector);
    }

    /**
     * @param {Hash} hash
     * @param {BlockHeader} header
     * @returns {Promise.<void>}
     * @protected
     */
    async _processHeader(hash, header) {
    }

    /**
     * @param {TxMessage} msg
     * @return {Promise}
     * @protected
     */
    async _onTx(msg) {
        const hash = msg.transaction.hash();
        //Log.d(BaseConsensusAgent, () => `[TX] Received transaction ${hash} from ${this._peer.peerAddress}`);

        // Check if we have requested this transaction.
        const vector = new InvVector(InvVector.Type.TRANSACTION, hash);
        if (!this._objectsInFlight.contains(vector) && !this._objectsThatFlew.contains(vector)) {
            Log.w(BaseConsensusAgent, `Unsolicited transaction ${hash} received from ${this._peer.peerAddress}, discarding`);
            return;
        }

        // Mark object as received.
        this._onObjectReceived(vector);

        // Process transaction.
        this._objectsProcessing.add(vector);

        // Check whether we subscribed for this transaction.
        if (this._localSubscription.matchesTransaction(msg.transaction)) {
            await this._processTransaction(hash, msg.transaction);
        } else if (this._lastSubscriptionChange + BaseConsensusAgent.SUBSCRIPTION_CHANGE_GRACE_PERIOD > Date.now()) {
            this._peer.channel.close(CloseType.RECEIVED_TRANSACTION_NOT_MATCHING_OUR_SUBSCRIPTION, 'received transaction not matching our subscription');
        }

        // Mark object as processed.
        this._onObjectProcessed(vector);
    }

    /**
     * @param {Hash} hash
     * @param {Transaction} transaction
     * @returns {Promise.<void>}
     * @protected
     */
    async _processTransaction(hash, transaction) {
    }

    /**
     * @param {NotFoundMessage} msg
     * @returns {void}
     * @protected
     */
    _onNotFound(msg) {
        Log.d(BaseConsensusAgent, `[NOTFOUND] ${msg.vectors.length} unknown objects received from ${this._peer.peerAddress}`);

        // Remove unknown objects from in-flight list.
        for (const vector of msg.vectors) {
            if (!this._objectsInFlight.contains(vector)) {
                continue;
            }

            // Mark object as received.
            this._onObjectReceived(vector);
        }
    }

    /**
     * @param {InvVector} vector
     * @returns {void}
     * @protected
     */
    _onObjectReceived(vector) {
        if (this._objectsInFlight.isEmpty()) return;

        // Remove the vector from objectsInFlight.
        this._objectsInFlight.remove(vector);

        // Reset the request timeout if we expect more objects to come.
        if (!this._objectsInFlight.isEmpty()) {
            this._timers.resetTimeout('getData', () => this._noMoreData(), BaseConsensusAgent.REQUEST_TIMEOUT);
        } else {
            this._noMoreData();
        }
    }

    /**
     * @returns {void}
     * @protected
     */
    _noMoreData() {
        // Cancel the request timeout timer.
        this._timers.clearTimeout('getData');

        // Reset objects in flight.
        this._objectsThatFlew.addAll(this._objectsInFlight.values());
        this._objectsInFlight.clear();

        // If there are more objects to request, request them.
        if (!this._objectsToRequest.isEmpty()) {
            this._requestData();
        } else {
            this._onAllObjectsReceived();
        }
    }

    /**
     * @returns {void}
     * @protected
     */
    _onNoUnknownObjects() {
    }

    /**
     * @returns {void}
     * @protected
     */
    _onAllObjectsReceived() {
    }

    /**
     * @param {InvVector} vector
     * @returns {void}
     * @protected
     */
    _onObjectProcessed(vector) {
        // Remove the vector from objectsProcessing.
        this._objectsProcessing.remove(vector);

        if (this._objectsProcessing.isEmpty()) {
            this._onAllObjectsProcessed();
        }
    }

    /**
     * @returns {void}
     * @protected
     */
    _onAllObjectsProcessed() {
    }

    /**
     * @param {GetDataMessage} msg
     * @returns {Promise}
     * @protected
     */
    async _onGetData(msg) {
        // Keep track of the objects the peer knows.
        for (const vector of msg.vectors) {
            this._knownObjects.add(vector);
        }

        // Check which of the requested objects we know.
        // Send back all known objects.
        // Send notFound for unknown objects.
        const unknownObjects = [];
        for (const vector of msg.vectors) {
            switch (vector.type) {
                case InvVector.Type.BLOCK: {
                    const block = await this._getBlock(vector.hash, /*includeForks*/ false, /*includeBody*/ true); // eslint-disable-line no-await-in-loop
                    if (block && block.isFull()) {
                        // We have found a requested block, send it back to the sender.
                        this._peer.channel.block(block);
                    } else {
                        // Requested block is unknown.
                        unknownObjects.push(vector);
                    }
                    break;
                }
                case InvVector.Type.TRANSACTION: {
                    const tx = await this._getTransaction(vector.hash); // eslint-disable-line no-await-in-loop
                    if (tx) {
                        // We have found a requested transaction, send it back to the sender.
                        this._peer.channel.tx(tx);
                    } else {
                        // Requested transaction is unknown.
                        unknownObjects.push(vector);
                    }
                    break;
                }
                default:
                    throw `Invalid inventory type: ${vector.type}`;
            }
        }

        // Report any unknown objects back to the sender.
        if (unknownObjects.length) {
            this._peer.channel.notFound(unknownObjects);
        }
    }

    /**
     * @param {GetHeaderMessage} msg
     * @returns {Promise}
     * @protected
     */
    async _onGetHeader(msg) {
        // Keep track of the objects the peer knows.
        for (const vector of msg.vectors) {
            this._knownObjects.add(vector);
        }

        // Check which of the requested objects we know.
        // Send back all known objects.
        // Send notFound for unknown objects.
        const unknownObjects = [];
        for (const vector of msg.vectors) {
            switch (vector.type) {
                case InvVector.Type.BLOCK: {
                    const block = await this._getBlock(vector.hash); // eslint-disable-line no-await-in-loop
                    if (block) {
                        // We have found a requested block, send it back to the sender.
                        this._peer.channel.header(block.header);
                    } else {
                        // Requested block is unknown.
                        unknownObjects.push(vector);
                    }
                    break;
                }
                case InvVector.Type.TRANSACTION:
                default:
                    throw `Invalid inventory type: ${vector.type}`;
            }
        }

        // Report any unknown objects back to the sender.
        if (unknownObjects.length) {
            this._peer.channel.notFound(unknownObjects);
        }
    }

    /**
     * @param {Hash} blockHashToProve
     * @param {Block} knownBlock
     * @returns {Promise.<Block>}
     */
    getBlockProof(blockHashToProve, knownBlock) {
        return this._synchronizer.push('getBlockProof',
            this._getBlockProof.bind(this, blockHashToProve, knownBlock));
    }

    /**
     * @param {Hash} blockHashToProve
     * @param {Block} knownBlock
     * @returns {Promise.<Block>}
     * @private
     */
    _getBlockProof(blockHashToProve, knownBlock) {
        Assert.that(this._blockProofRequest === null);

        Log.d(BaseConsensusAgent, () => `Requesting BlockProof for ${blockHashToProve} from ${this._peer.peerAddress}`);

        return new Promise((resolve, reject) => {
            this._blockProofRequest = {
                blockHashToProve,
                knownBlock,
                resolve,
                reject
            };

            // Request BlockProof from peer.
            this._peer.channel.getBlockProof(blockHashToProve, knownBlock.hash());

            this._peer.channel.expectMessage(Message.Type.BLOCK_PROOF, () => {
                reject(new Error('timeout'));
            }, BaseConsensusAgent.BLOCK_PROOF_REQUEST_TIMEOUT);
        });
    }

    /**
     * @param {BlockProofMessage} msg
     * @returns {Promise.<void>}
     * @private
     */
    async _onBlockProof(msg) {
        Log.d(BaseConsensusAgent, () => `[BLOCK-PROOF] Received from ${this._peer.peerAddress}: proof=${msg.proof} (${msg.serializedSize} bytes)`);

        // Check if we have requested a header proof, reject unsolicited ones.
        if (!this._blockProofRequest) {
            Log.w(BaseConsensusAgent, `Unsolicited header proof received from ${this._peer.peerAddress}`);
            // TODO close/ban?
            return;
        }

        const { blockHashToProve, /** @type {Block} */ knownBlock, resolve, reject } = this._blockProofRequest;
        this._blockProofRequest = null;

        if (!msg.hasProof() || msg.proof.length === 0) {
            reject(new Error('Block proof request was rejected'));
            return;
        }

        // Check that the tail of the proof corresponds to the requested block.
        const proof = msg.proof;
        if (!blockHashToProve.equals(proof.tail.hash())) {
            Log.w(BaseConsensusAgent, `Received BlockProof with invalid tail block from ${this._peer.peerAddress}`);
            reject(new Error('Invalid tail block'));
            return;
        }

        // Check that the proof links up to our reference block.
        if (!(await knownBlock.isInterlinkSuccessorOf(proof.head))) {
            Log.w(BaseConsensusAgent, `Received BlockProof with invalid head block from ${this._peer.peerAddress}`);
            reject(new Error('Invalid head block'));
            return;
        }

        // Verify the proof.
        if (!(await proof.verify())) {
            Log.w(BaseConsensusAgent, `Invalid BlockProof received from ${this._peer.peerAddress}`);
            // TODO ban instead?
            this._peer.channel.close(CloseType.INVALID_BLOCK_PROOF, 'Invalid BlockProof');
            reject(new Error('Invalid BlockProof'));
            return;
        }

        // Verify individual blocks.
        const verificationResults = await Promise.all(proof.blocks.map(block => block.verify(this._time)));
        if (!verificationResults.every(result => result)) {
            Log.w(BaseConsensusAgent, `Invalid BlockProof received from ${this._peer.peerAddress}`);
            // TODO ban instead?
            this._peer.channel.close(CloseType.INVALID_BLOCK_PROOF, 'Invalid BlockProof');
            reject(new Error('Invalid BlockProof'));
            return;
        }

        // Return the proven block.
        resolve(proof.tail);
    }

    /**
     * @param {Block} block
     * @param {Array.<Address>} addresses
     * @returns {Promise.<Array.<Transaction>>}
     */
    getTransactionsProof(block, addresses) {
        return this._synchronizer.push('getTransactionsProof',
            this._getTransactionsProof.bind(this, block, addresses));
    }

    /**
     * @param {Block} block
     * @param {Array.<Address>} addresses
     * @returns {Promise.<Array.<Transaction>>}
     * @private
     */
    _getTransactionsProof(block, addresses) {
        Assert.that(this._transactionsProofRequest === null);

        Log.d(BaseConsensusAgent, () => `Requesting TransactionsProof for ${addresses}@${block.height} from ${this._peer.peerAddress}`);

        return new Promise((resolve, reject) => {
            this._transactionsProofRequest = {
                addresses,
                block,
                resolve,
                reject,
            };

            // Request TransactionProof from peer.
            this._peer.channel.getTransactionsProof(block.hash(), addresses);

            // Drop the peer if it doesn't send the TransactionProof within the timeout.
            this._peer.channel.expectMessage(Message.Type.TRANSACTIONS_PROOF, () => {
                this._peer.channel.close(CloseType.GET_TRANSACTIONS_PROOF_TIMEOUT, 'getTransactionsProof timeout');
                reject(new Error('timeout'));
            }, BaseConsensusAgent.TRANSACTIONS_PROOF_REQUEST_TIMEOUT);
        });
    }

    /**
     * @param {TransactionsProofMessage} msg
     * @returns {void}
     * @private
     */
    _onTransactionsProof(msg) {
        Log.d(BaseConsensusAgent, () => `[TRANSACTIONS-PROOF] Received from ${this._peer.peerAddress}: blockHash=${msg.blockHash}, proof=${msg.proof} (${msg.serializedSize} bytes)`);

        // Check if we have requested a transactions proof, reject unsolicited ones.
        if (!this._transactionsProofRequest) {
            Log.w(BaseConsensusAgent, `Unsolicited transactions proof received from ${this._peer.peerAddress}`);
            // TODO close/ban?
            return;
        }

        const {/** @type {Block} */ block, resolve, reject} = this._transactionsProofRequest;
        this._transactionsProofRequest = null;

        if (!msg.hasProof()) {
            Log.w(BaseConsensusAgent, `TransactionsProof request was rejected by ${this._peer.peerAddress}`);
            reject(new Error('TransactionsProof request was rejected'));
            return;
        }

        // Check that the reference block corresponds to the one we requested.
        if (!block.hash().equals(msg.blockHash)) {
            Log.w(BaseConsensusAgent, `Received TransactionsProof for invalid reference block from ${this._peer.peerAddress}`);
            reject(new Error('Invalid reference block'));
            return;
        }

        // Verify the proof.
        const proof = msg.proof;
        if (!block.bodyHash.equals(proof.root())) {
            Log.w(BaseConsensusAgent, `Invalid TransactionsProof received from ${this._peer.peerAddress}`);
            this._peer.channel.close(CloseType.INVALID_TRANSACTION_PROOF, 'Invalid TransactionsProof');
            reject(new Error('Invalid TransactionsProof'));
            return;
        }

        // TODO Verify that the proof only contains transactions that match the given addresses.

        // Return the retrieved transactions.
        resolve(proof.transactions);
    }

    /**
     * @param {Address} address
     * @returns {Promise.<Array.<TransactionReceipt>>}
     */
    getTransactionReceipts(address) {
        return this._synchronizer.push('getTransactionReceipts',
            this._getTransactionReceipts.bind(this, address));
    }

    /**
     * @param {Address} address
     * @returns {Promise.<Array.<TransactionReceipt>>}
     * @private
     */
    _getTransactionReceipts(address) {
        Assert.that(this._transactionReceiptsRequest === null);

        return new Promise((resolve, reject) => {
            this._transactionReceiptsRequest = {
                address,
                resolve,
                reject
            };

            this._peer.channel.getTransactionReceipts(address);

            this._peer.channel.expectMessage(Message.Type.TRANSACTION_RECEIPTS, () => {
                this._peer.channel.close(CloseType.GET_TRANSACTION_RECEIPTS_TIMEOUT, 'getTransactionReceipts timeout');
                reject(new Error('timeout'));
            }, BaseConsensusAgent.TRANSACTION_RECEIPTS_REQUEST_TIMEOUT);
        });
    }

    /**
     * @param {TransactionReceiptsMessage} msg
     * @returns {void}
     * @private
     */
    _onTransactionReceipts(msg) {
        Log.d(BaseConsensusAgent, () => `[TRANSACTION-RECEIPTS] Received from ${this._peer.peerAddress}: ${msg.transactionReceipts.length}`);

        // Check if we have requested transaction receipts, reject unsolicited ones.
        if (!this._transactionReceiptsRequest) {
            Log.w(BaseConsensusAgent, `Unsolicited transaction receipts received from ${this._peer.peerAddress}`);
            // TODO close/ban?
            return;
        }

        const {resolve} = this._transactionReceiptsRequest;
        this._transactionReceiptsRequest = null;

        // TODO Verify that the transaction receipts match the given address.

        resolve(msg.transactionReceipts);
    }

    /**
     * @returns {void}
     * @protected
     */
    _onClose() {
        this._synchronizer.clear();

        // Clear all timers and intervals when the peer disconnects.
        this._timers.clearAll();

        // Notify listeners that the peer has disconnected.
        this.fire('close', this);
    }

    /** @type {Peer} */
    get peer() {
        return this._peer;
    }

    /** @type {boolean} */
    get synced() {
        return this._synced;
    }
}
/**
 * Number of InvVectors in invToRequest pool to automatically trigger a get-data request.
 * @type {number}
 */
BaseConsensusAgent.REQUEST_THRESHOLD = 50;
/**
 * Time (ms) to wait after the last received inv message before sending get-data.
 * @type {number}
 */
BaseConsensusAgent.REQUEST_THROTTLE = 500;
/**
 * Maximum time (ms) to wait after sending out get-data or receiving the last object for this request.
 * @type {number}
 */
BaseConsensusAgent.REQUEST_TIMEOUT = 1000 * 10;
/**
 * Maximum time (ms) to wait for block-proof.
 * @type {number}
 */
BaseConsensusAgent.BLOCK_PROOF_REQUEST_TIMEOUT = 1000 * 10;
/**
 * Maximum time (ms) to wait for transactions-proof.
 * @type {number}
 */
BaseConsensusAgent.TRANSACTIONS_PROOF_REQUEST_TIMEOUT = 1000 * 10;
/**
 * Maximum time (ms) to wait for transactions-receipts.
 * @type {number}
 */
BaseConsensusAgent.TRANSACTION_RECEIPTS_REQUEST_TIMEOUT = 1000 * 15;
/**
 * Time interval (ms) to wait between sending out transactions.
 * @type {number}
 */
BaseConsensusAgent.TRANSACTION_RELAY_INTERVAL = 5000;
/**
 * Time interval (ms) to wait between sending out "free" transactions.
 * @type {number}
 */
BaseConsensusAgent.FREE_TRANSACTION_RELAY_INTERVAL = 6000;
/**
 * Soft limit for the total size (bytes) of free transactions per relay interval.
 * @type {number}
 */
BaseConsensusAgent.FREE_TRANSACTION_SIZE_PER_INTERVAL = 15000; // ~100 legacy transactions
/**
 * Minimum fee per byte (sat/byte) such that a transaction is not considered free.
 * @type {number}
 */
BaseConsensusAgent.TRANSACTION_RELAY_FEE_MIN = 1;
/**
 * Number of ms the peer may send non-matching transactions/blocks after a subscription change.
 * @type {number}
 */
BaseConsensusAgent.SUBSCRIPTION_CHANGE_GRACE_PERIOD = 1000 * 2;
Class.register(BaseConsensusAgent);
