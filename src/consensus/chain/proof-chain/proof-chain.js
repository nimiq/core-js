class ProofChain{

  constructor(headHeader, totalWork) {
    this._currHead = headHeader || {id: Buffer.fromBase64('ABlo+sKsuWY1iwv9vZ/EQufEyzTlrDX79+E7HZo0OQg=')};
    this._totalWork = totalWork || 10;
  }

  push(nextHead) {
    if (nextHead.successorOf(this._currHead)) {
      this._currHead = nextHead;
      this._totalWork += nextHead.difficulty;
      this.timestamp = nextHead.timestamp;
    }
  }

  get currHead() {
    return this._currHead;
  }

  get totalWork() {
    return this._totalWork;
  }

  get prevId() {
    return this.currHead.prevHash;
  }
}
