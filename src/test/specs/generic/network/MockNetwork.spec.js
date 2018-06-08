class MockRTCSessionDescription {
    /**
     * @constructor
     * @param {string} type
     * @param {string} label
     * @param {number} nonce
     */
    constructor(type, label, nonce) {
        this.type = type;
        this.sdp = {
            label: label,
            nonce: nonce
        };
    }
}
class MockRTCIceCandidate {
    /**
     * @constructor
     * @param {number} firstOctet
     * @param {number} secondOctet
     */
    constructor(firstOctet, secondOctet) {
        this.candidate = {
            candidate: `1 1 UDP 2130706431 10.0.${firstOctet}.${secondOctet} 8998 typ host`
        };
    }
}
class MockPhy {
    /**
     * @constructor
     * @param {MockGenericSender} channel
     */
    constructor(channel) {
        this._channel = channel;
    }

    /**
     * @param {Uint8Array} msg
     * @returns {void}
     */
    send(msg) {
        if (Math.random() >= MockNetwork._lossrate) {
            setTimeout(() => this._channel.onmessage(msg), MockNetwork._delay);
        }
    }
}

class MockGenericSender extends Observable {
    /**
     * @constructor
     */
    constructor() {
        super();

        /** @type {MockGenericSender} */
        this._channel = null;
        /** @type {MockPhy} */
        this._phy = null;
        /** @type {boolean} */
        this._closed = false;
    }

    /**
     * @constant
     * @type {boolean}
     */
    get ordered() {
        return true;
    }

    /** @type {DataChannel.ReadyState|string} */
    get readyState() {
        return this._readyState;
    }

    /** @type {?string} */
    get localAddress() {
        return this._localAddress;
    }

    /** @type {boolean} */
    get closed() {
        return this._closed;
    }

    /**
     * @param {MockGenericSender} channel
     * @returns {void}
     */
    link(channel) {
        this._channel = channel;
        this._phy = new MockPhy(channel);
    }

    /**
     * @param {Uint8Array} msg
     * @returns {void}
     */
    send(msg) {
        if (this._closed) return;
        this._phy.send(msg);
    }
}

class MockWebSocket extends MockGenericSender {
    /**
     * @constructor
     * @param {string} [address]
     */
    constructor(address) {
        super();

        // Can be undefined when created through a MockWebSocketServer
        /** @type {string} */
        this._localAddress = address;
        /** @type {DataChannel.ReadyState} */
        this._readyState = DataChannel.ReadyState.CONNECTING;
    }

    /**
     * @param {MockGenericSender} channel
     * @returns {void}
     */
    link(channel) {
        super.link(channel);
        this._socket = channel.localAddress ? { remoteAddress: channel.localAddress } : undefined;
        this._readyState = DataChannel.ReadyState.OPEN;
    }

    /**
     * @returns {void}
     */
    close() {
        if (this._closed) return;
        this._closed = true;

        if (this._readyState === DataChannel.ReadyState.OPEN) {
            setTimeout(() => {
                if (this.onclose) this.onclose();
            }, 0);
            this._channel.close();
        }

        this._readyState = DataChannel.ReadyState.CLOSED;
    }
}
class MockRTCDataChannel extends MockGenericSender {
    /**
     * @constructor
     */
    constructor() {
        super();

        /** @type {string} */
        this._readyState = 'connecting';
    }

    /**
     * @param {MockGenericSender} channel
     * @returns {void}
     */
    link(channel) {
        super.link(channel);
        this._readyState = 'open';
    }

    /**
     * @returns {void}
     */
    close() {
        if (this._closed) return;
        this._closed = true;

        if (this._readyState === 'open') {
            setTimeout(() => {
                if (this.onclose) this.onclose();
            }, 0);
            this._channel.close();
        }

        this._readyState = 'closed';
    }
}

class MockWebSocketServer extends Observable {
    /**
     * @constructor
     */
    constructor() {
        super();
    }

    /** @returns {MockWebSocket} */
    createMockWebSocket() {
        return new MockWebSocket();
    }
}

class MockPeerConnection extends Observable {
    /**
     * @constructor
     */
    constructor() {
        super();
        this._label = null;
        this._nonce = null;
        this._localDescription = null;
        this._remoteDescription = null;
        this._dataChannel = null;
        this._closed = false;
        // TODO: Model behaviour of iceGatheringState.
        this.iceGatheringState = 'complete';
    }

    /**
     * @param {string} label
     * @returns {MockRTCDataChannel}
     */
    createDataChannel(label) {
        this._label = label;
        this._nonce = Math.floor(Math.random() * 65536);
        this._dataChannel = new MockRTCDataChannel();
        return this._dataChannel;
    }

    /**
     * @returns {void}
     */
    close() {
        this._closed = true;
        if (this._dataChannel) {
            this._dataChannel.close();
        }
        MockNetwork._peerConnectionCounter--;
    }

    /**
     * @returns {Promise<MockRTCSessionDescription>}
     */
    createOffer() {
        return Promise.resolve(new MockRTCSessionDescription('offer', this._label, this._nonce));
    }

    /**
     * @returns {Promise<MockRTCSessionDescription>}
     */
    createAnswer() {
        return Promise.resolve(new MockRTCSessionDescription('answer', this._label, this._nonce));
    }

    /**
     * @param {MockRTCSessionDescription} description
     * @returns {Promise}
     */
    setLocalDescription(description) {
        if (this._closed) return Promise.resolve();
        this._localDescription = description;

        if (description.type === 'answer') {
            MockNetwork._peerConnections.set(`${description.sdp.label}-${this._nonce}`, this);
            this.ondatachannel({ channel: this.dataChannel });
        }

        return Promise.resolve();
    }

    /**
     * @param {MockRTCSessionDescription} description
     * @returns {Promise}
     */
    setRemoteDescription(description) {
        if (this._closed) return Promise.resolve();
        this._remoteDescription = description;

        if (description.type === 'offer') {
            this.createDataChannel(description.sdp.label);
        } else if (description.type === 'answer') {
            const peer = MockNetwork._peerConnections.get(`${description.sdp.label}-${description.sdp.nonce}`);
            MockNetwork._peerConnections.set(`${description.sdp.label}-${this._nonce}`, this);
            const [firstOctet, secondOctet] = MockNetwork._nonceToOctets(this._nonce);
            const [peerFirstOctet, peerSecondOctet] = MockNetwork._nonceToOctets(description.sdp.nonce);
            setTimeout(() => {
                this.onicecandidate(new MockRTCIceCandidate(firstOctet, secondOctet));
                peer.onicecandidate(new MockRTCIceCandidate(peerSecondOctet, peerFirstOctet));
                this.onicegatheringstatechange();
                peer.onicegatheringstatechange();
            }, 0);
        }

        return Promise.resolve();
    }

    /**
     * @param {MockRTCIceCandidate} candidate
     * @returns {Promise}
     */
    addIceCandidate(candidate) {
        if (this._closed) return Promise.resolve();

        this._remoteIceCandidate = candidate;
        const peer = MockNetwork._peerConnections.get(`${this._label}-${this.remoteDescription.sdp.nonce}`);

        if (peer.remoteIceCandidate) {
            MockNetwork.webRtcLink(this.dataChannel, peer.dataChannel);
        }

        return Promise.resolve();
    }

    /** @type {MockRTCSessionDescription} */
    get localDescription() {
        return this._localDescription;
    }

    /** @type {MockRTCSessionDescription} */
    get remoteDescription() {
        return this._remoteDescription;
    }

    /** @type {MockRTCIceCandidate} */
    get remoteIceCandidate() {
        return this._remoteIceCandidate;
    }

    /** @type {MockRTCDataChannel} */
    get dataChannel() {
        return this._dataChannel;
    }
}

class MockNetwork {
    /**
     * @static
     * @param {?MockWebSocketServer} server
     * @param {MockWebSocket} client
     * @returns {void}
     */
    static webSocketLink(server, client) {
        if (server) {
            const serverMockWebSocket = server.createMockWebSocket();

            serverMockWebSocket.link(client);
            client.link(serverMockWebSocket);

            setTimeout(() => {
                if (serverMockWebSocket.closed || client.closed) return;
                const request = {
                    connection: {
                        remoteAddress: client.localAddress
                    }
                };
                server.fire('connection', serverMockWebSocket, request);
                client.onopen();
            }, 0);
        } else {
            setTimeout(() => client.onerror(), 0);
        }
    }

    /**
     * @static
     * @param {MockRTCDataChannel} first
     * @param {MockRTCDataChannel} second
     * @returns {void}
     */
    static webRtcLink(first, second) {
        first.link(second);
        second.link(first);

        setTimeout(() => {
            if (first.closed || second.closed) return;
            first.onopen({ channel: first });
            second.onopen({ channel: second });
        }, 0);
    }

    /**
     * @static
     * @private
     * @param {number} nonce
     * @returns {Array.<number>}
     */
    static _nonceToOctets(nonce) {
        const firstOctet = (nonce % 255);
        const secondOctet = ((nonce >> 8) & 0xFF);
        return [firstOctet, secondOctet];
    }

    /**
     * @static
     * @private
     * @param {string} host
     * @returns {string}
     */
    static _hostToIp(host) {
        const crc = CRC32.compute(BufferUtils.fromAscii(host)).toString(16);
        let res = '2001:db8:';
        res += crc.substr(0, 2) + crc.substr(-2, 2);
        res += '::';

        if (crc.length > 4) {
            res += crc.substring(0, crc.length - 4) + ':';
        }
        res += crc.substring(crc.length - 4);
        return res;
    }

    /**
     * @static
     * @param {number} delay delay (in miliseconds) for messages in the network
     * @param {number} lossrate percentage (from 0 to 1) of packets that are never delivered
     * @returns {void}
     */
    static install(delay = 0, lossrate = 0) {
        MockNetwork._peerConnectionCounter = 0;
        MockNetwork._delay = delay;
        MockNetwork._lossrate = lossrate;

        spyOn(WebSocketFactory, 'newWebSocketServer').and.callFake((netconfig) => {
            const peerAddress = netconfig.peerAddress;
            const server = new MockWebSocketServer();
            MockNetwork._servers.set(`wss://${peerAddress.host}:${peerAddress.port}`, server);
            return server;
        });

        spyOn(WebSocketFactory, 'newWebSocket').and.callFake((url, options, netconfig) => {
            const peerAddress = netconfig.peerAddress;
            const seed = peerAddress.protocol === Protocol.WSS ?
                `wss://${peerAddress.host}:${peerAddress.port}` :
                `reserved${MockNetwork._clientSerial++}.test`;
            const address = MockNetwork._hostToIp(seed);

            const client = new MockWebSocket(address);
            const server = MockNetwork._servers.get(url);

            MockNetwork.webSocketLink(server, client);
            return client;
        });

        spyOn(WebRtcFactory, 'newPeerConnection').and.callFake((configuration) => {
            MockNetwork._peerConnectionCounter++;
            return new MockPeerConnection(configuration);
        });

        spyOn(WebRtcFactory, 'newSessionDescription').and.callFake((rtcSessionDescriptionInit) => {
            return rtcSessionDescriptionInit;
        });

        spyOn(WebRtcFactory, 'newIceCandidate').and.callFake((rtcIceCandidateInit) => {
            return rtcIceCandidateInit;
        });
    }

    /**
     * @static
     * @returns {void}
     */
    static uninstall() {
        WebSocketFactory.newWebSocketServer.and.callThrough();
        WebSocketFactory.newWebSocket.and.callThrough();
        WebRtcFactory.newPeerConnection.and.callThrough();
        WebRtcFactory.newSessionDescription.and.callThrough();
        WebRtcFactory.newIceCandidate.and.callThrough();
    }

    /** @type {number} */
    static get delay() {
        return MockNetwork._delay;
    }

    /** @type {number} */
    static set delay(delay) {
        MockNetwork._delay = delay;
    }

    /** @type {number} */
    static get lossrate() {
        return MockNetwork._lossrate;
    }

    /** @type {number} */
    static set lossrate(lossrate) {
        MockNetwork._lossrate = lossrate;
    }
}
/**
 * @type {Map<string, MockWebSocketServer>}
 * @private
 */
MockNetwork._servers = new Map();
/**
 * @type {Map<string, MockPeerConnection>}
 * @private
 */
MockNetwork._peerConnections = new Map();
MockNetwork._peerConnectionCounter = 0;
MockNetwork._delay = 0;
MockNetwork._lossrate = 0;
MockNetwork._clientSerial = 1;
Class.register(MockNetwork);
