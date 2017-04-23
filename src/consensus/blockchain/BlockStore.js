class BlockStore {
    static getPersistent() {
        return new PersistentBlockStore();
    }

    static createVolatile() {
        // TODO
        throw 'VolatileBlockStore not implemented';
    }
}

class PersistentBlockStore extends ObjectDB {
    constructor() {
        super('blocks', Block);
    }
}
