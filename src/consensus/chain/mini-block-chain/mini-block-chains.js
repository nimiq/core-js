class MiniBlockChains extends ProofChains{

  constructor(p2pDB) {
    super();
  }

  push(block) {
    super.push(block.header);
  }

  async _createFork(block) {
    console.log('Fork BlockChain...');
    const prevTotalWork = this.maxChain.totalWork - this.maxChain.currHead.difficulty;	// Define here to prevent race condition
    const prevHead = await this._p2pDB.blocks.get(this.maxChain.prevId);
    if (block.successorOf(prevHead)) {
      this._chains.push(new BlockChain(block,prevTotalWork + block.difficulty));
    } else {
      block.header.log('Invalid Block');
    }
  }

  async _rebranch(newHead) {
    console.log('Rebranch BlockChain...');
    let oldHead = this.currHead;
    let newBranch = [newHead];
    while (!oldHead.successorOf(newBranch[0])) {
      await this._p2pDB.accounts.revertBlock(oldHead);
      oldHead = await this._p2pDB.blocks.get(newBranch[0].header.prevHash);
      newBranch.unshift(oldHead);
    }
    for (let block of newBranch) {
      await this._p2pDB.accounts.commitBlock(block);
    }
    this.maxChain = newHead;
  }

  get currHead() {
    return this.maxChain._currHead;
  }
}
