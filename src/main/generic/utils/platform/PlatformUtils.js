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
}
Class.register(PlatformUtils);
