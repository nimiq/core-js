class SeedList {
    /**
     * @param {string} url
     * @param {PublicKey} [publicKey]
     * @returns {Promise.<SeedList>}
     */
    static async retrieve(url, publicKey) {
        return SeedList.parse(await HttpRequest.get(url, SeedList.REQUEST_TIMEOUT, SeedList.MAX_SIZE), publicKey);
    }

    /**
     * @param {string} listStr
     * @param {PublicKey} [publicKey]
     * @returns {SeedList}
     * @private
     */
    static parse(listStr, publicKey) {
        const seeds = [];

        // Filter empty and comment lines.
        const lines = listStr
            .split('\n')
            .filter(line => line.length > 0 && !line.startsWith('#'));

        // Read seed addresses. Ignore the last line here.
        for (let i = 0; i < lines.length - 1; i++) {
            const line = lines[i];
            try {
                seeds.push(WsBasePeerAddress.fromSeedString(line.trim()));
            } catch (e) {
                Log.w(SeedList, `Ignoring malformed seed address ${line}`);
            }
        }

        // Try to parse the last line as a signature.
        const lastLine = lines[lines.length - 1];
        let signature = null;
        try {
            signature = new Signature(BufferUtils.fromHex(lastLine.trim()));
        } catch (e) {
            // ignore
        }

        // If the last line doesn't parse as a signature, try to parse it as a PeerAddress.
        if (!signature) {
            try {
                seeds.push(WsBasePeerAddress.fromSeedString(lastLine.trim()));
            } catch (e) {
                Log.w(SeedList, `Ignoring malformed signature/seed address ${lastLine}`);
            }
        }

        // If we don't have a public key, skip the signature check.
        if (!publicKey) {
            return new SeedList(seeds, null, signature);
        }

        // We have a public key, but no signature. Fail.
        if (!signature) {
            throw new Error('Missing signature');
        }

        // Verify signature.
        const data = SeedList._serializeSeeds(seeds);
        if (!signature.verify(publicKey, data)) {
            throw new Error('Invalid signature');
        }

        // Signature ok.
        return new SeedList(seeds, publicKey, signature);
    }

    /**
     * @param {Array.<PeerAddress>} seeds
     * @returns {Uint8Array}
     */
    static _serializeSeeds(seeds) {
        return BufferUtils.fromAscii(seeds.map(seed => seed.toSeedString()).join('\n'));
    }

    /**
     * @param {Array.<PeerAddress>} seeds
     * @param {PublicKey} [publicKey]
     * @param {Signature} [signature]
     */
    constructor(seeds, publicKey, signature) {
        this._seeds = seeds;
        this._publicKey = publicKey;
        this._signature = signature;
    }

    /**
     * @returns {Uint8Array}
     */
    serializeContent() {
        return SeedList._serializeSeeds(this._seeds);
    }

    /**
     * @type {Array.<PeerAddress>}
     */
    get seeds() {
        return this._seeds;
    }

    /**
     * @type {PublicKey}
     */
    get publicKey() {
        return this._publicKey;
    }

    /**
     * @type {Signature}
     */
    get signature() {
        return this._signature;
    }
}
SeedList.MAX_SIZE = 1024 * 128; // 128 kb
SeedList.REQUEST_TIMEOUT = 8000; // 8 seconds
Class.register(SeedList);

class SeedListUrl {
    /**
     * @param {string} url
     * @param {string} [publicKeyHex]
     */
    constructor(url, publicKeyHex) {
        this._url = url;
        this._publicKey = publicKeyHex ? new PublicKey(BufferUtils.fromHex(publicKeyHex)) : null;
    }

    /**
     * @type {string}
     */
    get url() {
        return this._url;
    }

    /**
     * @returns {PublicKey}
     */
    get publicKey() {
        return this._publicKey;
    }
}
Class.register(SeedListUrl);
