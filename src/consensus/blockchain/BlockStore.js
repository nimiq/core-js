class BlockStore {
    static getPersistent() {

    }

    static createVolatile() {

    }
}

class PersistentBlockStore extends HasEvent {

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
