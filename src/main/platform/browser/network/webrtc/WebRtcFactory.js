class WebRtcFactory {
    /**
     * @param {?RTCConfiguration} configuration
     * @returns {RTCPeerConnection}
     */
    static newPeerConnection(configuration) {
        return new RTCPeerConnection(configuration);
    }

    /**
     * @param {*} rtcSessionDescriptionInit
     * @returns {RTCSessionDescription}
     */
    static newSessionDescription(rtcSessionDescriptionInit) {
        return new RTCSessionDescription(rtcSessionDescriptionInit);
    }

    /**
     * @param {*} rtcIceCandidateInit
     * @returns {RTCIceCandidate}
     */
    static newIceCandidate(rtcIceCandidateInit) {
        return new RTCIceCandidate(rtcIceCandidateInit);
    }
}
Class.register(WebRtcFactory);
