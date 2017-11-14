class PlatformUtils {
    /**
     * @returns {boolean}
     */
    static isBrowser() {
        return typeof window !== 'undefined';
    }

    /**
     * @returns {boolean}
     */
    static supportsWebRTC() {
        let RTCPeerConnection = (window.RTCPeerConnection || window.webkitRTCPeerConnection);
        return PlatformUtils.isBrowser() && !!RTCPeerConnection && !!RTCPeerConnection.generateCertificate;
    }

    /**
     * @returns {boolean}
     */
    static isOnline() {
        return (!PlatformUtils.isBrowser() || !('onLine' in window.navigator)) || window.navigator.onLine;
    }
}
Class.register(PlatformUtils);
