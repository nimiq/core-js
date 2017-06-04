describe('NetAddress', () => {
    const invalid1v4 = '0.0.0.0';
    const invalid2v4 = '127.0.0.1';
    const invalid3v4 = '127.0.000.1';
    const invalid4v4 = '127.0.00000000.1';
    const invalid5v4 = '0000127.0.00000000.00000001';
    const invalid6v4 = '-1.2.3.4';
    const invalid7v4 = '256.0.2.1';
    const invalid8v4 = '1.2.a.4';
    const invalid9v4 = '1.2.3';
    const invalid10v4 = '1.2.3.';
    const invalid11v4 = '1.2.3.5.';
    const invalid12v4 = '1.2.3..5';
    const invalid13v4 = '255.255.255.255';
    const invalid14v4 = '1.2.3.4.5';

    it('rejects invalid IPv4 addresses', () => {
        expect(() => {
            NetAddress.fromIpAddress(invalid1v4, 443);
        }).toThrow('Malformed IP address');
        expect(() => {
            NetAddress.fromIpAddress(invalid2v4, 443);
        }).toThrow('Malformed IP address');
        expect(() => {
            NetAddress.fromIpAddress(invalid3v4, 443);
        }).toThrow('Malformed IP address');
        expect(() => {
            NetAddress.fromIpAddress(invalid4v4, 443);
        }).toThrow('Malformed IP address');
        expect(() => {
            NetAddress.fromIpAddress(invalid5v4, 443);
        }).toThrow('Malformed IP address');
        expect(() => {
            NetAddress.fromIpAddress(invalid6v4, 443);
        }).toThrow('Malformed IP address');
        expect(() => {
            NetAddress.fromIpAddress(invalid7v4, 443);
        }).toThrow('Malformed IP address');
        expect(() => {
            NetAddress.fromIpAddress(invalid8v4, 443);
        }).toThrow('Malformed IP address');
        expect(() => {
            NetAddress.fromIpAddress(invalid9v4, 443);
        }).toThrow('Malformed IP address');
        expect(() => {
            NetAddress.fromIpAddress(invalid10v4, 443);
        }).toThrow('Malformed IP address');
        expect(() => {
            NetAddress.fromIpAddress(invalid11v4, 443);
        }).toThrow('Malformed IP address');
        expect(() => {
            NetAddress.fromIpAddress(invalid12v4, 443);
        }).toThrow('Malformed IP address');
        expect(() => {
            NetAddress.fromIpAddress(invalid13v4, 443);
        }).toThrow('Malformed IP address');
        expect(() => {
            NetAddress.fromIpAddress(invalid14v4, 443);
        }).toThrow('Malformed IP address');
    });


    const invalid1v6 = '::';
    const invalid2v6 = '::1';
    const invalid3v6 = 'a:x:1';
    const invalid4v6 = 'test';
    const invalid5v6 = '1:2:3:4:5:6:7:8:9';
    const invalid6v6 = '1:2:3:4:5:6:7:8:1.2.3.4';
    const invalid7v6 = '1::1.2.3.4';
    const invalid8v6 = '1:2:3:4:5:6:1.2.3.4';
    // TODO broadcast addresses

    it('rejects invalid IPv6 addresses', () => {
        expect(() => {
            NetAddress.fromIpAddress(invalid1v6, 443);
        }).toThrow('Malformed IP address');
        expect(() => {
            NetAddress.fromIpAddress(invalid2v6, 443);
        }).toThrow('Malformed IP address');
        expect(() => {
            NetAddress.fromIpAddress(invalid3v6, 443);
        }).toThrow('Malformed IP address');
        expect(() => {
            NetAddress.fromIpAddress(invalid4v6, 443);
        }).toThrow('Malformed IP address');
        expect(() => {
            NetAddress.fromIpAddress(invalid5v6, 443);
        }).toThrow('Malformed IP address');
        expect(() => {
            NetAddress.fromIpAddress(invalid6v6, 443);
        }).toThrow('Malformed IP address');
        expect(() => {
            NetAddress.fromIpAddress(invalid7v6, 443);
        }).toThrow('Malformed IP address');
        expect(() => {
            NetAddress.fromIpAddress(invalid8v6, 443);
        }).toThrow('Malformed IP address');
    });


    const valid1v4 = '8.8.8.8';

    it('rejects invalid ports', () => {
        expect(() => {
            NetAddress.fromIpAddress(valid1v4, 80000);
        }).toThrow('Malformed port');
        expect(() => {
            NetAddress.fromIpAddress(valid1v4, -1);
        }).toThrow('Malformed port');
        expect(() => {
            NetAddress.fromIpAddress(valid1v4, 0);
        }).toThrow('Malformed port');
    });


    const long1v4 = '08.008.8.000008';
    const short1v4 = '8.8.8.8';

    it('canonicalizes IPv4 addresses', () => {
        expect(NetAddress.fromIpAddress(long1v4, 443).host).toEqual(short1v4);
    });


    const long1v6 = '2001:db8:0:0:0:0:2:1';
    const short1v6 = '2001:db8::2:1';
    const long2v6 = '2001:db8:0000:1:1:1:1:1';
    const short2v6 = '2001:db8:0:1:1:1:1:1';
    const long3v6 = '2001:db8:0:0:1:0:0:1';
    const short3v6 = '2001:db8::1:0:0:1';
    const long4v6 = '2001:0db8::0001';
    const short4v6 = '2001:db8::1';
    const long5v6 = '0:0::0:2:1';
    const short5v6 = '::2:1';
    const long6v6 = '1:0:0:4:5::8';
    const short6v6 = '1::4:5:0:0:8';
    const long7v6 = `::${long1v4}`;
    const short7v6 = `::${short1v4}`;
    const long8v6 = '1:0:0:4:5::8';
    const short8v6 = '1::4:5:0:0:8';
    const long9v6 = '0:0:0::0:1.2.3.4';
    const short9v6 = '::1.2.3.4';
    const long10v6 = '0:0:0::4:1.2.3.4';
    const short10v6 = '::4:1.2.3.4';

    it('canonicalizes IPv6 addresses', () => {
        expect(NetAddress.fromIpAddress(long1v6, 443).host).toEqual(short1v6);
        expect(NetAddress.fromIpAddress(long2v6, 443).host).toEqual(short2v6);
        expect(NetAddress.fromIpAddress(long3v6, 443).host).toEqual(short3v6);
        expect(NetAddress.fromIpAddress(long4v6, 443).host).toEqual(short4v6);
        expect(NetAddress.fromIpAddress(long5v6, 443).host).toEqual(short5v6);
        expect(NetAddress.fromIpAddress(long6v6, 443).host).toEqual(short6v6);
        expect(NetAddress.fromIpAddress(long7v6, 443).host).toEqual(short7v6);
        expect(NetAddress.fromIpAddress(long8v6, 443).host).toEqual(short8v6);
        expect(NetAddress.fromIpAddress(long9v6, 443).host).toEqual(short9v6);
        expect(NetAddress.fromIpAddress(long10v6, 443).host).toEqual(short10v6);
    });


    const uppercase1v6 = '2001:DB8::1';
    const lowercase1v6 = '2001:db8::1';

    it('lowercases IPv6 addresses', () => {
        expect(NetAddress.fromIpAddress(uppercase1v6, 443).host).toEqual(lowercase1v6);
    });

    it('can identify IPv4 subnets', () => {
        expect(NetAddress.IPv4inSubnet('192.168.2.1', '192.168.0.0/16')).toEqual(true);
        expect(NetAddress.IPv4inSubnet('172.16.0.0', '172.16.0.0/12')).toEqual(true);
        expect(NetAddress.IPv4inSubnet('172.32.0.0', '172.16.0.0/12')).toEqual(false);
        expect(NetAddress.IPv4inSubnet('172.31.0.0', '172.16.0.0/12')).toEqual(true);
        expect(NetAddress.IPv4inSubnet('172.31.255.255', '172.16.0.0/12')).toEqual(true);
        expect(NetAddress.IPv4inSubnet('172.15.255.255', '172.16.0.0/12')).toEqual(false);
    });

    it('can identify private IP addresses', () => {
        expect(NetAddress.isPrivateIP('192.168.2.1')).toEqual(true);
        expect(NetAddress.isPrivateIP('::123:192.168.2.1')).toEqual(true);
        expect(NetAddress.isPrivateIP('100.168.2.1')).toEqual(false);
        expect(NetAddress.isPrivateIP('172.16.0.0')).toEqual(true);
        expect(NetAddress.isPrivateIP('172.32.0.0')).toEqual(false);
        expect(NetAddress.isPrivateIP('172.31.0.0')).toEqual(true);
        expect(NetAddress.isPrivateIP('172.31.255.255')).toEqual(true);
        expect(NetAddress.isPrivateIP('172.15.255.255')).toEqual(false);
        expect(NetAddress.isPrivateIP('100.64.0.0')).toEqual(true);
        expect(NetAddress.isPrivateIP('169.254.0.0')).toEqual(true);

        expect(NetAddress.isPrivateIP('fd12:3456:789a:1::1')).toEqual(true);
        expect(NetAddress.isPrivateIP('fd12:3456:789a:1::1')).toEqual(true);
        expect(NetAddress.isPrivateIP('fe80:3456:789a:1::1')).toEqual(true);
        expect(NetAddress.isPrivateIP('fbff:3456:789a:1::1')).toEqual(false);
        expect(NetAddress.isPrivateIP('fd00:3456:789a:1::1')).toEqual(true);
        expect(NetAddress.isPrivateIP('fe00:3456:789a:1::1')).toEqual(false);
        expect(NetAddress.isPrivateIP('ff02:3456:789a:1::1')).toEqual(false);
    });
});
