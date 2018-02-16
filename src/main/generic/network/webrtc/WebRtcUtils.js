class WebRtcUtils {
    static candidateToNetAddress(candidate) {
        // TODO XXX Ad-hoc parsing of candidates - Improve!
        const parts = candidate.candidate.split(' ');
        if (parts.length < 6) {
            return null;
        }
        return NetAddress.fromIP(parts[4]);
    }
}
Class.register(WebRtcUtils);
