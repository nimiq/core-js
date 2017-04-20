class BlockChain{

  constructor(head, totalWork) {
    this._currHead = head || {header: {id: Buffer.fromBase64('ABlo+sKsuWY1iwv9vZ/EQufEyzTlrDX79+E7HZo0OQg=')}};
    this._totalWork = totalWork || 10;
  }

  push(block) {
    if (block.successorOf(this._currHead)) {
      this._currHead = block;
      this._totalWork += block.difficulty;
    }
    return this._totalWork;
  }

  get currHead() {
    return this._currHead;
  }

  get totalWork() {
    return this._totalWork;
  }

  get prevId() {
    return this._currHead.header.prevHash;
  }
}
