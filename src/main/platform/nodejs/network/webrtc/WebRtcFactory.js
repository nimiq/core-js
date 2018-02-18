/**
 * We don't have support for WebRTC in node.js, none of the methods
 * of this factory should ever be called in production. This may
 * change in the future.
 */
class WebRtcFactory {
    /**
     * @param {?RTCConfiguration} configuration
     * @returns {?RTCPeerConnection}
     */
    static newPeerConnection(configuration) {
        return null;
    }

    /**
     * @param {*} rtcSessionDescriptionInit
     * @returns {?RTCSessionDescription}
     */
    static newSessionDescription(rtcSessionDescriptionInit) {
        return null;
    }

    /**
     * @param {*} rtcIceCandidateInit
     * @returns {?RTCIceCandidate}
     */
    static newIceCandidate(rtcIceCandidateInit) {
        return null;
    }
}
Class.register(WebRtcFactory);
