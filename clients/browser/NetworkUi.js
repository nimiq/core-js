class NetworkUi {
    constructor(el, $) {
        this.$el = el;
        this.$ = $;
        
        this.$peerAddress = this.$el.querySelector('[peer-address]');
        this.$peerCount = this.$el.querySelector('[peer-count]');
        this.$peerCountWs = this.$el.querySelector('[peer-count-ws]');
        this.$peerCountWss = this.$el.querySelector('[peer-count-wss]');
        this.$peerCountRtc = this.$el.querySelector('[peer-count-rtc]');
        this.$bytesReceived = this.$el.querySelector('[bytes-received]');
        this.$bytesSent = this.$el.querySelector('[bytes-sent]');

        $.client.network.getOwnAddress().then(address => {
            this.$peerAddress.textContent = address.peerAddress.toString();
        });
        // TODO: Listen for live updates of peer data once supported by client API
        setInterval(() => this._networkChanged(), 2500);

        this._networkChanged();
    }
    
    _networkChanged() {
        this.$.client.network.getStatistics().then(/** @type {Client.NetworkStatistics} */ stats => {
            this.$peerCount.textContent = stats.totalPeerCount;
            this.$peerCountWs.textContent = stats.peerCountsByType['ws'];
            this.$peerCountWss.textContent = stats.peerCountsByType['wss'];
            this.$peerCountRtc.textContent = stats.peerCountsByType['rtc'];
            this.$bytesReceived.textContent = Utils.humanBytes(stats.bytesReceived);
            this.$bytesSent.textContent = Utils.humanBytes(stats.bytesSent);
        });
    }
}
