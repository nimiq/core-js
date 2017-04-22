class BlockChain {

    constructor(head, totalWork) {
        this._head = head;
        this._totalWork = totalWork;
    }

    push(block) {
        if (block.successorOf(this._currHead)) {
            this._currHead = block;
            this._totalWork += block.difficulty;
        }
        return this._totalWork;
    }

    get head() {
        return this._head;
    }

    get totalWork() {
        return this._totalWork;
    }
}
