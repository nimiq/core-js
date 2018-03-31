class PoolClient extends Observable {
    /**
     * @param {Miner} miner
     * @param {Address} address
     * @param {number} [deviceId]
     */
    constructor(miner, address, deviceId) {
        super();

        /** @type {Miner} */
        this._miner = miner;
        this._miner.on('share', (block) => this._onBlockMined(block));

        /** @type {Address} */
        this._address = address;

        /** @type {WebSocket} */
        this._ws = null;

        this._deviceId = deviceId;
    }

    _send(msg) {
        if (this._ws) {
            this._ws.send(JSON.stringify(msg));
        }
    }

    connect(server, port) {
        if (this._ws) throw new Error('Call disconnect() first');
        this._server = server;
        this._port = port;
        const ws = this._ws = new WebSocket(`${server}:${port}`);
        this._ws.onopen = () => this._onOpen(ws);
        this._ws.onerror = (e) => this._onError(ws, e);
        this._ws.onmessage = (msg) => this._onMessage(JSON.parse(msg.data));
        this._ws.onclose = () => this._onClose(ws);
    }

    _onOpen(ws) {
        if (ws !== this._ws) {
            ws.close();
        } else {
            // Register
            this._send({
                message: 'register',
                mode: 'smart',
                address: this._address.toUserFriendlyAddress(),
                deviceId: this._deviceId
            });
        }
    }

    _onError(ws, e) {
        Log.w(PoolClient, e.message || e);
        if (ws === this._ws) {
            this._timeoutReconnect();
        }
        try {
            ws.close();
        } catch (e2) {
            Log.w(PoolClient, e2.message || e2);
        }
    }

    _onClose(ws) {
        if (ws === this._ws) {
            this._timeoutReconnect();
        }
    }

    _timeoutReconnect() {
        this.disconnect();
        setTimeout(() => {
            this.connect(this._server, this._port);
        }, 30000); // after 30 sec
    }

    disconnect() {
        this._turnPoolOff();
        if (this._ws) {
            try {
                this._ws.close();
            } catch (e2) {
                Log.w(PoolClient, e2.message || e2);
            }
            this._ws = null;
        }
    }

    _onMessage(msg) {
        if (msg && msg.message) {
            switch (msg.message) {
                case 'settings':
                    if (!msg.address || !msg.extraData) {
                        this._turnPoolOff();
                        this._ws.close();
                    } else {
                        this._onNewPoolSettings(Address.fromUserFriendlyAddress(msg.address), BufferUtils.fromBase64(msg.extraData), msg.target);
                    }
                    break;
                case 'balance':
                    if (!msg.balance) {
                        this._turnPoolOff();
                        this._ws.close();
                    } else {
                        this._onBalance(msg.balance);
                    }
                    break;
                case 'invalid-share':
                    Log.w(PoolClient, 'Pool denied share: ', msg.reason);
                    break;
            }
        } else {
            this._ws.close();
        }
    }

    /**
     * @param {Block} block
     * @private
     */
    async _onBlockMined(block) {
        this._send({
            message: 'share',
            blockHeader: BufferUtils.toBase64(block.header.serialize()),
            minerAddrProof: BufferUtils.toBase64((await MerklePath.compute(block.body.getMerkleLeafs(), block.minerAddr)).serialize()),
            extraDataProof: BufferUtils.toBase64((await MerklePath.compute(block.body.getMerkleLeafs(), block.body.extraData)).serialize())
        });
    }

    /**
     * @param {number} poolBalance
     * @private
     */
    _onBalance(poolBalance) {
        this.fire('pool-balance', poolBalance);
    }

    _turnPoolOff() {
        this._miner.address = this._address;
        this._miner.extraData = new Uint8Array(0);
        this._miner.shareTarget = null;
    }

    /**
     * @param {Address} address
     * @param {Uint8Array} extraData
     * @param {number} target
     * @private
     */
    _onNewPoolSettings(address, extraData, target) {
        this._miner.address = address;
        this._miner.extraData = extraData;
        this._miner.shareTarget = target;
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

Class.register(PoolClient);
