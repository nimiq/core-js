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
        return PlatformUtils.isBrowser() && !!(window.RTCPeerConnection || window.webkitRTCPeerConnection);
    }
}
Class.register(PlatformUtils);
