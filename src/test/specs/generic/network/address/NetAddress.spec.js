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

    it('rejects invalid IPv4 addresses', () => {
        expect(() => {
            NetAddress.fromIpAddress(invalid1v4);
        }).toThrow('Malformed IP address');
        expect(() => {
            NetAddress.fromIpAddress(invalid2v4);
        }).toThrow('Malformed IP address');
        expect(() => {
            NetAddress.fromIpAddress(invalid3v4);
        }).toThrow('Malformed IP address');
        expect(() => {
            NetAddress.fromIpAddress(invalid4v4);
        }).toThrow('Malformed IP address');
        expect(() => {
            NetAddress.fromIpAddress(invalid5v4);
        }).toThrow('Malformed IP address');
        expect(() => {
            NetAddress.fromIpAddress(invalid6v4);
        }).toThrow('Malformed IP address');
        expect(() => {
            NetAddress.fromIpAddress(invalid7v4);
        }).toThrow('Malformed IP address');
        expect(() => {
            NetAddress.fromIpAddress(invalid8v4);
        }).toThrow('Malformed IP address');
        expect(() => {
            NetAddress.fromIpAddress(invalid9v4);
        }).toThrow('Malformed IP address');
        expect(() => {
            NetAddress.fromIpAddress(invalid10v4);
        }).toThrow('Malformed IP address');
        expect(() => {
            NetAddress.fromIpAddress(invalid11v4);
        }).toThrow('Malformed IP address');
        expect(() => {
            NetAddress.fromIpAddress(invalid12v4);
        }).toThrow('Malformed IP address');
        expect(() => {
            NetAddress.fromIpAddress(invalid13v4);
        }).toThrow('Malformed IP address');
    });


    const invalid1v6 = '::';
    const invalid2v6 = '::1';
    const invalid3v6 = 'a:x:1';
    const invalid4v6 = 'test';
    // TODO broadcast addresses

    it('rejects invalid IPv6 addresses', () => {
        expect(() => {
            NetAddress.fromIpAddress(invalid1v6);
        }).toThrow('Malformed IP address');
        expect(() => {
            NetAddress.fromIpAddress(invalid2v6);
        }).toThrow('Malformed IP address');
        expect(() => {
            NetAddress.fromIpAddress(invalid3v6);
        }).toThrow('Malformed IP address');
        expect(() => {
            NetAddress.fromIpAddress(invalid4v6);
        }).toThrow('Malformed IP address');
    });


    const long1v4 = '08.008.8.000008';
    const short1v4 = '8.8.8.8';

    it('canonicalizes IPv4 addresses', () => {
        expect(NetAddress.fromIpAddress(long1v4).host).toEqual(short1v4);
    });


    const long1v6 = '2001:db8:0:0:0:0:2:1';
    const short1v6 = '2001:db8::2:1';
    const long2v6 = '2001:db8:0000:1:1:1:1:1';
    const short2v6 = '2001:db8:0:1:1:1:1:1';
    const long3v6 = '2001:db8:0:0:1:0:0:1';
    const short3v6 = '2001:db8::1:0:0:1';
    const long4v6 = '2001:0db8::0001';
    const short4v6 = '2001:db8::1';

    it('canonicalizes IPv6 addresses', () => {
        expect(NetAddress.fromIpAddress(long1v6).host).toEqual(short1v6);
        expect(NetAddress.fromIpAddress(long2v6).host).toEqual(short2v6);
        expect(NetAddress.fromIpAddress(long3v6).host).toEqual(short3v6);
        expect(NetAddress.fromIpAddress(long4v6).host).toEqual(short4v6);
    });


    const uppercase1v6 = '2001:DB8::1';
    const lowercase1v6 = '2001:db8::1';

    it('lowercases IPv6 addresses', () => {
        expect(NetAddress.fromIpAddress(uppercase1v6).host).toEqual(lowercase1v6);
    });
});
