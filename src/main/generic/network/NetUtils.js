class NetUtils {
    /**
     * @param {string|Uint8Array} ip
     * @return {boolean}
     */
    static isPrivateIP(ip) {
        if (!(ip instanceof Uint8Array)) {
            ip = NetUtils.ipToBytes(ip);
        }

        if (NetUtils.isLocalIP(ip)) {
            return true;
        }

        if (NetUtils.isIPv4Address(ip)) {
            for (const subnet of NetUtils.IPv4_PRIVATE_NETWORK) {
                if (NetUtils.isIPv4inSubnet(ip, subnet)) {
                    return true;
                }
            }
            return false;
        }

        if (NetUtils.isIPv6Address(ip)) {
            // Private subnet is fc00::/7.
            // So, we only check the first 7 bits of the address to be equal fc00.
            if ((ip[0] & 0xfe) === 0xfc) {
                return true;
            }

            // Link-local addresses are fe80::/10.
            if (ip[0] === 0xfe && (ip[1] & 0xc0) === 0x80) {
                return true;
            }

            // Does not seem to be a private IP.
            return false;
        }

        throw new Error(`Malformed IP address ${ip}`);
    }

    /**
     * @param {string|Uint8Array} ip
     * @returns {boolean}
     */
    static isLocalIP(ip) {
        if (!(ip instanceof Uint8Array)) {
            ip = NetUtils.ipToBytes(ip);
        }

        if (ip.length === NetUtils.IPv4_LENGTH) {
            return ip[0] === 127 && ip[1] === 0 && ip[2] === 0 && ip[3] === 1;
        }
        if (ip.length === NetUtils.IPv6_LENGTH) {
            for (let i = 0; i < NetUtils.IPv6_LENGTH - 1; i++) {
                if (ip[i] !== 0) return false;
            }
            return ip[NetUtils.IPv6_LENGTH - 1] === 1;
        }

        return false;
    }

    /**
     * @param {string|Uint8Array} ip
     * @param {string} subnet
     * @return {boolean}
     */
    static isIPv4inSubnet(ip, subnet) {
        if (!(ip instanceof Uint8Array)) {
            ip = NetUtils.ipToBytes(ip);
        }

        let [subIp, mask] = subnet.split('/');
        mask = -1<<(32-parseInt(mask));
        return (NetUtils._IPv4toLong(ip) & mask) === NetUtils._IPv4toLong(subIp);
    }

    /**
     * @param {string|Uint8Array} ip
     * @return {boolean}
     */
    static isIPv4Address(ip) {
        if (ip instanceof Uint8Array) return ip.length === NetUtils.IPv4_LENGTH;
        const match = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
        return !!match && parseInt(match[1]) <= 255 && parseInt(match[2]) <= 255
            && parseInt(match[3]) <= 255 && parseInt(match[4]) <= 255;
    }

    /**
     * @param {string|Uint8Array} ip
     * @return {boolean}
     */
    static isIPv6Address(ip) {
        if (ip instanceof Uint8Array) return ip.length === NetUtils.IPv6_LENGTH;

        const parts = ip.toLowerCase().split(':');
        // An IPv6 address consists of at most 8 parts and at least 3.
        if (parts.length > 8 || parts.length < 3) {
            return false;
        }

        const isEmbeddedIPv4 = NetUtils.isIPv4Address(parts[parts.length - 1]);

        let innerEmpty = false;
        for (let i = 0; i < parts.length; ++i) {
            // Check whether each part is valid.
            // Note: the last part may be a IPv4 address!
            // They can be embedded in the last part. Remember that they take 32bit.
            if (!(/^[a-f0-9]{0,4}$/.test(parts[i])
                    || (i === parts.length - 1
                        && isEmbeddedIPv4
                        && parts.length < 8))) {
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

        // In the special case of embedded IPv4 addresses, everything but the last 48 bit must be 0.
        if (isEmbeddedIPv4) {
            // Exclude the last two parts.
            for (let i=0; i<parts.length-2; ++i) {
                if (!/^0{0,4}$/.test(parts[i])) {
                    return false;
                }
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

        // If the length is less than 7 and an IPv4 address is embedded, there has to be an empty part.
        if (isEmbeddedIPv4 && parts.length < 7) {
            return innerEmpty;
        }

        // Otherwise if the length is less than 8, there has to be an empty part.
        if (parts.length < 8) {
            return innerEmpty;
        }

        return true;
    }

    /**
     * @param {string} host
     * @returns {boolean}
     */
    static hostGloballyReachable(host) {
        // IP addresses can't have a proper certificate
        if (NetUtils.isIPv4Address(host) || NetUtils.isIPv6Address(host)) {
            return false;
        }
        // "the use of dotless domains is prohibited [in new gTLDs]" [ https://www.icann.org/resources/board-material/resolutions-new-gtld-2013-08-13-en#1 ]. Old gTLDs rarely use them.
        if (!host.match(/.+\..+$/)) {
            return false;
        }
        return true;
    }

    /**
     * @param {string|Uint8Array} ip
     * @return {number}
     */
    static _IPv4toLong(ip) {
        if (!(ip instanceof Uint8Array)) {
            ip = NetUtils.ipToBytes(ip);
        }
        return (ip[0]<<24) + (ip[1]<<16) + (ip[2]<<8) + ip[3];
    }

    /**
     * @param {string} ip
     * @returns {string}
     * @private
     */
    static _IPv4toIPv6(ip) {
        let parts = ip.split('.');
        parts = parts.map(x => parseInt(x));
        const mask = [];
        for(let i = 0; i < 4; i++) {
            mask.push(('00' + parts[i].toString(16)).slice(-2));
        }
        return `${mask[0]}${mask[1]}:${mask[2]}${mask[3]}`;
    }

    /**
     * @param {string} ip
     * @returns {Uint8Array}
     */
    static ipToBytes(ip) {
        if (NetUtils.isIPv4Address(ip)) {
            const parts = ip.split('.');
            return new Uint8Array(parts.map(x => parseInt(x)));
        }

        if (NetUtils.isIPv6Address(ip)) {
            let parts = ip.toLowerCase().split(':');

            // Handle embedded IPv4 addresses.
            if (NetUtils.isIPv4Address(parts[parts.length - 1])) {
                return NetUtils.ipToBytes(parts[parts.length - 1]);
            }

            // IPv6
            parts = NetUtils._extendIPv6(parts);
            parts = parts.map(x => parseInt(x, 16));
            const bytes = [];
            for(let i = 0; i < 8; i++) {
                bytes.push(parts[i] >> 8);
                bytes.push(parts[i] & 0xff);
            }
            return new Uint8Array(bytes);
        }

        throw new Error(`Malformed IP address ${ip}`);
    }

    /**
     * @param {Uint8Array} ip
     * @returns {string}
     */
    static bytesToIp(ip) {
        if (NetUtils.isIPv4Address(ip)) {
            return ip.join('.');
        }

        if (NetUtils.isIPv6Address(ip)) {
            const hexIp = Array.from(ip, x => ('00' + x.toString(16)).slice(-2));
            const ipv6 = [];
            for (let i = 0; i < 8; i++) {
                ipv6.push(hexIp[i*2] + hexIp[i*2+1]);
            }
            return ipv6.join(':');
        }

        throw new Error(`Malformed IP address ${ip}`);
    }

    /**
     * @param {Array.<string>} parts
     * @returns {Array.<string>}
     * @private
     */
    static _extendIPv6(parts) {
        // Handle embedded IPv4 addresses.
        if (NetUtils.isIPv4Address(parts[parts.length - 1])) {
            const ipv4 = parts[parts.length - 1];
            const ipv6 = NetUtils._IPv4toIPv6(ipv4);
            ip = ip.replace(ipv4, ipv6);
            parts = ip.toLowerCase().split(':');
        }

        let emptyPart = parts.indexOf('');
        // If there is an empty part, fill it up.
        if (emptyPart >= 0) {
            parts[emptyPart] = '0';
            for (let i = parts.length; i < 8; i++) {
                parts.splice(emptyPart, 0, '0');
            }
        }
        // Fill remaining empty fields with 0 as well.
        emptyPart = parts.indexOf('');
        while (emptyPart >= 0) {
            parts[emptyPart] = '0';
            emptyPart = parts.indexOf('');
        }

        return parts;
    }

    /**
     * @param {string|Uint8Array} ip
     * @param {number} bitCount
     * @return {string|Uint8Array}
     */
    static ipToSubnet(ip, bitCount) {
        let stringResult = false;
        if (!(ip instanceof Uint8Array)) {
            ip = NetUtils.ipToBytes(ip);
            stringResult = true;
        }

        const mask = [];
        for(let i = 0; i < ip.byteLength; i++) {
            const n = Math.min(bitCount, 8);
            mask.push(ip[i] & (256 - Math.pow(2, 8 - n)));
            bitCount -= n;
        }
        const result = new Uint8Array(mask);
        return stringResult ? NetUtils.bytesToIp(result) : result;
    }
}
NetUtils.IPv4_LENGTH = 4;
NetUtils.IPv6_LENGTH = 16;
NetUtils.IPv4_PRIVATE_NETWORK = [
    '10.0.0.0/8',
    '172.16.0.0/12',
    '192.168.0.0/16',
    '100.64.0.0/10', // link-local

    // Actually, the following one is only an approximation,
    // the first and the last /24 subnets in the range should be excluded.
    '169.254.0.0/16'
];
Class.register(NetUtils);
