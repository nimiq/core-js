/**
 * @interface
 */
class IBlockchain extends Observable {
    /**
     * @abstract
     * @type {Block}
     */
    get head() {}

    /**
     * @abstract
     * @type {Hash}
     */
    get headHash() {}

    /**
     * @abstract
     * @type {number}
     */
    get height() {}
}
Class.register(IBlockchain);
