describe('NetAddress', () => {
    const invalid6v4 = '-1.2.3.4';
    const invalid7v4 = '256.0.2.1';
    const invalid8v4 = '1.2.a.4';
    const invalid9v4 = '1.2.3';
    const invalid10v4 = '1.2.3.';
    const invalid11v4 = '1.2.3.5.';
    const invalid12v4 = '1.2.3..5';
    const invalid14v4 = '1.2.3.4.5';

    it('rejects invalid IPv4 addresses', () => {
        expect(() => {
            NetAddress.fromIP(invalid6v4);
        }).toThrowError(`Malformed IP address ${invalid6v4}`);
        expect(() => {
            NetAddress.fromIP(invalid7v4);
        }).toThrowError(`Malformed IP address ${invalid7v4}`);
        expect(() => {
            NetAddress.fromIP(invalid8v4);
        }).toThrowError(`Malformed IP address ${invalid8v4}`);
        expect(() => {
            NetAddress.fromIP(invalid9v4);
        }).toThrowError(`Malformed IP address ${invalid9v4}`);
        expect(() => {
            NetAddress.fromIP(invalid10v4);
        }).toThrowError(`Malformed IP address ${invalid10v4}`);
        expect(() => {
            NetAddress.fromIP(invalid11v4);
        }).toThrowError(`Malformed IP address ${invalid11v4}`);
        expect(() => {
            NetAddress.fromIP(invalid12v4);
        }).toThrowError(`Malformed IP address ${invalid12v4}`);
        expect(() => {
            NetAddress.fromIP(invalid14v4);
        }).toThrowError(`Malformed IP address ${invalid14v4}`);
    });

    const invalid2v6 = 'a:x:1';
    const invalid3v6 = 'test';
    const invalid4v6 = '1:2:3:4:5:6:7:8:9';
    const invalid5v6 = '1:2:3:4:5:6:7:8:1.2.3.4';
    const invalid6v6 = '1::1.2.3.4';
    const invalid7v6 = '1:2:3:4:5:6:1.2.3.4';
    // TODO broadcast addresses

    it('rejects invalid IPv6 addresses', () => {
        expect(() => {
            NetAddress.fromIP(invalid2v6);
        }).toThrowError(`Malformed IP address ${invalid2v6}`);
        expect(() => {
            NetAddress.fromIP(invalid3v6);
        }).toThrowError(`Malformed IP address ${invalid3v6}`);
        expect(() => {
            NetAddress.fromIP(invalid4v6);
        }).toThrowError(`Malformed IP address ${invalid4v6}`);
        expect(() => {
            NetAddress.fromIP(invalid5v6);
        }).toThrowError(`Malformed IP address ${invalid5v6}`);
        expect(() => {
            NetAddress.fromIP(invalid6v6);
        }).toThrowError(`Malformed IP address ${invalid6v6}`);
        expect(() => {
            NetAddress.fromIP(invalid7v6);
        }).toThrowError(`Malformed IP address ${invalid7v6}`);
    });

    const long1v4 = '08.008.8.000008';
    const short1v4 = '8.8.8.8';

    it('canonicalizes IPv4 addresses', () => {
        expect(NetAddress.fromIP(long1v4).toString()).toEqual(short1v4);
    });


    const long1v6 = '2001:db8:0:0:0:0:2:1';
    const short1v6 = '2001:0db8:0000:0000:0000:0000:0002:0001';
    const long2v6 = '2001:db8:0000:1:1:1:1:1';
    const short2v6 = '2001:0db8:0000:0001:0001:0001:0001:0001';
    const long3v6 = '2001:db8:0:0:1:0:0:1';
    const short3v6 = '2001:0db8:0000:0000:0001:0000:0000:0001';
    const long4v6 = '2001:0db8::0001';
    const short4v6 = '2001:0db8:0000:0000:0000:0000:0000:0001';
    const long5v6 = '0:0::0:2:1';
    const short5v6 = '0000:0000:0000:0000:0000:0000:0002:0001';
    const long6v6 = '1:0:0:4:5::8';
    const short6v6 = '0001:0000:0000:0004:0005:0000:0000:0008';
    const long7v6 = '::08.008.8.000008';
    const short7v6 = '8.8.8.8';
    const long8v6 = '1:0:0:4:5::8';
    const short8v6 = '0001:0000:0000:0004:0005:0000:0000:0008';
    const long9v6 = '0:0:0::0:1.2.3.4';
    const short9v6 = '1.2.3.4';
    const long10v6 = '0:0:0::4:1.2.3.4';
    const short10v6 = '1.2.3.4';

    it('canonicalizes IPv6 addresses', () => {
        expect(NetAddress.fromIP(long1v6).toString()).toEqual(short1v6);
        expect(NetAddress.fromIP(long2v6).toString()).toEqual(short2v6);
        expect(NetAddress.fromIP(long3v6).toString()).toEqual(short3v6);
        expect(NetAddress.fromIP(long4v6).toString()).toEqual(short4v6);
        expect(NetAddress.fromIP(long5v6).toString()).toEqual(short5v6);
        expect(NetAddress.fromIP(long6v6).toString()).toEqual(short6v6);
        expect(NetAddress.fromIP(long7v6).toString()).toEqual(short7v6);
        expect(NetAddress.fromIP(long8v6).toString()).toEqual(short8v6);
        expect(NetAddress.fromIP(long9v6).toString()).toEqual(short9v6);
        expect(NetAddress.fromIP(long10v6).toString()).toEqual(short10v6);
    });


    const uppercase1v6 = '2001:DB8::1';
    const lowercase1v6 = '2001:0db8:0000:0000:0000:0000:0000:0001';

    it('lowercases IPv6 addresses', () => {
        expect(NetAddress.fromIP(uppercase1v6).toString()).toEqual(lowercase1v6);
    });
});
