class WebRtcUtils {
    /**
     * @param {RTCIceCandidate} candidate
     */
    static candidateToNetAddress(candidate) {
        // TODO XXX Ad-hoc parsing of candidates - Improve!
        const parts = candidate.candidate.split(' ');
        if (parts.length < 6) {
            return null;
        }
        // XXX The IP obtained from the ice candidate is not really reliable.
        // But for the time being, we treat it as such as it only affects browser clients,
        // which cannot obtain a more reliable form of net addresses.
        return NetAddress.fromIP(parts[4], true);
    }
}
Class.register(WebRtcUtils);
