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
        let RTCPeerConnection = PlatformUtils.isBrowser() ? (window.RTCPeerConnection || window.webkitRTCPeerConnection) : null;
        return !!RTCPeerConnection && !!RTCPeerConnection.generateCertificate;
    }
}
Class.register(PlatformUtils);
