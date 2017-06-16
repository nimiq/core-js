class PlatformUtils {
    static isBrowser() {
        return typeof window !== "undefined";
    }

    static supportsWebRTC() {
        let RTCPeerConnection = (window.RTCPeerConnection || window.webkitRTCPeerConnection);
        return PlatformUtils.isBrowser() && !!RTCPeerConnection && !!RTCPeerConnection.generateCertificate;
    }
}
Class.register(PlatformUtils);
