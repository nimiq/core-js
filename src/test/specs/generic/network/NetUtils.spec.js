describe('NetUtils', () => {
    const local1v4 = '127.0.0.1';
    const local2v4 = '127.0.000.1';
    const local3v4 = '127.0.00000000.1';
    const local4v4 = '0000127.0.00000000.00000001';
    it('can identify local IPv4 addresses', () => {
        expect(NetUtils.isLocalIP(local1v4)).toEqual(true);
        expect(NetUtils.isLocalIP(local2v4)).toEqual(true);
        expect(NetUtils.isLocalIP(local3v4)).toEqual(true);
        expect(NetUtils.isLocalIP(local4v4)).toEqual(true);
    });

    const local1v6 = '::1';
    it('can identify local IPv6 addresses', () => {
        expect(NetUtils.isLocalIP(local1v6)).toEqual(true);
    });

    it('can identify IPv4 subnets', () => {
        expect(NetUtils.isIPv4inSubnet('192.168.2.1', '192.168.0.0/16')).toEqual(true);
        expect(NetUtils.isIPv4inSubnet('172.16.0.0', '172.16.0.0/12')).toEqual(true);
        expect(NetUtils.isIPv4inSubnet('172.32.0.0', '172.16.0.0/12')).toEqual(false);
        expect(NetUtils.isIPv4inSubnet('172.31.0.0', '172.16.0.0/12')).toEqual(true);
        expect(NetUtils.isIPv4inSubnet('172.31.255.255', '172.16.0.0/12')).toEqual(true);
        expect(NetUtils.isIPv4inSubnet('172.15.255.255', '172.16.0.0/12')).toEqual(false);
    });

    it('can identify private IP addresses', () => {
        expect(NetUtils.isPrivateIP('192.168.2.1')).toEqual(true);
        expect(NetUtils.isPrivateIP('::123:192.168.2.1')).toEqual(true);
        expect(NetUtils.isPrivateIP('100.168.2.1')).toEqual(false);
        expect(NetUtils.isPrivateIP('172.16.0.0')).toEqual(true);
        expect(NetUtils.isPrivateIP('172.32.0.0')).toEqual(false);
        expect(NetUtils.isPrivateIP('172.31.0.0')).toEqual(true);
        expect(NetUtils.isPrivateIP('172.31.255.255')).toEqual(true);
        expect(NetUtils.isPrivateIP('172.15.255.255')).toEqual(false);
        expect(NetUtils.isPrivateIP('100.64.0.0')).toEqual(true);
        expect(NetUtils.isPrivateIP('169.254.0.0')).toEqual(true);

        expect(NetUtils.isPrivateIP('fd12:3456:789a:1::1')).toEqual(true);
        expect(NetUtils.isPrivateIP('fd12:3456:789a:1::1')).toEqual(true);
        expect(NetUtils.isPrivateIP('fe80:3456:789a:1::1')).toEqual(true);
        expect(NetUtils.isPrivateIP('fbff:3456:789a:1::1')).toEqual(false);
        expect(NetUtils.isPrivateIP('fd00:3456:789a:1::1')).toEqual(true);
        expect(NetUtils.isPrivateIP('fe00:3456:789a:1::1')).toEqual(false);
        expect(NetUtils.isPrivateIP('ff02:3456:789a:1::1')).toEqual(false);
    });

    it('rejects invalid private IP addresses', () => {
        expect(() => NetUtils.isPrivateIP('not-an-ip')).toThrow('Malformed IP address not-an-ip');
    });

    it('rejects non-globally-connectable WS', () => {
        expect(NetUtils.hostGloballyReachable('localhost')).toEqual(false);
        expect(NetUtils.hostGloballyReachable('someRandomHostname')).toEqual(false);
        expect(NetUtils.hostGloballyReachable('.com')).toEqual(false);
        expect(NetUtils.hostGloballyReachable('host.')).toEqual(false);
        expect(NetUtils.hostGloballyReachable('127.0.0.1')).toEqual(false);
        expect(NetUtils.hostGloballyReachable('8.8.8.8')).toEqual(false);
    });

    it('accepts valid hostnames', () => {
        expect(NetUtils.hostGloballyReachable('dev.nimiq-network.com')).toEqual(true);
        expect(NetUtils.hostGloballyReachable('example.com')).toEqual(true);
    });
});
