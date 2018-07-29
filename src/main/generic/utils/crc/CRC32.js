class CRC32 {
    static _createTable () {
        let b;
        const table = [];

        for (let j = 0; j < 256; ++j) {
            b = j;
            for (let k = 0; k < 8; ++k) {
                b = b & 1 ? CRC32._POLYNOMIAL ^ (b >>> 1) : b >>> 1;
            }
            table[j] = b >>> 0;
        }
        return table;
    }

    /**
     * @param {Uint8Array} buf
     * @return {number}
     */
    static compute(buf) {
        if (!CRC32._table) CRC32._table = CRC32._createTable();
        if (!CRC32._hex_chars) CRC32._hex_chars = '0123456789abcdef'.split('');

        const message = new Uint8Array(buf);
        const initialValue = -1;

        let crc = initialValue;
        let hex = '';

        for (let i = 0; i < message.length; ++i) {
            crc = CRC32._table[(crc ^ message[i]) & 0xFF] ^ (crc >>> 8);
        }
        crc ^= initialValue;

        hex += CRC32._hex_chars[(crc >> 28) & 0x0F] + CRC32._hex_chars[(crc >> 24) & 0x0F] +
            CRC32._hex_chars[(crc >> 20) & 0x0F] + CRC32._hex_chars[(crc >> 16) & 0x0F] +
            CRC32._hex_chars[(crc >> 12) & 0x0F] + CRC32._hex_chars[(crc >> 8) & 0x0F] +
            CRC32._hex_chars[(crc >> 4) & 0x0F] + CRC32._hex_chars[crc & 0x0F];

        return parseInt(hex, 16);
    }
}
CRC32._table = null;
CRC32._hex_chars = null;
CRC32._POLYNOMIAL = 0xEDB88320;
Class.register(CRC32);
