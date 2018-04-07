/**
 * @abstract
 */
class BasePoolMiner extends Miner {
    /**
     * @param {BaseChain} blockchain
     * @param {Accounts} accounts
     * @param {Mempool} mempool
     * @param {Time} time
     * @param {Address} address
     * @param {number} deviceId
     * @param {Uint8Array} [extraData=new Uint8Array(0)]
     */
    constructor(blockchain, accounts, mempool, time, address, deviceId, extraData = new Uint8Array(0)) {
        super(blockchain, accounts, mempool, time, address, extraData);

        /** @type {Address} */
        this._ourAddress = address;

        /** @type {Uint8Array} */
        this._ourExtraData = extraData;

        /** @type {WebSocket} */
        this._ws = null;

        /** @type {number} */
        this._deviceId = deviceId;

        /** @type {BasePoolMiner.ConnectionState} */
        this.connectionState = BasePoolMiner.ConnectionState.CLOSED;

        this._reconnectTimeout = null;
    }

    requestPayout() {
        this._send({
            message: 'payout',
        });
    }

    _send(msg) {
        if (this._ws) {
            try {
                this._ws.send(JSON.stringify(msg));
            } catch (e) {
                Log.w(BasePoolMiner, 'Error sending:', e.message || e);
            }
        }
    }

    connect(host, port) {
        if (this._ws) throw new Error('Call disconnect() first');
        this._host = host;
        this._port = port;
        const ws = this._ws = new WebSocket(`wss://${host}:${port}`);
        this._ws.onopen = () => this._onOpen(ws);
        this._ws.onerror = (e) => this._onError(ws, e);
        this._ws.onmessage = (msg) => this._onMessage(JSON.parse(msg.data));
        this._ws.onclose = () => this._onClose(ws);

        this._changeConnectionState(BasePoolMiner.ConnectionState.CONNECTING);
    }

    _onOpen(ws) {
        if (ws !== this._ws) {
            ws.close();
        } else {
            this._register();
        }
    }

    /**
     * @abstract
     */
    _register() {
    }

    _onError(ws, e) {
        Log.w(BasePoolMiner, e.message || e);
        if (ws === this._ws) {
            this._timeoutReconnect();
        }
        try {
            ws.close();
        } catch (e2) {
            Log.w(BasePoolMiner, e2.message || e2);
        }
    }

    _onClose(ws) {
        this._changeConnectionState(BasePoolMiner.ConnectionState.CLOSED);
        if (ws === this._ws) {
            this._timeoutReconnect();
        }
    }

    _timeoutReconnect() {
        this.disconnect();
        this._reconnectTimeout = setTimeout(() => {
            this.connect(this._host, this._port);
        }, 30000); // after 30 sec
    }

    disconnect() {
        this._turnPoolOff();
        if (this._ws) {
            const ws = this._ws;
            this._ws = null;
            try {
                ws.close();
            } catch (e) {
                Log.w(BasePoolMiner, e.message || e);
            }
        }
        clearTimeout(this._reconnectTimeout);
    }

    _onMessage(msg) {
        if (msg && msg.message) {
            switch (msg.message) {
                case 'settings':
                    if (!msg.address || !msg.extraData) {
                        this._turnPoolOff();
                        this._ws.close();
                    } else {
                        this._onNewPoolSettings(Address.fromUserFriendlyAddress(msg.address), BufferUtils.fromBase64(msg.extraData), msg.target, msg.nonce);
                    }
                    break;
                case 'balance':
                    if (msg.balance === undefined || msg.confirmedBalance === undefined) {
                        this._turnPoolOff();
                        this._ws.close();
                    } else {
                        this._onBalance(msg.balance, msg.confirmedBalance, msg.payoutRequestActive);
                    }
                    break;
                case 'registered':
                    this._changeConnectionState(BasePoolMiner.ConnectionState.CONNECTED);
                    break;
                case 'error':
                    Log.w(BasePoolMiner, 'Error from pool:', msg.reason);
                    break;
            }
        } else {
            Log.w(BasePoolMiner, 'Received unknown message from pool server:', msg.message);
            this._ws.close();
        }
    }

    /**
     * @param {number} balance
     * @param {number} confirmedBalance
     * @param {boolean} payoutRequestActive
     * @private
     */
    _onBalance(balance, confirmedBalance, payoutRequestActive) {
        this.payoutRequestActive = payoutRequestActive;
        if (this.balance !== balance || this.confirmedBalance !== confirmedBalance) {
            Log.i(BasePoolMiner, `Pool balance: ${Policy.satoshisToCoins(balance)} NIM (confirmed ${Policy.satoshisToCoins(confirmedBalance)} NIM)`);
        }
        if (this.balance !== balance) {
            this.fire('balance', balance);
        }
        if (this.confirmedBalance !== confirmedBalance) {
            this.fire('confirmed-balance', confirmedBalance);
        }
        this.balance = balance;
        this.confirmedBalance = confirmedBalance;
    }

    _turnPoolOff() {
        super.address = this._ourAddress;
        super.extraData = this._ourExtraData;
        super.shareTarget = null;
    }

    /**
     * @param {Address} address
     * @param {Uint8Array} extraData
     * @param {number} target
     * @param {number} nonce
     * @private
     */
    _onNewPoolSettings(address, extraData, target, nonce) {
        super.address = address;
        super.extraData = extraData;
        super.shareTarget = target;
        super.nonce = nonce;
    }

    _changeConnectionState(connectionState) {
        this.connectionState = connectionState;
        this.fire('connection-state', connectionState);
    }

    /**
     * @returns {boolean}
     */
    isConnected() {
        return this.connectionState === BasePoolMiner.ConnectionState.CONNECTED;
    }

    /**
     * @type {Address}
     * @override
     */
    get address() {
        return this._ourAddress;
    }

    /**
     * @type {Address}
     * @override
     */
    set address(address) {
        this._ourAddress = address;
        if (this.isConnected()) {
            this.disconnect();
            this.connect(this._host, this._port);
        } else {
            super.address = address;
        }
    }

    /**
     * @param {NetworkConfig} networkConfig
     * @returns {number}
     */
    static generateDeviceId(networkConfig) {
        return Hash.blake2b([
            BufferUtils.fromAscii('pool_device_id'),
            networkConfig.keyPair.privateKey.serialize()
        ].reduce(BufferUtils.concatTypedArrays)).serialize().readUint32();
    }
}
BasePoolMiner.PAYOUT_NONCE_PREFIX = 'POOL_PAYOUT';

/** @enum {number} */
BasePoolMiner.ConnectionState = {
    CONNECTED: 0,
    CONNECTING: 1,
    CLOSED: 2
};

Class.register(BasePoolMiner);
