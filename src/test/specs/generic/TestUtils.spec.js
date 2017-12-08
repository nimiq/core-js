class TestUtils {
    /**
     * Helper method to create an address object from a sequence of nibbles.
     * @param {Array.<number>} nibbles array of 40 nibbles (= 20 bytes)
     * @returns {Address} the resulting address
     */
    static raw2address(nibbles) {
        let address = '';
        for (let i = 0; i < nibbles.length; i++) {
            const rawNibble = nibbles[i];
            address += rawNibble.toString(16);
        }
        return Address.fromHex(address);
    }
}
Class.register(TestUtils);
