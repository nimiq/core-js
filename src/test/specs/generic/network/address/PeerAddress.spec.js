describe('PeerAddress', () => {
    it('can be parsed from string', () => {
        const addrStr1 = 'ws://foobar.com:8080/';
        const addr1 = WsBasePeerAddress.fromSeedString(addrStr1);
        expect(addr1.protocol).toBe(Protocol.WS);
        expect(addr1.host).toBe('foobar.com');
        expect(addr1.port).toBe(8080);
        expect(addr1.publicKey).toBe(null);
        expect(addr1.peerId).toBe(null);
        expect(addr1.isSeed()).toBe(true);

        const addrStr2 = 'wss://bla.blub.fo-o.com:8443/abe25666ee12a71bda501239f230c760c84ee50eef0a3e567897e8d5307c0b4e';
        const addr2 = WsBasePeerAddress.fromSeedString(addrStr2);
        expect(addr2.protocol).toBe(Protocol.WSS);
        expect(addr2.host).toBe('bla.blub.fo-o.com');
        expect(addr2.port).toBe(8443);
        expect(addr2.publicKey.toHex()).toBe('abe25666ee12a71bda501239f230c760c84ee50eef0a3e567897e8d5307c0b4e');
        expect(addr2.peerId.toHex()).toBe('6a1620934660d4384c8572c1e751d892');
        expect(addr2.isSeed()).toBe(true);

        const addrStr3 = 'wss://bla.blub.fo-o.com:443';
        const addr3 = WsBasePeerAddress.fromSeedString(addrStr3);
        expect(addr3.protocol).toBe(Protocol.WSS);
        expect(addr3.host).toBe('bla.blub.fo-o.com');
        expect(addr3.port).toBe(443);
        expect(addr3.publicKey).toBe(null);
        expect(addr3.peerId).toBe(null);
        expect(addr3.isSeed()).toBe(true);

        const addrStr4 = 'ws://localhost.localdomain:12345/abe25666ee12a71bda501239f230c760c84ee50eef0a3e567897e8d5307c0b4e';
        const addr4 = WsBasePeerAddress.fromSeedString(addrStr4);
        expect(addr4.protocol).toBe(Protocol.WS);
        expect(addr4.host).toBe('localhost.localdomain');
        expect(addr4.port).toBe(12345);
        expect(addr2.publicKey.toHex()).toBe('abe25666ee12a71bda501239f230c760c84ee50eef0a3e567897e8d5307c0b4e');
        expect(addr2.peerId.toHex()).toBe('6a1620934660d4384c8572c1e751d892');
        expect(addr4.isSeed()).toBe(true);
    });

    it('rejects invalid PeerAddresses', () => {
        const addrStr1 = 'https://foobar.com:8443/';
        expect(() => WsBasePeerAddress.fromSeedString(addrStr1)).toThrowError(`Malformed PeerAddress ${addrStr1}`);

        const addrStr2 = 'wss://foobar.com/';
        expect(() => WsBasePeerAddress.fromSeedString(addrStr2)).toThrowError(`Malformed PeerAddress ${addrStr2}`);

        const addrStr3 = 'ws://:8080';
        expect(() => WsBasePeerAddress.fromSeedString(addrStr3)).toThrowError(`Malformed PeerAddress ${addrStr3}`);

        const addrStr4 = 'wss://foobar.com:8443/abc098';
        expect(() => WsBasePeerAddress.fromSeedString(addrStr4)).toThrowError(`Malformed PeerAddress ${addrStr4}`);

        const addrStr5 = 'wss://foobar.com:8443/abXX5666ee12a71bda501239f230c760c84ee50eef0a3e567897e8d5307c0b4e';
        expect(() => WsBasePeerAddress.fromSeedString(addrStr5)).toThrowError(`Malformed PeerAddress ${addrStr5}`);

        const addrStr6 = 'abcde';
        expect(() => WsBasePeerAddress.fromSeedString(addrStr6)).toThrowError(`Malformed PeerAddress ${addrStr6}`);

        const addrStr7 = '';
        expect(() => WsBasePeerAddress.fromSeedString(addrStr7)).toThrowError(`Malformed PeerAddress ${addrStr7}`);
    });
});
