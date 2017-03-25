class Core {
  constructor() {
    const p2pDBs = new P2PDBs();
    p2pDBs.blockChains.onEvent(longestChain => this._miner.workOnChain(longestChain.header));
    p2pDBs.onEvent(tx => this._miner.queueTx(tx));
    this._P2PDBs = p2pDBs;

    Wallet.get(p2pDBs.accounts).then(wallet => {
      this.wallet = wallet;
      wallet.exportAddress().then(addr => {
        console.log('Your Address:', Buffer.toBase64(addr));
        this._miner = new Miner(p2pDBs, addr);
      });
    });
  }

  transfer(value, receiverAddr, fee) {
    this.wallet.createTx(value, receiverAddr, fee)
     .then(tx => {
      this._P2PDBs.publishTx(tx);
      this._miner.queueTx(tx);
    });
  }
}

const $ = new Core();
console.log('%cWelcome to \uD835\uDD43ovicash', 'font-size:24px; color:teal;');
console.log(
`Options:
  1: $._miner._genesis() 
  2: $.transfer(4000,'8wjPPNOW0EXl/I5KVAy6mNzo9a2ufj1l',55)
  3: PeerPortal.setWebSocket('ws://localhost:8000')
`);

window.addEventListener('unhandledrejection', event => {
      event.preventDefault();
      console.error(event.reason || event);
    });
