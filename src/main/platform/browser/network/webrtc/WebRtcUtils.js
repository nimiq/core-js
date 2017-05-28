class WebRtcUtils {
    static sdpToSignalId(sdp) {
        return sdp
            .match('fingerprint:sha-256(.*)\r\n')[1]     // parse fingerprint
            .replace(/:/g, '')                           // replace colons
            .slice(1, 33);                               // truncate hash to 16 bytes
    }
}
