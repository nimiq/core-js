class NetAddress {
    static fromIpAddress(ip) {
        const saneIp = NetAddress.sanitizeIpAddress(ip);
        return new NetAddress(saneIp);
    }

    static fromHostname(host) {
        // TODO reject malformed hosts (ports)
        // TODO do dns resolution, reject invalid hostnames
        return new NetAddress(host);
    }

    static sanitizeIpAddress(ip) {
        const saneIp = NetAddress._normalizeIpAddress(ip);
        if (NetAddress.IP_BLACKLIST.indexOf(saneIp) >= 0) {
            throw 'Malformed IP address';
        }
        // TODO reject IPv6 broadcast addresses
        return saneIp;
    }

    static isIpAddress(ip) {
        return NetAddress.isIPv4Address(ip) || NetAddress.isIPv6Address(ip);
    }

    static isIPv4Address(ip) {
        const match = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
        return !!match && parseInt(match[1]) <= 255 && parseInt(match[2]) <= 255
            && parseInt(match[3]) <= 255 && parseInt(match[4]) <= 255;
    }

    static isIPv6Address(ip) {
        const parts = ip.toLowerCase().split(':');
        // An IPv6 address consists of at most 8 parts and at least 3.
        if (parts.length > 8 || parts.length < 3) {
            return false;
        }

        let innerEmpty = false;
        for (let i = 0; i < parts.length; ++i) {
            // Check whether each part is valid.
            if (!/^[a-f0-9]{0,4}$/.test(parts[i])) {
                return false;
            }
            // Inside the parts, there has to be at most one empty part.
            if (parts[i].length === 0 && i > 0 && i < parts.length - 1) {
                if (innerEmpty) {
                    return false; // at least two empty parts
                }
                innerEmpty = true;
            }
        }

        // If the first part is empty, the second has to be empty as well (e.g., ::1).
        if (parts[0].length === 0) {
            return parts[1].length === 0;
        }

        // If the last part is empty, the second last has to be empty as well (e.g., 1::).
        if (parts[parts.length - 1].length === 0) {
            return parts[parts.length - 2].length === 0;
        }

        // If the length is less than 8, there has to be an empty part.
        if (parts.length < 8) {
            return innerEmpty;
        }

        return true;
    }

    static _normalizeIpAddress(ip) {
        if (NetAddress.isIPv4Address(ip)) {
            // Re-create IP address to strip possible leading zeros.
            const match = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
            return `${parseInt(match[1])}.${parseInt(match[2])}.${parseInt(match[3])}.${parseInt(match[4])}`;
        }

        if (NetAddress.isIPv6Address(ip)) {
            // Shorten IPv6 address according to RFC 5952.

            // Only use lower-case letters.
            ip = ip.toLowerCase();

            // Split into parts.
            const parts = ip.split(':');
            let maxZeroSeqStart = -1;
            let maxZeroSeqLength = 0;
            let curZeroSeqStart = -1;
            let curZeroSeqLength = 1;
            for (let i = 0; i < parts.length; ++i) {
                // Remove leading zeros from each part, but keep at least one number.
                parts[i] = parts[i].replace(/^0+([a-f0-9])/, '$1');

                // We look for the longest, leftmost consecutive sequence of zero parts.
                if (parts[i] === '0') {
                    // Freshly started sequence.
                    if (curZeroSeqStart < 0) {
                        curZeroSeqStart = i;
                    } else {
                        // Known sequence, so increment length.
                        curZeroSeqLength++;
                    }
                } else {
                    // A sequence just ended, check if it is of better length.
                    if (curZeroSeqStart >= 0 && curZeroSeqLength > maxZeroSeqLength) {
                        maxZeroSeqStart = curZeroSeqStart;
                        maxZeroSeqLength = curZeroSeqLength;
                        curZeroSeqStart = -1;
                        curZeroSeqLength = 1;
                    }
                }
            }

            if (curZeroSeqStart >= 0 && curZeroSeqLength > maxZeroSeqLength) {
                maxZeroSeqStart = curZeroSeqStart;
                maxZeroSeqLength = curZeroSeqLength;
            }

            // Remove consecutive zeros.
            if (maxZeroSeqStart >= 0 && maxZeroSeqLength > 1) {
                if (maxZeroSeqLength === parts.length) {
                    return '::';
                } else if (maxZeroSeqStart === 0 || maxZeroSeqStart + maxZeroSeqLength === parts.length) {
                    parts.splice(maxZeroSeqStart, maxZeroSeqLength, ':');
                } else {
                    parts.splice(maxZeroSeqStart, maxZeroSeqLength, '');
                }
            }
            return parts.join(':');
        }

        throw 'Malformed IP address';
    }

    constructor(host) {
        this._host = host;
    }

    static unserialize(buf) {
        const host = buf.readVarLengthString();

        // Don't fail on empty NetAddresses.
        if (!host || !host.length) {
            return NetAddress.UNSPECIFIED;
        }

        // NetAddresses sent on the wire must be valid IPs.
        // TODO actually validate the IP as soon as we accept all valid IPs.
        //if (!NetAddress.isIpAddress(host)) throw 'Malformed IP address';

        return new NetAddress(host);
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.writeVarLengthString(this._host);
        return buf;
    }

    get serializedSize() {
        return /*extraByte VarLengthString host*/ 1
            + /*host*/ this._host.length;
    }

    equals(o) {
        return o instanceof NetAddress
            && this._host === o.host;
    }

    hashCode() {
        return this.toString();
    }

    toString() {
        return `${this._host}`;
    }

    get host() {
        return this._host;
    }
}
NetAddress.IP_BLACKLIST = [
    '0.0.0.0',
    '127.0.0.1',
    '255.255.255.255',
    '::',
    '::1'
];
NetAddress.UNSPECIFIED = new NetAddress('');
Class.register(NetAddress);
