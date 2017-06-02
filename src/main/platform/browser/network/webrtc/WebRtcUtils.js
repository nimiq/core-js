class WebRtcUtils {
    static sdpToSignalId(sdp) {
        return sdp
            .match('fingerprint:sha-256(.*)\r\n')[1]     // parse fingerprint
            .replace(/:/g, '')                           // replace colons
            .slice(1, 33);                               // truncate hash to 16 bytes
    }

    static candidateToNetAddress(candidate) {
        // TODO XXX Ad-hoc parsing of candidates - Improve!
        const parts = candidate.candidate.split(' ');
        if (parts.length < 6) {
            return null;
        }
        return NetAddress.fromIpAddress(parts[4], parts[5]);
    }
}
Class.register(WebRtcUtils);
