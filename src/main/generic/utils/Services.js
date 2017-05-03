class Services {
    // XXX Temporary stub, needs to be configurable later on.
    static myServices() {
        // If we are running in a browser, we support WebRTC, WebSocket otherwise.
        // TODO legacy browsers w/o webrtc
        return PlatformUtils.isBrowser() ? Services.WEBRTC : Services.WEBSOCKET;
    }

    // Used for filtering peer addresses by services.
    // XXX cleanup
    static myServiceMask() {
        // Always get WebSocket peers. If we are in a browser, get WebRTC peers as well.
        let serviceMask = Services.WEBSOCKET;
        if (PlatformUtils.isBrowser()) {
            serviceMask |= Services.WEBRTC;
        }
        return serviceMask;
    }

    static isWebSocket(services) {
        return (services & Services.WEBSOCKET) !== 0;
    }

    static isWebRtc(services) {
        return (services & Services.WEBRTC) !== 0;
    }
}
Services.WEBSOCKET = 1;
Services.WEBRTC = 2;
