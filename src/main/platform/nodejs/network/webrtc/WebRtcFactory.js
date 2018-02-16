/**
 * We don't have support for WebRTC in node.js, none of the methods
 * of this factory should ever be called in production. This may
 * change in the future.
 */
class WebRtcFactory {
    /**
     * @returns {boolean}
     */
    static newPeerConnection() {
        return false;
    }

    /**
     * @returns {boolean}
     */
    static newSessionDescription() {
        return false;
    }

    /**
     * @returns {boolean}
     */
    static newIceCandidate() {
        return false;
    }
}
Class.register(WebRtcFactory);
