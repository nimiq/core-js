const fs = require('fs');
const https = require('https');
const btoa = require('btoa');
const Nimiq = require('../../../dist/node.js');

class MetricsServer {
    constructor(sslConfig, port, password) {

        const options = {
            key: fs.readFileSync(sslConfig.key),
            cert: fs.readFileSync(sslConfig.cert)
        };

        https.createServer(options, (req, res) => {
            if (req.url !== '/metrics') {
                res.writeHead(301, {'Location': '/metrics'});
                res.end();
            } else if (password && req.headers.authorization !== `Basic ${btoa(`metrics:${password}`)}`) {
                res.writeHead(401, {'WWW-Authenticate': 'Basic realm="Use username metrics and user-defined password to access metrics." charset="UTF-8"'});
                res.end();
            } else {
                this._metrics(res);
                res.end();
            }
        }).listen(port);

        /** @type {Map.<string, {occurrences: number, timeSpentProcessing: number}>} */
        this._messageMeasures = new Map();
    }

    /**
     * @param {FullChain} blockchain
     * @param {Accounts} accounts
     * @param {Mempool} mempool
     * @param {Network} network
     * @param {Miner} miner
     */
    init(blockchain, accounts, mempool, network, miner) {
        /** @type {FullChain} */
        this._blockchain = blockchain;
        /** @type {Accounts} */
        this._accounts = accounts;
        /** @type {Mempool} */
        this._mempool = mempool;
        /** @type {Network} */
        this._network = network;
        /** @type {Miner} */
        this._miner = miner;

        this._network.on('peer-joined', (peer) => this._onPeerJoined(peer));
    }

    /**
     * @param {Peer} peer
     * @private
     */
    _onPeerJoined(peer) {
        peer.channel.on('message-log', (msg, peerChannel, time, rawSize) => this._measureMessage(msg, time, rawSize));
    }


    /**
     * @param {Message} msg
     * @param {number} time
     * @param {number} size
     * @private
     */
    _measureMessage(msg, time, size) {
        if (!Nimiq.PeerChannel.Event[msg.type]) return;
        const str = Nimiq.PeerChannel.Event[msg.type];
        if (!this._messageMeasures.has(str)) {
            this._messageMeasures.set(str, {occurrences: 0, timeSpentProcessing: 0, totalBytes: 0});
        }
        const obj = this._messageMeasures.get(str);
        obj.occurrences++;
        if (size > 0) obj.totalBytes += size;
        if (time > 0) obj.timeSpentProcessing += time;
    }

    get _desc() {
        return {
            peer: this._network._networkConfig.peerAddress.toString()
        };
    }

    /**
     * @param {object} more
     * @returns {object}
     * @private
     */
    _with(more) {
        const res = this._desc;
        Object.assign(res, more);
        return res;
    }

    _metrics(res) {
        this._chainMetrics(res);
        this._mempoolMetrics(res);
        this._networkMetrics(res);
        this._minerMetrics(res);
    }

    _chainMetrics(res) {
        const head = this._blockchain.head;

        MetricsServer._metric(res, 'chain_head_height', this._desc, head.height);
        MetricsServer._metric(res, 'chain_head_difficulty', this._desc, head.difficulty);
        MetricsServer._metric(res, 'chain_head_transactions', this._desc, head.transactionCount);
        MetricsServer._metric(res, 'chain_total_work', this._desc, this._blockchain.totalWork);

        MetricsServer._metric(res, 'chain_queue_jobs', this._desc, this._blockchain.queue.totalJobs);
        MetricsServer._metric(res, 'chain_queue_elapsed', this._desc, this._blockchain.queue.totalElapsed);
        MetricsServer._metric(res, 'chain_queue_throttles', this._desc, this._blockchain.queue.totalThrottles);
        MetricsServer._metric(res, 'chain_queue_length', this._desc, this._blockchain.queue.length);

        MetricsServer._metric(res, 'chain_block', this._with({'action': 'forked'}), this._blockchain.blockForkedCount);
        MetricsServer._metric(res, 'chain_block', this._with({'action': 'rebranched'}), this._blockchain.blockRebranchedCount);
        MetricsServer._metric(res, 'chain_block', this._with({'action': 'extended'}), this._blockchain.blockExtendedCount);
        MetricsServer._metric(res, 'chain_block', this._with({'action': 'orphan'}), this._blockchain.blockOrphanCount);
        MetricsServer._metric(res, 'chain_block', this._with({'action': 'invalid'}), this._blockchain.blockInvalidCount);
        MetricsServer._metric(res, 'chain_block', this._with({'action': 'known'}), this._blockchain.blockKnownCount);
    }

    _mempoolMetrics(res) {
        const txs = this._mempool.getTransactions();
        const group = [0, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
        for (let i = 1; i < group.length; ++i) {
            MetricsServer._metric(res, 'mempool_transactions', this._with({'fee_per_byte': `<${group[i]}`}), txs.filter((tx) => tx.feePerByte >= group[i - 1] && tx.feePerByte < group[i]).length);
        }
        MetricsServer._metric(res, 'mempool_transactions', this._with({'fee_per_byte': `>=${group[group.length - 1]}`}), txs.filter((tx) => tx.feePerByte >= group[group.length - 1]).length);
        MetricsServer._metric(res, 'mempool_size', this._desc, txs.reduce((a, b) => a + b.serializedSize, 0));

        MetricsServer._metric(res, 'mempool_queue_jobs', this._desc, this._mempool.queue.totalJobs);
        MetricsServer._metric(res, 'mempool_queue_elapsed', this._desc, this._mempool.queue.totalElapsed);
        MetricsServer._metric(res, 'mempool_queue_throttles', this._desc, this._mempool.queue.totalThrottles);
        MetricsServer._metric(res, 'mempool_queue_length', this._desc, this._mempool.queue.length);
    }

    _networkMetrics(res) {
        /** @type {Map.<string, number>} */
        const peers = new Map();
        for (let connection of this._network.connections.values()) {
            let o = {};
            switch (connection.peerAddress ? connection.peerAddress.protocol : -1) {
                case Nimiq.Protocol.DUMB:
                    o.type = 'dumb';
                    break;
                case Nimiq.Protocol.WSS:
                    o.type = 'websocket-secure';
                    break;
                case Nimiq.Protocol.RTC:
                    o.type = 'webrtc';
                    break;
                case Nimiq.Protocol.WS:
                    o.type = 'websocket';
                    break;
                default:
                    o.type = 'unknown';
            }
            switch (connection.state) {
                case Nimiq.PeerConnectionState.NEW:
                    o.state = 'new';
                    break;
                case Nimiq.PeerConnectionState.CONNECTING:
                    o.state = 'connecting';
                    break;
                case Nimiq.PeerConnectionState.CONNECTED:
                    o.state = 'connected';
                    break;
                case Nimiq.PeerConnectionState.NEGOTIATING:
                    o.state = 'negotiating';
                    break;
                case Nimiq.PeerConnectionState.ESTABLISHED:
                    o.state = 'established';
                    break;
                case Nimiq.PeerConnectionState.CLOSED:
                    o.state = 'closed';
            }
            if (connection.peer) {
                o.version = connection.peer.version;
                o.agent = connection.peer.userAgent ? connection.peer.userAgent : undefined;
            }
            const os = JSON.stringify(o);
            if (peers.has(os)) {
                peers.set(os, peers.get(os) + 1);
            } else {
                peers.set(os, 1);
            }
        }
        /** @type {Map.<string, number>} */
        const addresses = new Map();
        for (let address of this._network.addresses.iterator()) {
            let type = 'unknown';
            switch (address.peerAddress.protocol) {
                case Nimiq.Protocol.DUMB:
                    type = 'dumb';
                    break;
                case Nimiq.Protocol.WSS:
                    type = 'websocket-secure';
                    break;
                case Nimiq.Protocol.RTC:
                    type = 'webrtc';
                    break;
                case Nimiq.Protocol.WS:
                    type = 'websocket';
            }
            if (addresses.has(type)) {
                addresses.set(type, addresses.get(type) + 1);
            } else {
                addresses.set(type, 1);
            }
        }

        for (let os of peers.keys()) {
            MetricsServer._metric(res, 'network_peers', this._with(JSON.parse(os)), peers.get(os));
        }
        for (let type of addresses.keys()) {
            MetricsServer._metric(res, 'network_known_addresses', this._with({type: type}), addresses.get(type));
        }
        MetricsServer._metric(res, 'network_time_now', this._desc, this._network.time.now());
        MetricsServer._metric(res, 'network_bytes', this._with({'direction': 'sent'}), this._network.bytesSent);
        MetricsServer._metric(res, 'network_bytes', this._with({'direction': 'received'}), this._network.bytesReceived);
        for(const type of this._messageMeasures.keys()) {
            const obj = this._messageMeasures.get(type);
            MetricsServer._metric(res, 'message_rx_count', this._with({'type': type}), obj.occurrences);
            MetricsServer._metric(res, 'message_rx_processing_time', this._with({'type': type}), obj.timeSpentProcessing);
            MetricsServer._metric(res, 'message_rx_total_bytes', this._with({'type': type}), obj.totalBytes);
        }

    }

    _minerMetrics(res) {
        MetricsServer._metric(res, 'miner_hashrate', this._desc, this._miner.hashrate);
        MetricsServer._metric(res, 'miner_working', this._desc, this._miner.working ? 1 : 0);
        MetricsServer._metric(res, 'miner_blocks_mined', this._desc, this._miner.numBlocksMined);
    }

    /**
     * @param res
     * @param {string} key
     * @param {object} attributes
     * @param {number} value
     * @private
     */
    static _metric(res, key, attributes, value) {
        res.write(`${key}{${Object.keys(attributes).map((a) => `${a}="${attributes[a]}"`).join(',')}} ${value}\n`);
    }
}

module.exports = exports = MetricsServer;
