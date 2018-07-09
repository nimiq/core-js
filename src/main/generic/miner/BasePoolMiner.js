/**
 * @abstract
 */
class BasePoolMiner extends Miner {
    /**
     * @param {BasePoolMiner.Mode} mode
     * @param {BaseChain} blockchain
     * @param {Accounts} accounts
     * @param {Mempool} mempool
     * @param {Time} time
     * @param {Address} address
     * @param {number} deviceId
     * @param {object|null} deviceData
     * @param {Uint8Array} [extraData=new Uint8Array(0)]
     */
    constructor(mode, blockchain, accounts, mempool, time, address, deviceId, deviceData, extraData = new Uint8Array(0)) {
        super(blockchain, accounts, mempool, time, address, extraData);

        /** @type {Address} */
        this._ourAddress = address;

        /** @type {Uint8Array} */
        this._ourExtraData = extraData;

        /** @type {WebSocket} */
        this._ws = null;

        /** @type {number} */
        this._deviceId = deviceId;

        /** @type {object} */
        this._deviceData = deviceData;

        /** @type {BasePoolMiner.Mode} */
        this.mode = mode;

        /** @type {BasePoolMiner.ConnectionState} */
        this.connectionState = BasePoolMiner.ConnectionState.CLOSED;

        this._reconnectTimeout = null;
        this._exponentialBackoffReconnect = BasePoolMiner.RECONNECT_TIMEOUT;
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
        this._ws.onmessage = (msg) => this._onMessage(ws, JSON.parse(msg.data));
        this._ws.onclose = (e) => this._onClose(ws, e);

        this._changeConnectionState(BasePoolMiner.ConnectionState.CONNECTING);
    }

    _onOpen(ws) {
        if (ws !== this._ws) {
            ws.close();
        } else {
            this._register();
        }
    }

    _register() {
        this._send({
            message: 'register',
            mode: this.mode,
            address: this._ourAddress.toUserFriendlyAddress(),
            deviceId: this._deviceId,
            deviceData: this._deviceData,
            genesisHash: BufferUtils.toBase64(GenesisConfig.GENESIS_HASH.serialize())
        });
    }

    _onError(ws, e) {
        Log.d(BasePoolMiner, 'WebSocket connection errored', e.message || e);
        if (ws === this._ws) {
            this._timeoutReconnect();
        }
        try {
            ws.close();
        } catch (e2) {
            Log.w(BasePoolMiner, e2.message || e2);
        }
    }

    _onClose(ws, e) {
        Log.d(BasePoolMiner, 'WebSocket connection closed', e.message || e);
        if (ws === this._ws) {
            this._changeConnectionState(BasePoolMiner.ConnectionState.CLOSED);
            Log.w(BasePoolMiner, 'Disconnected from pool');
            this._timeoutReconnect();
        }
    }

    _timeoutReconnect() {
        this.disconnect();
        this._reconnectTimeout = setTimeout(() => {
            this.connect(this._host, this._port);
        }, this._exponentialBackoffReconnect);
        this._exponentialBackoffReconnect = Math.min(this._exponentialBackoffReconnect * 2, BasePoolMiner.RECONNECT_TIMEOUT_MAX);
    }

    disconnect() {
        this._turnPoolOff();
        if (this._ws) {
            this._changeConnectionState(BasePoolMiner.ConnectionState.CLOSED);
            Log.w(BasePoolMiner, 'Disconnected from pool');

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

    _onMessage(ws, msg) {
        if (ws !== this._ws) return;
        if (msg && msg.message) {
            switch (msg.message) {
                case 'settings':
                    if (!msg.address || !msg.extraData) {
                        this._turnPoolOff();
                        this._ws.close();
                    } else {
                        this._onNewPoolSettings(Address.fromUserFriendlyAddress(msg.address), BufferUtils.fromBase64(msg.extraData), msg.targetCompact || BlockUtils.targetToCompact(new BigNumber(msg.target)), msg.nonce);
                        Log.d(BasePoolMiner, `Received settings from pool: address ${msg.address}, target ${msg.target}, extraData ${msg.extraData}`);
                    }
                    break;
                case 'balance':
                    if (msg.balance === undefined || msg.confirmedBalance === undefined) {
                        this._turnPoolOff();
                        this._ws.close();
                    } else {
                        this._onBalance(msg.balance, msg.confirmedBalance, msg.payoutRequestActive);
                        Log.d(BasePoolMiner, `Received balance from pool: ${msg.balance} (${msg.confirmedBalance} confirmed), payout request active: ${msg.payoutRequestActive}`);
                    }
                    break;
                case 'registered':
                    this._changeConnectionState(BasePoolMiner.ConnectionState.CONNECTED);
                    this._exponentialBackoffReconnect = BasePoolMiner.RECONNECT_TIMEOUT;
                    Log.i(BasePoolMiner, 'Connected to pool');
                    break;
                case 'error':
                    Log.w(BasePoolMiner, 'Error from pool:', msg.reason);
                    break;
            }
        } else {
            Log.w(BasePoolMiner, 'Received unknown message from pool server:', JSON.stringify(msg));
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
        const oldBalance = this.balance, oldConfirmedBalance = this.confirmedBalance;
        this.balance = balance;
        this.confirmedBalance = confirmedBalance;
        this.payoutRequestActive = payoutRequestActive;
        if (balance !== oldBalance || confirmedBalance !== oldConfirmedBalance) {
            Log.i(BasePoolMiner, `Pool balance: ${Policy.satoshisToCoins(balance)} NIM (confirmed ${Policy.satoshisToCoins(confirmedBalance)} NIM)`);
        }
        if (balance !== oldBalance) {
            this.fire('balance', balance);
        }
        if (confirmedBalance !== oldConfirmedBalance) {
            this.fire('confirmed-balance', confirmedBalance);
        }
    }

    _turnPoolOff() {
        super.address = this._ourAddress;
        super.extraData = this._ourExtraData;
        super.shareCompact = null;
    }

    /**
     * @param {Address} address
     * @param {Uint8Array} extraData
     * @param {number} targetCompact
     * @param {number} nonce
     * @private
     */
    _onNewPoolSettings(address, extraData, targetCompact, nonce) {
        super.address = address;
        super.extraData = extraData;
        super.shareCompact = targetCompact;
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
BasePoolMiner.RECONNECT_TIMEOUT = 3000; // 3 seconds
BasePoolMiner.RECONNECT_TIMEOUT_MAX = 30000; // 30 seconds

/** @enum {number} */
BasePoolMiner.ConnectionState = {
    CONNECTED: 0,
    CONNECTING: 1,
    CLOSED: 2
};

/** @enum {string} */
BasePoolMiner.Mode = {
    NANO: 'nano',
    SMART: 'smart'
};

Class.register(BasePoolMiner);
