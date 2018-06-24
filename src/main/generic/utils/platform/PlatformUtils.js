class PlatformUtils {
    /**
     * @returns {boolean}
     */
    static isBrowser() {
        return typeof window !== 'undefined';
    }

    /**
     * @return {boolean}
     */
    static isNodeJs() {
        return !PlatformUtils.isBrowser() && typeof process === 'object' && typeof require === 'function';
    }

    /**
     * @returns {boolean}
     */
    static supportsWebRTC() {
        const RTCPeerConnection = PlatformUtils.isBrowser() ? (window.RTCPeerConnection || window.webkitRTCPeerConnection) : null;
        return !!RTCPeerConnection;
    }

    /**
     * @returns {boolean}
     */
    static supportsWS() {
        return !PlatformUtils.isBrowser() || (location && location.protocol === 'http:');
    }

    /**
     * @returns {boolean}
     */
    static isOnline() {
        return (!PlatformUtils.isBrowser() || !('onLine' in window.navigator)) || window.navigator.onLine;
    }
}
Class.register(PlatformUtils);
