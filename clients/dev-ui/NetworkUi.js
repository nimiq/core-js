class NetworkUi {
    constructor(el, $) {
        this.$el = el;
        this.$ = $;
        
        this.$peerAddress = this.$el.querySelector('[peer-address]');
        this.$peerCount = this.$el.querySelector('[peer-count]');
        this.$peerCountWs = this.$el.querySelector('[peer-count-ws]');
        this.$peerCountRtc = this.$el.querySelector('[peer-count-rtc]');
        this.$bytesReceived = this.$el.querySelector('[bytes-received]');
        this.$bytesSent = this.$el.querySelector('[bytes-sent]');

        $.network.on('peers-changed', () => this._networkChanged());
        setInterval(() => this._networkChanged(), 2500);

        this._networkChanged();
    }
    
    _networkChanged() {
        this.$peerAddress.textContent = this.$.network._networkConfig.peerAddress;
        this.$peerCount.textContent = this.$.network.peerCount;
        this.$peerCountWs.textContent = this.$.network.peerCountWebSocket;
        this.$peerCountRtc.textContent = this.$.network.peerCountWebRtc;
        this.$bytesReceived.textContent = Utils.humanBytes(this.$.network.bytesReceived);
        this.$bytesSent.textContent = Utils.humanBytes(this.$.network.bytesSent);
    }
}
