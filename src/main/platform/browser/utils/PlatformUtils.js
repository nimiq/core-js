class PlatformUtils {
    /**
     * @returns {boolean}
     */
    static isBrowser() {
        return true;
    }

    /**
     * @returns {boolean}
     */
    static isWeb() {
        return typeof window !== 'undefined';
    }

    /**
     * @returns {boolean}
     */
    static isNodeJs() {
        return false;
    }

    /**
     * @returns {boolean}
     */
    static supportsWebRTC() {
        const RTCPeerConnection = PlatformUtils.isBrowser() ? (window.RTCPeerConnection || window.webkitRTCPeerConnection) : null;
        return !!RTCPeerConnection && typeof RTCPeerConnection.prototype.createDataChannel === 'function';
    }

    /**
     * @returns {boolean}
     */
    static supportsWS() {
        return location && location.protocol === 'http:';
    }

    /**
     * @returns {boolean}
     */
    static isOnline() {
        return !('onLine' in window.navigator) || window.navigator.onLine;
    }

    /**
     * @returns {boolean}
     */
    static isWindows() {
        return /^win/.test(window.navigator.platform);
    }

    static get userAgentString() {
        try {
            return window.navigator.platform;
        } catch (e) {
            return 'unknown';
        }
    }

    static get hardwareConcurrency() {
        if (typeof navigator === 'object' && navigator.hardwareConcurrency) {
            return navigator.hardwareConcurrency;
        } else {
            return 1;
        }
    }
}

Class.register(PlatformUtils);
