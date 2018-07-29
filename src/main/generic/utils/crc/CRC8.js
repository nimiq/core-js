class CRC8 {

    // Adapted from https://github.com/mode80/crc8js
    // FIXME: Split into _createTable() and compute()
    static compute(byte_array) {
        // Create a lookup table byte array
        var table = []; // 256 max len byte array
        for (var i = 0; i < 256; ++i) {
            var curr = i;
            for (var j = 0; j < 8; ++j) {
                if ((curr & 0x80) !== 0) {
                    curr = ((curr << 1) ^ 0x97) % 256; // Polynomial C2 by Baicheva98
                } else {
                    curr = (curr << 1) % 256;
                }
            }
            table[i] = curr;
        }

        // Calculate the 8-bit checksum given an array of byte-sized numbers
        var c = 0;
        for (var i = 0; i < byte_array.length; i++) {
            c = table[(c ^ byte_array[i]) % 256];
        }
        return c;
    }
}
Class.register(CRC8);
