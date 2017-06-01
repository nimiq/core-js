class Protocol {
    // Used for filtering peer addresses by protocols.
    // XXX cleanup
    static myProtocolMask() {
        // Always get WebSocket peers. If we are in a browser, get WebRTC peers as well.
        let protocolMask = Protocol.WS;
        if (PlatformUtils.isBrowser()) {
            protocolMask |= Protocol.RTC;
        }
        return protocolMask;
    }
}
Protocol.DUMB = 0;
Protocol.WS = 1;
Protocol.RTC = 2;
Class.register(Protocol);
