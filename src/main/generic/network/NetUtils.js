class NetUtils {
    /**
     * @param {string} ip
     * @return {boolean}
     */
    static isPrivateIP(ip) {
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
            const parts = ip.toLowerCase().split(':');
            const isEmbeddedIPv4 = NetUtils.isIPv4Address(parts[parts.length - 1]);
            if (isEmbeddedIPv4) {
                return NetUtils.isPrivateIP(parts[parts.length - 1]);
            }

            // Private subnet is fc00::/7.
            // So, we only check the first 7 bits of the address to be equal fc00.
            // The mask shifts by 16-7=9 bits (one part - mask size).
            if ((parseInt(parts[0], 16) & (-1<<9)) === 0xfc00) {
                return true;
            }

            // Link-local addresses are fe80::/10.
            // Shifting has to be carried out by 16-10=6 bits.
            if ((parseInt(parts[0], 16) & (-1<<6)) === 0xfe80) {
                return true;
            }

            // Does not seem to be a private IP.
            return false;
        }

        throw `Malformed IP address ${ip}`;
    }

    /**
     * @param {string} ip
     * @returns {boolean}
     */
    static isLocalIP(ip) {
        const saneIp = NetUtils._normalizeIP(ip);
        if (NetUtils.isIPv4Address(ip)) {
            return saneIp === '127.0.0.1';
        } else {
            return saneIp === '::1';
        }
    }

    /**
     * @param {string} ip
     * @param {string} subnet
     * @return {boolean}
     */
    static isIPv4inSubnet(ip, subnet) {
        let [subIp, mask] = subnet.split('/');
        mask = -1<<(32-parseInt(mask));
        return (NetUtils._IPv4toLong(ip) & mask) === NetUtils._IPv4toLong(subIp);
    }

    /**
     * @param {string} ip
     * @return {boolean}
     */
    static isIPv4Address(ip) {
        const match = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
        return !!match && parseInt(match[1]) <= 255 && parseInt(match[2]) <= 255
            && parseInt(match[3]) <= 255 && parseInt(match[4]) <= 255;
    }

    /**
     * @param {string} ip
     * @return {boolean}
     */
    static isIPv6Address(ip) {
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
     * @param {string} ip
     * @return {string}
     */
    static sanitizeIP(ip) {
        const saneIp = NetUtils._normalizeIP(ip);
        // FIXME
        if (NetUtils.IP_BLACKLIST.indexOf(saneIp) >= 0) {
            throw `Malformed IP address ${ip}`;
        }
        // TODO reject IPv6 broadcast addresses
        return saneIp;
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
     * @param {string} ip
     * @return {string}
     */
    static _normalizeIP(ip) {
        if (NetUtils.isIPv4Address(ip)) {
            // Re-create IPv4 address to strip possible leading zeros.
            // Embed into IPv6 format.
            const match = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
            return `${parseInt(match[1])}.${parseInt(match[2])}.${parseInt(match[3])}.${parseInt(match[4])}`;
        }

        if (NetUtils.isIPv6Address(ip)) {
            // Shorten IPv6 address according to RFC 5952.

            // Only use lower-case letters.
            ip = ip.toLowerCase();

            // Split into parts.
            const parts = ip.split(':');

            // Return normalized IPv4 address if embedded.
            if (NetUtils.isIPv4Address(parts[parts.length - 1])) {
                return NetUtils._normalizeIP(parts[parts.length - 1]);
            }

            // If it is already shortened at one point, blow it up again.
            // It may be the case, that the current shortening is not as described in the RFC.
            const emptyIndex = parts.indexOf('');
            if (emptyIndex >= 0) {
                parts[emptyIndex] = '0';
                // Also check parts before and after emptyIndex and fill them up if necessary.
                if (emptyIndex > 0 && parts[emptyIndex-1] === '') {
                    parts[emptyIndex-1] = '0';
                }
                if (emptyIndex < parts.length - 1 && parts[emptyIndex+1] === '') {
                    parts[emptyIndex+1] = '0';
                }

                // Add 0s until we have a normal IPv6 length.
                const necessaryAddition = 8-parts.length;
                for (let i=0; i<necessaryAddition; ++i) {
                    parts.splice(emptyIndex, 0, '0');
                }
            }

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

        throw `Malformed IP address ${ip}`;
    }

    /**
     * @param {string} ip
     * @return {number}
     */
    static _IPv4toLong(ip) {
        const match = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
        return (parseInt(match[1])<<24) + (parseInt(match[2])<<16) + (parseInt(match[3])<<8) + (parseInt(match[4]));
    }
}
NetUtils.IP_BLACKLIST = [
    '0.0.0.0',
    '255.255.255.255',
    '::',
];
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
