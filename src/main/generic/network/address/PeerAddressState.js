class PeerAddressState {
    /**
     * @param {PeerAddress} peerAddress
     */
    constructor(peerAddress) {
        /** @type {PeerAddress} */
        this.peerAddress = peerAddress;

        /** @type {number} */
        this.state = PeerAddressState.NEW;
        /** @type {number} */
        this.lastConnected = -1;
        /** @type {number} */
        this.bannedUntil = -1;
        /** @type {number} */
        this.banBackoff = PeerAddressBook.INITIAL_FAILED_BACKOFF;

        /** @type {SignalRouter} */
        this._signalRouter = new SignalRouter(peerAddress);

        /** @type {number} */
        this._failedAttempts = 0;

        /**
         * Map from closeType to number of occurrences
         * @type {Map.<number,number>}
         * @private
         */
        this._closeTypes = new Map();

        /**
         * @type {HashSet.<NetAddress>}
         * @private
         */
        this._addedBy = new HashSet();
    }

    /** @type {SignalRouter} */
    get signalRouter() {
        return this._signalRouter;
    }

    /** @type {number} */
    get maxFailedAttempts() {
        switch (this.peerAddress.protocol) {
            case Protocol.RTC:
                return PeerAddressBook.MAX_FAILED_ATTEMPTS_RTC;
            case Protocol.WS:
            case Protocol.WSS:
                return PeerAddressBook.MAX_FAILED_ATTEMPTS_WS;
            default:
                return 0;
        }
    }

    /** @type {number} */
    get failedAttempts() {
        if (this._signalRouter.bestRoute) {
            return this._signalRouter.bestRoute.failedAttempts;
        } else {
            return this._failedAttempts;
        }
    }

    /** @type {number} */
    set failedAttempts(value) {
        if (this._signalRouter.bestRoute) {
            this._signalRouter.bestRoute.failedAttempts = value;
            this._signalRouter.updateBestRoute(); // scores may have changed
        } else {
            this._failedAttempts = value;
        }
    }

    /**
     * @param {number} type
     */
    close(type) {
        if (!type) return;

        if (this._closeTypes.has(type)) {
            this._closeTypes.set(type, this._closeTypes.get(type) + 1);
        } else {
            this._closeTypes.set(type, 1);
        }

        if (this.state === PeerAddressState.BANNED) {
            return;
        }

        if (CloseType.isBanningType(type)) {
            this.state = PeerAddressState.BANNED;
        } else if (CloseType.isFailingType(type)) {
            this.state = PeerAddressState.FAILED;
        } else {
            this.state = PeerAddressState.TRIED;
        }
    }

    /**
     * @param {PeerAddressState|*} o
     * @returns {boolean}
     */
    equals(o) {
        return o instanceof PeerAddressState
            && this.peerAddress.equals(o.peerAddress);
    }

    /**
     * @returns {string}
     */
    hashCode() {
        return this.peerAddress.hashCode();
    }

    /**
     * @returns {string}
     */
    toString() {
        return `PeerAddressState{peerAddress=${this.peerAddress}, state=${this.state}, `
            + `lastConnected=${this.lastConnected}, failedAttempts=${this.failedAttempts}, `
            + `bannedUntil=${this.bannedUntil}}`;
    }

    /** @type {HashSet.<NetAddress>} */
    get addedBy() {
        return this._addedBy;
    }
}
PeerAddressState.NEW = 1;
PeerAddressState.ESTABLISHED = 2;
PeerAddressState.TRIED = 3;
PeerAddressState.FAILED = 4;
PeerAddressState.BANNED = 5;
Class.register(PeerAddressState);

class SignalRouter {
    /**
     * @constructor
     * @param {PeerAddress} peerAddress
     */
    constructor(peerAddress) {
        /** @type {PeerAddress} */
        this.peerAddress = peerAddress;

        /** @type {SignalRoute} */
        this._bestRoute = null;
        /** @type {HashSet.<SignalRoute>} */
        this._routes = new HashSet();
    }

    /** @type {SignalRoute} */
    get bestRoute() {
        return this._bestRoute;
    }

    /**
     * @param {PeerChannel} signalChannel
     * @param {number} distance
     * @param {number} timestamp
     * @returns {boolean} whether we have a new best route
     */
    addRoute(signalChannel, distance, timestamp) {
        const oldRoute = this._routes.get(signalChannel);
        const newRoute = new SignalRoute(signalChannel, distance, timestamp);

        if (oldRoute) {
            // Do not reset failed attempts.
            newRoute.failedAttempts = oldRoute.failedAttempts;
        }
        this._routes.add(newRoute);

        if (!this._bestRoute || newRoute.score > this._bestRoute.score
            || (newRoute.score === this._bestRoute.score && timestamp > this._bestRoute.timestamp)) {

            this._bestRoute = newRoute;
            this.peerAddress.distance = this._bestRoute.distance;
            return true;
        }
        return false;
    }

    /**
     * @returns {void}
     */
    deleteBestRoute() {
        if (this._bestRoute) {
            this.deleteRoute(this._bestRoute.signalChannel);
        }
    }

    /**
     * @param {PeerChannel} signalChannel
     * @returns {void}
     */
    deleteRoute(signalChannel) {
        this._routes.remove(signalChannel); // maps to same hashCode
        if (this._bestRoute && this._bestRoute.signalChannel.equals(signalChannel)) {
            this.updateBestRoute();
        }
    }

    /**
     * @returns {void}
     */
    deleteAllRoutes() {
        this._bestRoute = null;
        this._routes = new HashSet();
    }

    /**
     * @returns {boolean}
     */
    hasRoute() {
        return this._routes.length > 0;
    }

    /**
     * @returns {void}
     * @private
     */
    updateBestRoute() {
        let bestRoute = null;
        // Choose the route with minimal distance and maximal timestamp.
        for (const route of this._routes.valueIterator()) {
            if (bestRoute === null || route.score > bestRoute.score
                || (route.score === bestRoute.score && route.timestamp > bestRoute.timestamp)) {

                bestRoute = route;
            }
        }
        this._bestRoute = bestRoute;
        if (this._bestRoute) {
            this.peerAddress.distance = this._bestRoute.distance;
        } else {
            this.peerAddress.distance = PeerAddressBook.MAX_DISTANCE + 1;
        }
    }

    /**
     * @param {PeerAddressState|*} o
     * @returns {boolean}
     */
    equals(o) {
        return o instanceof PeerAddressState
            && this.peerAddress.equals(o.peerAddress);
    }

    /**
     * @returns {string}
     */
    hashCode() {
        return this.peerAddress.hashCode();
    }

    /**
     * @returns {string}
     */
    toString() {
        return `PeerAddressState{peerAddress=${this.peerAddress}, state=${this.state}, `
            + `lastConnected=${this.lastConnected}, failedAttempts=${this.failedAttempts}, `
            + `bannedUntil=${this.bannedUntil}}`;
    }
}
Class.register(SignalRouter);

class SignalRoute {
    /**
     * @param {PeerChannel} signalChannel
     * @param {number} distance
     * @param {number} timestamp
     */
    constructor(signalChannel, distance, timestamp) {
        this.failedAttempts = 0;
        this.timestamp = timestamp;
        this._signalChannel = signalChannel;
        this._distance = distance;
    }

    /** @type {PeerChannel} */
    get signalChannel() {
        return this._signalChannel;
    }

    /** @type {number} */
    get distance() {
        return this._distance;
    }

    /** @type {number} */
    get score() {
        return ((PeerAddressBook.MAX_DISTANCE - this._distance) / 2) * (1 - (this.failedAttempts / PeerAddressBook.MAX_FAILED_ATTEMPTS_RTC));
    }

    /**
     * @param {SignalRoute} o
     * @returns {boolean}
     */
    equals(o) {
        return o instanceof SignalRoute
            && this._signalChannel.equals(o._signalChannel);
    }

    /**
     * @returns {string}
     */
    hashCode() {
        return this._signalChannel.hashCode();
    }

    /**
     * @returns {string}
     */
    toString() {
        return `SignalRoute{signalChannel=${this._signalChannel}, distance=${this._distance}, timestamp=${this.timestamp}, failedAttempts=${this.failedAttempts}}`;
    }
}
Class.register(SignalRoute);
