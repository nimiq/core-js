class PlatformUtils {
    static isBrowser() {
        return typeof window !== "undefined";
    }

    static supportsWebRTC() {
        return PlatformUtils.isBrowser() && !!(window.RTCPeerConnection || window.webkitRTCPeerConnection);
    }
}
Class.register(PlatformUtils);
