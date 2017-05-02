class Services {
    // XXX Temporary stub, needs to be configurable later on.
    static myServices() {
        // If we are running in a browser, we support WebRTC, WebSocket otherwise.
        return typeof window !== "undefined" ? Services.WEBRTC : Services.WEBSOCKET;
    }

    static isWebSocket(services) {
        return services & Services.WEBSOCKET !== 0;
    }

    static isWebRTC(services) {
        return services & Services.WEBRTC !== 0;
    }
}
Services.WEBSOCKET = 1;
Services.WEBRTC = 2;
