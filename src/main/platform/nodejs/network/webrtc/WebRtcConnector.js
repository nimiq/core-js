// This is just a stub. It does nothing on NodeJS.
class WebRtcConnector extends Observable {
    connect(peerAddress) {
        this.fire('error', peerAddress);
    }

    signal(channel, msg) {
        // ignore
    }
}
Class.register(WebRtcConnector);
