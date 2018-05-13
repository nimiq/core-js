class SignalProcessor {
    /**
     * @constructor
     * @param {PeerAddressBook} peerAddresses
     * @param {NetworkConfig} networkConfig
     * @param {WebRtcConnector} rtcConnector
     */
    constructor(peerAddresses, networkConfig, rtcConnector) {
        /**
         * @type {PeerAddressBook}
         * @private
         */
        this._addresses = peerAddresses;

        /**
         * @type {NetworkConfig}
         * @private
         */
        this._networkConfig = networkConfig;

        /**
         * @type {WebRtcConnector}
         * @private
         */
        this._rtcConnector = rtcConnector;

        /**
         * @type {SignalStore}
         * @private
         */
        this._forwards = new SignalStore();
    }

    /**
     * @param {PeerChannel} channel
     * @param {SignalMessage} msg
     * @returns {void}
     */
    onSignal(channel, msg) {
        // Discard signals with invalid TTL.
        if (msg.ttl > Network.SIGNAL_TTL_INITIAL) {
            channel.close(CloseType.INVALID_SIGNAL_TTL, 'invalid signal ttl');
            return;
        }

        // Can be undefined for non-rtc nodes.
        const myPeerId = this._networkConfig.peerId;

        // Discard signals from myself.
        if (msg.senderId.equals(myPeerId)) {
            Log.d(SignalProcessor, () => `Received signal from myself to ${msg.recipientId} from ${channel.peerAddress} (myId: ${myPeerId})`);
            return;
        }

        // If the signal has the unroutable flag set and we previously forwarded a matching signal,
        // mark the route as unusable.
        if (msg.isUnroutable() && this._forwards.signalForwarded(/*senderId*/ msg.recipientId, /*recipientId*/ msg.senderId, /*nonce*/ msg.nonce)) {
            const senderAddr = this._addresses.getByPeerId(msg.senderId);
            this._addresses.unroutable(channel, senderAddr);
        }

        // If the signal is intended for us, pass it on to our WebRTC connector.
        if (msg.recipientId.equals(myPeerId)) {
            // Ignore signals if we are not a WebRTC node.
            if (this._networkConfig.protocol !== Protocol.RTC) {
                return;
            }

            // Discard signals that have a payload which is not properly signed.
            if (msg.hasPayload() && !msg.verifySignature()) {
                Log.d(SignalProcessor, () => `Discarding signal from ${msg.senderId} received via ${channel.peerAddress} - invalid signature`);
                return;
            }

            // If we sent out a signal that did not reach the recipient because of TTL
            // or it was unroutable, delete this route.
            if (this._rtcConnector.isValidSignal(msg) && (msg.isUnroutable() || msg.isTtlExceeded())) {
                const senderAddr = this._addresses.getByPeerId(msg.senderId);
                this._addresses.unroutable(channel, senderAddr);
            }

            this._rtcConnector.onSignal(channel, msg);
            return;
        }

        // Discard signals that have reached their TTL.
        if (msg.ttl <= 0) {
            Log.d(SignalProcessor, () => `Discarding signal from ${msg.senderId} to ${msg.recipientId} - TTL reached`);
            // Send signal containing TTL_EXCEEDED flag back in reverse direction.
            if (msg.flags === 0) {
                channel.signal(/*senderId*/ msg.recipientId, /*recipientId*/ msg.senderId, msg.nonce, Network.SIGNAL_TTL_INITIAL, SignalMessage.Flag.TTL_EXCEEDED);
            }
            return;
        }

        // Otherwise, try to forward the signal to the intended recipient.
        const signalChannel = this._addresses.getChannelByPeerId(msg.recipientId);
        if (!signalChannel) {
            Log.d(SignalProcessor, () => `Failed to forward signal from ${msg.senderId} to ${msg.recipientId} - no route found`);
            // If we don't know a route to the intended recipient, return signal to sender with unroutable flag set and payload removed.
            // Only do this if the signal is not already a unroutable response.
            if (msg.flags === 0) {
                channel.signal(/*senderId*/ msg.recipientId, /*recipientId*/ msg.senderId, msg.nonce, Network.SIGNAL_TTL_INITIAL, SignalMessage.Flag.UNROUTABLE);
            }
            return;
        }

        // Discard signal if our shortest route to the target is via the sending peer.
        // XXX Why does this happen?
        if (signalChannel.peerAddress.equals(channel.peerAddress)) {
            Log.d(SignalProcessor, () => `Discarding signal from ${msg.senderId} to ${msg.recipientId} - shortest route via sending peer`);
            // If our best route is via the sending peer, return signal to sender with unroutable flag set and payload removed.
            // Only do this if the signal is not already a unroutable response.
            if (msg.flags === 0) {
                channel.signal(/*senderId*/ msg.recipientId, /*recipientId*/ msg.senderId, msg.nonce, Network.SIGNAL_TTL_INITIAL, SignalMessage.Flag.UNROUTABLE);
            }
            return;
        }

        // Decrement ttl and forward signal.
        signalChannel.signal(msg.senderId, msg.recipientId, msg.nonce, msg.ttl - 1, msg.flags, msg.payload, msg.senderPubKey, msg.signature);

        // We store forwarded messages if there are no special flags set.
        if (msg.flags === 0) {
            this._forwards.add(msg.senderId, msg.recipientId, msg.nonce);
        }

        // XXX This is very spammy!!!
        // Log.v(Network, `Forwarding signal (ttl=${msg.ttl}) from ${msg.senderId} `
        //     + `(received from ${channel.peerAddress}) to ${msg.recipientId} `
        //     + `(via ${signalChannel.peerAddress})`);
    }
}
Class.register(SignalProcessor);

class SignalStore {
    /**
     * @param {number} maxSize maximum number of entries
     */
    constructor(maxSize = 1000) {
        /** @type {number} */
        this._maxSize = maxSize;
        /** @type {UniqueQueue.<ForwardedSignal>} */
        this._queue = new UniqueQueue();
        /** @type {HashMap.<ForwardedSignal, number>} */
        this._store = new HashMap();
    }

    /** @type {number} */
    get length() {
        return this._queue.length;
    }

    /**
     * @param {PeerId} senderId
     * @param {PeerId} recipientId
     * @param {number} nonce
     */
    add(senderId, recipientId, nonce) {
        // If we already forwarded such a message, just update timestamp.
        if (this.contains(senderId, recipientId, nonce)) {
            const signal = new ForwardedSignal(senderId, recipientId, nonce);
            this._store.put(signal, Date.now());
            this._queue.requeue(signal);
            return;
        }

        // Delete oldest if needed.
        if (this.length >= this._maxSize) {
            const oldest = this._queue.dequeue();
            this._store.remove(oldest);
        }
        const signal = new ForwardedSignal(senderId, recipientId, nonce);
        this._queue.enqueue(signal);
        this._store.put(signal, Date.now());
    }

    /**
     * @param {PeerId} senderId
     * @param {PeerId} recipientId
     * @param {number} nonce
     * @return {boolean}
     */
    contains(senderId, recipientId, nonce) {
        const signal = new ForwardedSignal(senderId, recipientId, nonce);
        return this._store.contains(signal);
    }

    /**
     * @param {PeerId} senderId
     * @param {PeerId} recipientId
     * @param {number} nonce
     * @return {boolean}
     */
    signalForwarded(senderId, recipientId, nonce) {
        const signal = new ForwardedSignal(senderId, recipientId, nonce);
        const lastSeen = this._store.get(signal);
        if (!lastSeen) {
            return false;
        }
        const valid = lastSeen + ForwardedSignal.SIGNAL_MAX_AGE > Date.now();
        if (!valid) {
            // Because of the ordering, we know that everything after that is invalid too.
            let signalToDelete;
            do {
                signalToDelete = this._queue.dequeue();
                this._store.remove(signalToDelete);
            } while (this._queue.length > 0 && !signal.equals(signalToDelete));
        }
        return valid;
    }
}
SignalStore.SIGNAL_MAX_AGE = 10 /* seconds */;
Class.register(SignalStore);

class ForwardedSignal {
    /**
     * @param {PeerId} senderId
     * @param {PeerId} recipientId
     * @param {number} nonce
     */
    constructor(senderId, recipientId, nonce) {
        /** @type {PeerId} */
        this._senderId = senderId;
        /** @type {PeerId} */
        this._recipientId = recipientId;
        /** @type {number} */
        this._nonce = nonce;
    }

    /**
     * @param {ForwardedSignal} o
     * @returns {boolean}
     */
    equals(o) {
        return o instanceof ForwardedSignal
            && this._senderId.equals(o._senderId)
            && this._recipientId.equals(o._recipientId)
            && this._nonce === o._nonce;
    }

    hashCode() {
        return this.toString();
    }

    /**
     * @returns {string}
     */
    toString() {
        return `ForwardedSignal{senderId=${this._senderId}, recipientId=${this._recipientId}, nonce=${this._nonce}}`;
    }
}
Class.register(ForwardedSignal);
