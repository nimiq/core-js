class Utils {
    static getAccount($, address) {
        if ($.clientType !== DevUI.CLIENT_NANO) {
            return $.accounts.get(address);
        } else {
            return $.consensus.getAccount(address);
        }
    }

    static broadcastTransaction($, tx) {
        if ($.clientType !== DevUI.CLIENT_NANO) {
            return $.mempool.pushTransaction(tx);
        } else {
            return $.consensus.relayTransaction(tx);
        }
    }

    static humanBytes(bytes) {
        var i = 0;
        var units = ['B', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        while (bytes > 1024) {
            bytes /= 1024;
            i++;
        }
        return (Number.isInteger(bytes) ? bytes : bytes.toFixed(2)) + ' ' + units[i];
    }

    static satoshisToCoins(value) {
        return Nimiq.Policy.satoshisToCoins(value).toFixed(Math.log10(Nimiq.Policy.SATOSHIS_PER_COIN));
    }

    static hash(data, algorithm) {
        switch (algorithm) {
            case Nimiq.Hash.Algorithm.BLAKE2B: return Nimiq.Crypto.blake2bSync(data);
            case Nimiq.Hash.Algorithm.SHA256: return Nimiq.Crypto.sha256(data);
            // case Nimiq.Hash.Algorithm.ARGON2D intentionally omitted
            default: throw new Error('Invalid hash algorithm');
        }
    }

    static readAddress(input) {
        try {
            const address =  Nimiq.Address.fromUserFriendlyAddress(input.value);
            input.classList.remove('error');
            return address;
        } catch (e) {
            input.classList.add('error');
            return null;
        }
    }

    static readNumber(input) {
        const value = parseFloat(input.value);
        if (isNaN(value)) {
            input.classList.add('error');
            return null;
        } else {
            input.classList.remove('error');
            return value;
        }
    }

    static readBase64(input) {
        try {
            const buffer = Nimiq.BufferUtils.fromBase64(input.value);
            input.classList.remove('error');
            return buffer;
        } catch(e) {
            input.classList.add('error');
            return null;
        }
    }
}
