// This is just a stub. It does nothing on NodeJS.
class WebRtcConnector extends Observable {
    connect(peerAddress) {
        return false;
    }

    signal(channel, msg) {
        // ignore
    }
}
Class.register(WebRtcConnector);
