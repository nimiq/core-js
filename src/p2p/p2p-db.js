// TODO: Implement persistent chain
// TODO: Implement resolving of forks
// TODO: Implement catch up
// TODO: Implement longest chain
// TODO V2: Implement light catch up

class BlocksP2PDB extends HasEvent {

  constructor(db, p2p) {
    super();
    this._headersCache = {};
    this._db = db;
    this._p2p = p2p;
  }

  processHeader(header) {
    header.log('Received');
    const txRoot = Buffer.toBase64(header.txRoot);
    this._headersCache[txRoot] = header;
  }

  processBody(body) {
    body.log('Received');
    const txRoot = Buffer.toBase64(body.txRoot);
    const header = this._headersCache[txRoot];
    if (header) {
      this._headersCache[txRoot] = null;
      this._db.bodies.save(body);
      this._db.headers.save(header);
      this.fire(new Block(header,body));
    }
  }

  publish(block) {
    this._db.headers.save(block.header);
    this._db.bodies.save(block.body);
    this._p2p.broadcast(block.header);
    this._p2p.broadcast(block.body);
    this.fire(block);
  }

  get(id) {
    return this._db.headers.load(id)
     .then(header => this._db.bodies.load(header.txRoot)
      .then(body => new Block(header,body)));
  }

  getHeader(id) {
    return this._db.headers.load(id);
  }

  sendAllHeadersTo(peerId) {
    this._db.headers.getAll()
     .then(headers => headers
      .sort(BlockHeader.sort)
      .forEach(header => this._p2p.sendTo(peerId, header)));
  }
}

class AccountsP2PDB extends RawIndexedDB {
  constructor() {
    super('accounts');
  }

  _serialize(node) {return Crypto.sha256(Buffer.fromUnicode(JSON.stringify(node)));}

  put(node) {
    return this._serialize(node).then(hash => {
              const base64 = Buffer.toBase64(hash);
              super.put(base64, node);
              return base64;
            });
  }

  delete (node) {
    return this._serialize(node).then(hash => super.delete(Buffer.toBase64(hash)));
  }

  get(key) {
    return super.get(key);
  }
}

class P2PDBs extends HasEvent{
  constructor() {
    super();
    this._p2p = new P2PNetwork();
    this._db = new Databases();

    this.accounts = new AccountsState(new AccountsP2PDB());
    this.blockChains = new BlockChains(this);
    // this.proofChains = new ProofChains(this);

    this.blocks = new BlocksP2PDB(this._db, this._p2p);
    this.blocks.onEvent(block => this.blockChains.push(block));

    this._p2p.onEvent(obj => this._onObject(obj));
  }

  publishTx(tx) {
    this._p2p.broadcast(tx);
  }

  _onObject(obj) {
    if (obj.byteLength === Constants.B_HEADER)
     return new BlockHeader(obj).then(h => this.blocks.processHeader(h));
     // return new BlockHeader(obj).then(h => this.blockChains.push(h));
    if (obj.byteLength === Constants.TX_SIZE)
     return new Transaction(obj).then(tx => this.fire(tx));
    if (obj.byteLength % Constants.TX_SIZE === Constants.ADDRESS_SIZE)
     return new BlockBody(obj).then(b => this.blocks.processBody(b));
  }
}
