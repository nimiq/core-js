class PeerAddressBook extends Observable {
    /**
     * @constructor
     * @param {NetworkConfig} netconfig
     */
    constructor(netconfig) {
        super();

        /**
         * @type {NetworkConfig}
         * @private
         */
        this._networkConfig = netconfig;

        /**
         * Set of PeerAddressStates of all peerAddresses we know.
         * @type {HashSet.<PeerAddressState>}
         * @private
         */
        this._store = new HashSet();

        /**
         * @type {HashSet}
         * @private
         */
        this._wsStates = new HashSet();

        /**
         * @type {HashSet}
         * @private
         */
        this._rtcStates = new HashSet();

        /**
         * Map from peerIds to RTC peerAddresses.
         * @type {HashMap.<PeerId,PeerAddressState>}
         * @private
         */
        this._stateByPeerId = new HashMap();

        /**
         * @type {HashMap.<NetAddress,Set.<PeerAddressState>>}
         * @private
         */
        this._statesByNetAddress = new HashMap();

        // Init seed peers.
        this.add(/*channel*/ null, GenesisConfig.SEED_PEERS);

        // Setup housekeeping interval.
        setInterval(() => this._housekeeping(), PeerAddressBook.HOUSEKEEPING_INTERVAL);
    }

    /**
     * @returns {Iterator.<PeerAddressState>}
     */
    iterator() {
        return this._store.valueIterator();
    }

    /**
     * @returns {Iterator.<PeerAddressState>}
     */
    wsIterator() {
        return this._wsStates.valueIterator();
    }

    /**
     * @returns {Iterator.<PeerAddressState>}
     */
    rtcIterator() {
        return this._rtcStates.valueIterator();
    }

    /**
     * @param {PeerAddress} peerAddress
     * @returns {?PeerAddressState}
     * @private
     */
    _get(peerAddress) {
        if (peerAddress instanceof WssPeerAddress || peerAddress instanceof WsPeerAddress) {
            const localPeerAddress = this._store.get(peerAddress.withoutId());
            if (localPeerAddress) return localPeerAddress;
        }
        return this._store.get(peerAddress);
    }

    /**
     * @param {PeerAddress} peerAddress
     * @returns {?PeerAddressState}
     */
    getState(peerAddress) {
        return this._get(peerAddress);
    }

    /**
     * @param {PeerAddress} peerAddress
     * @returns {PeerAddress|null}
     */
    get(peerAddress) {
        /** @type {PeerAddressState} */
        const peerAddressState = this._get(peerAddress);
        return peerAddressState ? peerAddressState.peerAddress : null;
    }

    /**
     * @param {PeerId} peerId
     * @returns {PeerAddress|null}
     */
    getByPeerId(peerId) {
        /** @type {PeerAddressState} */
        const peerAddressState = this._stateByPeerId.get(peerId);
        return peerAddressState ? peerAddressState.peerAddress : null;
    }

    /**
     * @param {PeerId} peerId
     * @returns {PeerChannel}
     */
    getChannelByPeerId(peerId) {
        const peerAddressState = this._stateByPeerId.get(peerId);
        if (peerAddressState && peerAddressState.signalRouter.bestRoute) {
            return peerAddressState.signalRouter.bestRoute.signalChannel;
        }
        return null;
    }

    /**
     * @param {number} protocolMask
     * @param {number} serviceMask
     * @param {number} maxAddresses
     * @returns {Array.<PeerAddress>}
     */
    query(protocolMask, serviceMask, maxAddresses = NetworkAgent.MAX_ADDR_PER_MESSAGE) {
        let store;
        switch (protocolMask) {
            case Protocol.WS:
            case Protocol.WSS:
            case Protocol.WS | Protocol.WSS:
                store = this._wsStates;
                break;
            case Protocol.RTC:
                store = this._rtcStates;
                break;
            default:
                store = this._store;
        }

        const numAddresses = store.length;

        // Pick a random start index if we have a lot of addresses.
        let startIndex = 0, endIndex = numAddresses;
        if (numAddresses > maxAddresses) {
            startIndex = Math.floor(Math.random() * numAddresses);
            endIndex = (startIndex + maxAddresses) % numAddresses;
        }
        const overflow = startIndex > endIndex;

        // XXX inefficient linear scan
        const addresses = [];
        let index = -1;
        for (const peerAddressState of store.valueIterator()) {
            index++;
            if (!overflow && index < startIndex) continue;
            if (!overflow && index >= endIndex) break;
            if (overflow && (index >= endIndex && index < startIndex)) continue;

            // Never return banned or failed addresses.
            if (peerAddressState.state === PeerAddressState.BANNED
                    || peerAddressState.state === PeerAddressState.FAILED) {
                continue;
            }

            // Never return seed peers.
            const address = peerAddressState.peerAddress;
            if (address.isSeed()) {
                continue;
            }

            // Only return addresses matching the protocol mask.
            if ((address.protocol & protocolMask) === 0) {
                continue;
            }

            // Only return addresses matching the service mask.
            if ((address.services & serviceMask) === 0) {
                continue;
            }

            // XXX Why is this here?
            // Update timestamp for connected peers.
            // if (peerAddressState.state === PeerAddressState.ESTABLISHED) {
            //     // Also update timestamp for RTC connections
            //     if (peerAddressState.signalRouter.bestRoute) {
            //         peerAddressState.signalRouter.bestRoute.timestamp = now;
            //     }
            // }

            // Exclude RTC addresses that are already at MAX_DISTANCE.
            if (address.protocol === Protocol.RTC && address.distance >= PeerAddressBook.MAX_DISTANCE) {
                continue;
            }

            // Never return addresses that are too old.
            if (address.exceedsAge()) {
                continue;
            }

            // Return this address.
            addresses.push(address);
        }
        return addresses;
    }

    /**
     * @param {PeerChannel} channel
     * @param {PeerAddress|Array.<PeerAddress>} arg
     * @fires PeerAddressBook#added
     */
    add(channel, arg) {
        const peerAddresses = Array.isArray(arg) ? arg : [arg];
        const newAddresses = [];

        for (const addr of peerAddresses) {
            if (this._add(channel, addr)) {
                newAddresses.push(addr);
            }
        }

        // Tell listeners that we learned new addresses.
        if (newAddresses.length) {
            this.fire('added', newAddresses, this);
        }
    }

    /**
     * @param {PeerChannel} channel
     * @param {PeerAddress|RtcPeerAddress} peerAddress
     * @returns {boolean}
     * @private
     */
    _add(channel, peerAddress) {
        // Ignore our own address.
        if (this._networkConfig.peerAddress.equals(peerAddress)) {
            return false;
        }

        // Ignore address if it is too old.
        // Special case: allow seed addresses (timestamp == 0) via null channel.
        if (channel && peerAddress.exceedsAge()) {
            Log.v(PeerAddressBook, () => `Ignoring address ${peerAddress} - too old (${new Date(peerAddress.timestamp)})`);
            return false;
        }

        // Ignore address if its timestamp is too far in the future.
        if (peerAddress.timestamp > Date.now() + PeerAddressBook.MAX_TIMESTAMP_DRIFT) {
            Log.v(PeerAddressBook, () => `Ignoring addresses ${peerAddress} - timestamp in the future`);
            return false;
        }

        // Increment distance values of RTC addresses.
        if (peerAddress.protocol === Protocol.RTC) {
            peerAddress.distance++;

            // Ignore address if it exceeds max distance.
            if (peerAddress.distance > PeerAddressBook.MAX_DISTANCE) {
                Log.v(PeerAddressBook, () => `Ignoring address ${peerAddress} - max distance exceeded`);
                // Drop any route to this peer over the current channel. This may prevent loops.
                const peerAddressState = this._get(peerAddress);
                if (peerAddressState) {
                    peerAddressState.signalRouter.deleteRoute(channel);
                }
                return false;
            }
        }

        // Get the (reliable) netAddress of the peer that sent us this address.
        const netAddress = channel && channel.netAddress && channel.netAddress.reliable ? channel.netAddress : null;

        // Check if we already know this address.
        let peerAddressState = this._get(peerAddress);
        let knownAddress = null;
        let changed = false;
        if (peerAddressState) {
            // Update address.
            knownAddress = peerAddressState.peerAddress;

            // Ignore address if it is banned.
            if (peerAddressState.state === PeerAddressState.BANNED) {
                return false;
            }

            // Never update seed peers.
            if (knownAddress.isSeed()) {
                return false;
            }

            // Never erase NetAddresses and never overwrite reliable addresses.
            if (knownAddress.netAddress && (!peerAddress.netAddress || knownAddress.netAddress.reliable)) {
                peerAddress.netAddress = knownAddress.netAddress;
            }
        } else {
            // New address, check max book size.
            if (this._store.length >= PeerAddressBook.MAX_SIZE) {
                return false;
            }
            // Check max size per protocol.
            switch (peerAddress.protocol) {
                case Protocol.WS:
                case Protocol.WSS:
                    if (this._wsStates.length >= PeerAddressBook.MAX_SIZE_WS) {
                        return false;
                    }
                    break;
                case Protocol.RTC:
                    if (this._rtcStates.length >= PeerAddressBook.MAX_SIZE_RTC) {
                        return false;
                    }
                    break;
                default:
                // Dumb addresses are only part of global limit.
            }

            // If we know the IP address of the sender, check that we don't exceed the maximum number of addresses per IP.
            if (netAddress) {
                const states = this._statesByNetAddress.get(netAddress);
                if (states && states.size >= PeerAddressBook.MAX_SIZE_PER_IP) {
                    Log.v(PeerAddressBook, () => `Ignoring address ${peerAddress} - max count per IP ${netAddress} reached`);
                    return false;
                }
            }

            // Add new peerAddressState.
            peerAddressState = new PeerAddressState(peerAddress);
            this._addToStore(peerAddressState);
            changed = true;
        }

        // Update address if we do not know this address or it has a more recent timestamp.
        if (!knownAddress || knownAddress.timestamp < peerAddress.timestamp) {
            peerAddressState.peerAddress = peerAddress;
            changed = true;
        }

        // Add route.
        if (peerAddress.protocol === Protocol.RTC) {
            changed = peerAddressState.signalRouter.addRoute(channel, peerAddress.distance, peerAddress.timestamp) || changed;
        }

        // Track which IP address send us this address.
        this._trackByNetAddress(peerAddressState, netAddress);


        return changed;
    }

    /**
     * @param {PeerAddressState} peerAddressState
     * @private
     */
    _addToStore(peerAddressState) {
        this._store.add(peerAddressState);

        // Index by peerId.
        if (peerAddressState.peerAddress.peerId) {
            this._stateByPeerId.put(peerAddressState.peerAddress.peerId, peerAddressState);
        }

        // Index by protocol.
        switch (peerAddressState.peerAddress.protocol) {
            case Protocol.WS:
            case Protocol.WSS:
                this._wsStates.add(peerAddressState);
                break;
            case Protocol.RTC:
                this._rtcStates.add(peerAddressState);
                break;
            default:
                // Dumb addresses are ignored.
        }
    }

    /**
     * @param {PeerAddressState} peerAddressState
     * @param {NetAddress} netAddress
     * @private
     */
    _trackByNetAddress(peerAddressState, netAddress) {
        if (!netAddress) {
            return;
        }

        peerAddressState.addedBy.add(netAddress);

        let states = this._statesByNetAddress.get(netAddress);
        if (!states) {
            states = new Set();
            this._statesByNetAddress.put(netAddress, states);
        }
        states.add(peerAddressState);
    }

    /**
     * Called when a connection to this peerAddress has been established.
     * The connection might have been initiated by the other peer, so address
     * may not be known previously.
     * If it is already known, it has been updated by a previous version message.
     * @param {PeerChannel} channel
     * @param {PeerAddress|RtcPeerAddress} peerAddress
     * @returns {void}
     */
    established(channel, peerAddress) {
        let peerAddressState = this._get(peerAddress);
        
        if (!peerAddressState) {
            peerAddressState = new PeerAddressState(peerAddress);
            this._addToStore(peerAddressState);
        }

        // Get the (reliable) netAddress of the peer that sent us this address.
        const netAddress = channel && channel.netAddress && channel.netAddress.reliable ? channel.netAddress : null;
        this._trackByNetAddress(peerAddressState, netAddress);

        peerAddressState.state = PeerAddressState.ESTABLISHED;
        peerAddressState.lastConnected = Date.now();
        peerAddressState.failedAttempts = 0;
        peerAddressState.bannedUntil = -1;
        peerAddressState.banBackoff = PeerAddressBook.INITIAL_FAILED_BACKOFF;

        if (!peerAddressState.peerAddress.isSeed()) {
            peerAddressState.peerAddress = peerAddress;
        }

        // Add route.
        if (peerAddress.protocol === Protocol.RTC) {
            peerAddressState.signalRouter.addRoute(channel, peerAddress.distance, peerAddress.timestamp);
        }
    }

    /**
     * Called when a connection to this peerAddress is closed.
     * @param {PeerChannel} channel
     * @param {PeerAddress} peerAddress
     * @param {number|null} type
     * @returns {void}
     */
    close(channel, peerAddress, type = null) {
        const peerAddressState = this._get(peerAddress);
        if (!peerAddressState) {
            return;
        }

        // register the type of disconnection
        peerAddressState.close(type);

        // Delete all addresses that were signalable over the disconnected peer.
        if (channel) {
            this._removeBySignalChannel(channel);
        }

        if (CloseType.isBanningType(type)){
            this._ban(peerAddress);
        }
        else if (CloseType.isFailingType(type)) {
            peerAddressState.failedAttempts++;

            if (peerAddressState.failedAttempts >= peerAddressState.maxFailedAttempts) {
                // Remove address only if we have tried the maximum number of backoffs.
                if (peerAddressState.banBackoff >= PeerAddressBook.MAX_FAILED_BACKOFF) {
                    this._removeFromStore(peerAddress);
                } else {
                    peerAddressState.bannedUntil = Date.now() + peerAddressState.banBackoff;
                    peerAddressState.banBackoff = Math.min(PeerAddressBook.MAX_FAILED_BACKOFF, peerAddressState.banBackoff * 2);
                }
            }
        }

        // Immediately delete dumb addresses, since we cannot connect to those anyway.
        if (peerAddress.protocol === Protocol.DUMB) {
            this._removeFromStore(peerAddress);
        }
    }

    /**
     * Called when a message has been returned as unroutable.
     * @param {PeerChannel} channel
     * @param {PeerAddress} peerAddress
     * @returns {void}
     */
    unroutable(channel, peerAddress) {
        if (!peerAddress) {
            return;
        }

        const peerAddressState = this._get(peerAddress);
        if (!peerAddressState) {
            return;
        }

        if (!peerAddressState.signalRouter.bestRoute || !peerAddressState.signalRouter.bestRoute.signalChannel.equals(channel)) {
            Log.d(PeerAddressBook, () => `Got unroutable for ${peerAddress} on a channel other than the best route.`);
            return;
        }

        peerAddressState.signalRouter.deleteBestRoute();
        if (!peerAddressState.signalRouter.hasRoute()) {
            this._removeFromStore(peerAddressState.peerAddress);
        }
    }

    /**
     * @param {PeerAddress} peerAddress
     * @param {number} [duration] in milliseconds
     * @returns {void}
     * @private
     */
    _ban(peerAddress, duration = PeerAddressBook.DEFAULT_BAN_TIME) {
        let peerAddressState = this._get(peerAddress);
        if (!peerAddressState) {
            peerAddressState = new PeerAddressState(peerAddress);
            this._store.add(peerAddressState);
        }

        peerAddressState.state = PeerAddressState.BANNED;
        peerAddressState.bannedUntil = Date.now() + duration;

        // Drop all routes to this peer.
        peerAddressState.signalRouter.deleteAllRoutes();
    }

    /**
     * @param {PeerAddress} peerAddress
     * @returns {boolean}
     */
    isBanned(peerAddress) {
        const peerAddressState = this._get(peerAddress);
        return peerAddressState
            && peerAddressState.state === PeerAddressState.BANNED
            // XXX Never consider seed peers to be banned. This allows us to use
            // the banning mechanism to prevent seed peers from being picked when
            // they are down, but still allows recovering seed peers' inbound
            // connections to succeed.
            && !peerAddressState.peerAddress.isSeed();
    }

    /**
     * @param {PeerAddress} peerAddress
     * @returns {void}
     * @private
     */
    _removeFromStore(peerAddress) {
        const peerAddressState = this._get(peerAddress);
        if (!peerAddressState) {
            return;
        }

        // Never delete seed addresses, ban them instead for a couple of minutes.
        if (peerAddressState.peerAddress.isSeed()) {
            this._ban(peerAddress, peerAddressState.banBackoff);
            return;
        }

        // Delete from peerId index.
        if (peerAddress.peerId) {
            this._stateByPeerId.remove(peerAddress.peerId);
        }

        // Delete from netAddress index.
        for (const netAddress of peerAddressState.addedBy) {
            const states = this._statesByNetAddress.get(netAddress);
            if (states) {
                states.delete(peerAddressState);
                if (states.size === 0) {
                    this._statesByNetAddress.remove(netAddress);
                }
            }
        }

        // Remove from protocol index.
        switch (peerAddressState.peerAddress.protocol) {
            case Protocol.WS:
            case Protocol.WSS:
                this._wsStates.remove(peerAddressState);
                break;
            case Protocol.RTC:
                this._rtcStates.remove(peerAddressState);
                break;
            default:
                // Dumb addresses are ignored.
        }

        // Don't delete bans.
        if (peerAddressState.state === PeerAddressState.BANNED) {
            return;
        }

        // Delete the address.
        this._store.remove(peerAddress);
    }

    /**
     * Delete all RTC-only routes that are signalable over the given peer.
     * @param {PeerChannel} channel
     * @returns {void}
     * @private
     */
    _removeBySignalChannel(channel) {
        // XXX inefficient linear scan
        for (const peerAddressState of this._store.valueIterator()) {
            if (peerAddressState.peerAddress.protocol === Protocol.RTC) {
                peerAddressState.signalRouter.deleteRoute(channel);
                if (!peerAddressState.signalRouter.hasRoute()) {
                    this._removeFromStore(peerAddressState.peerAddress);
                }
            }
        }
    }

    /**
     * @returns {void}
     * @private
     */
    _housekeeping() {
        const now = Date.now();
        const unbannedAddresses = [];

        for (/** @type {PeerAddressState} */ const peerAddressState of this._store.valueIterator()) {
            const addr = peerAddressState.peerAddress;

            switch (peerAddressState.state) {
                case PeerAddressState.NEW:
                case PeerAddressState.TRIED:
                case PeerAddressState.FAILED:
                    // Delete all new peer addresses that are older than MAX_AGE.
                    if (addr.exceedsAge()) {
                        this._removeFromStore(addr);
                        continue;
                    }

                    // Reset failed attempts after bannedUntil has expired.
                    if (peerAddressState.state === PeerAddressState.FAILED
                        && peerAddressState.failedAttempts >= peerAddressState.maxFailedAttempts
                        && peerAddressState.bannedUntil > 0 && peerAddressState.bannedUntil <= now) {

                        peerAddressState.bannedUntil = -1;
                        peerAddressState.failedAttempts = 0;
                        unbannedAddresses.push(addr);
                    }

                    break;

                case PeerAddressState.BANNED:
                    if (peerAddressState.bannedUntil <= now) {
                        // Don't remove seed addresses, unban them.
                        if (addr.isSeed()) {
                            // Restore banned seed addresses to the NEW state.
                            peerAddressState.state = PeerAddressState.NEW;
                            peerAddressState.failedAttempts = 0;
                            peerAddressState.bannedUntil = -1;
                            unbannedAddresses.push(addr);
                        } else {
                            // Delete expires bans.
                            this._store.remove(addr);
                        }
                    }
                    break;

                case PeerAddressState.ESTABLISHED:
                    // Also update timestamp for RTC connections
                    if (peerAddressState.signalRouter.bestRoute) {
                        peerAddressState.signalRouter.bestRoute.timestamp = now;
                    }
                    break;

                default:
                    // TODO What about peers who are stuck connecting? Can this happen?
                    // Do nothing for CONNECTING peers.
            }
        }

        if (unbannedAddresses.length) {
            this.fire('added', unbannedAddresses, this);
        }
    }

    /** @type {number} */
    get knownAddressesCount() {
        return this._store.length;
    }

    /** @type {number} */
    get knownWsAddressesCount() {
        return this._wsStates.length;
    }

    /** @type {number} */
    get knownRtcAddressesCount() {
        return this._rtcStates.length;
    }
}
PeerAddressBook.MAX_AGE_WEBSOCKET = 1000 * 60 * 30; // 30 minutes
PeerAddressBook.MAX_AGE_WEBRTC = 1000 * 60 * 15; // 10 minutes
PeerAddressBook.MAX_AGE_DUMB = 1000 * 60; // 1 minute
PeerAddressBook.MAX_DISTANCE = 4;
PeerAddressBook.MAX_FAILED_ATTEMPTS_WS = 3;
PeerAddressBook.MAX_FAILED_ATTEMPTS_RTC = 2;
PeerAddressBook.MAX_TIMESTAMP_DRIFT = 1000 * 60 * 10; // 10 minutes
PeerAddressBook.HOUSEKEEPING_INTERVAL = 1000 * 60; // 1 minute
PeerAddressBook.DEFAULT_BAN_TIME = 1000 * 60 * 10; // 10 minutes
PeerAddressBook.INITIAL_FAILED_BACKOFF = 1000 * 30; // 30 seconds
PeerAddressBook.MAX_FAILED_BACKOFF = 1000 * 60 * 10; // 10 minutes
PeerAddressBook.MAX_SIZE_WS = PlatformUtils.isBrowser() ? 1000 : 10000;
PeerAddressBook.MAX_SIZE_RTC = PlatformUtils.isBrowser() ? 1000 : 10000;
PeerAddressBook.MAX_SIZE = PlatformUtils.isBrowser() ? 2500 : 20500; // Includes dumb peers
PeerAddressBook.MAX_SIZE_PER_IP = 250;
Class.register(PeerAddressBook);
