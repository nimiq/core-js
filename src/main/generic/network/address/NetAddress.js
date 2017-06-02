class NetAddress {
    static fromIpAddress(ip, port) {
        ip = NetAddress.validatedIpAddress(ip);
        if (!ip) throw 'Malformed IP address';
        return new NetAddress(ip, port);
    }

    static fromHostname(host, port) {
        // TODO reject malformed hosts (ports)
        // TODO do dns resolution, reject invalid hostnames
        return new NetAddress(host, port);
    }

    static validatedIpAddress(ip) {
        ip = NetAddress._normalizeIpAddress(ip);
        if (NetAddress.IP_BLACKLIST.indexOf(ip) < 0) {
            return ip;
        }
        return null;
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
            const match = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
            return `${parseInt(match[1])}.${parseInt(match[2])}.${parseInt(match[3])}.${parseInt(match[4])}`;
        }

        if (NetAddress.isIPv6Address(ip)) {
            // Only use lower-case letters.
            ip = ip.toLowerCase();
            // Split into parts.
            const parts = ip.split(':');
            let longestZeroSequenceStart = -1;
            let longestZeroSequenceLength = 0;
            let currentZeroSequenceStart = -1;
            let currentZeroSequenceLength = 1;
            for (let i = 0; i < parts.length; ++i) {
                // Remove leading zeros from each part, but keep at least one number.
                parts[i] = parts[i].replace(/^0+([a-f0-9])/, '$1');
                // We look for the longest, leftmost consecutive sequence of zero parts.
                if (parts[i] === '0') {
                    // Freshly started sequence.
                    if (currentZeroSequenceStart < 0) {
                        currentZeroSequenceStart = i;
                    } else {
                        // Known sequence, so increment length.
                        currentZeroSequenceLength++;
                    }
                } else {
                    // A sequence just ended, check if it is of better length.
                    if (currentZeroSequenceStart >= 0 && currentZeroSequenceLength > longestZeroSequenceLength) {
                        longestZeroSequenceStart = currentZeroSequenceStart;
                        longestZeroSequenceLength = currentZeroSequenceLength;
                        currentZeroSequenceStart = -1;
                        currentZeroSequenceLength = 1;
                    }
                }
            }
            if (currentZeroSequenceStart >= 0 && currentZeroSequenceLength > longestZeroSequenceLength) {
                longestZeroSequenceStart = currentZeroSequenceStart;
                longestZeroSequenceLength = currentZeroSequenceLength;
            }
            // Remove consecutive zeros.
            if (longestZeroSequenceStart >= 0 && longestZeroSequenceLength > 1) {
                if (longestZeroSequenceLength === parts.length) {
                    return '::';
                } else if (longestZeroSequenceStart === 0 || longestZeroSequenceStart + longestZeroSequenceLength === parts.length) {
                    parts.splice(longestZeroSequenceStart, longestZeroSequenceLength, ':');
                } else {
                    parts.splice(longestZeroSequenceStart, longestZeroSequenceLength, '');
                }
            }
            return parts.join(':');
        }
        return null;
    }

    constructor(host, port) {
        this._host = host;
        this._port = port;
    }

    equals(o) {
        return o instanceof NetAddress
            && this._host === o.host
            && this._port === o.port;
    }

    hashCode() {
        return this.toString();
    }

    toString() {
        return `${this._host}:${this._port}`;
    }

    get host() {
        return this._host;
    }

    get port() {
        return this._port;
    }
}
NetAddress.IP_BLACKLIST = [
    '127.0.0.1',
    '::1'
];
Class.register(NetAddress);
