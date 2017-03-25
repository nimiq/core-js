class ObjectDB extends IndexedDB {
  constructor(tableName, type) {
    super(tableName);
    this._type = type;
  }

  load(key) {
    return super.get(key).then(value => new this._type(value));
  }

  save(obj) {
    return obj.hash().then(key => super.put(key, obj.serialize()));
  }
}

class BlockHeaderDB extends ObjectDB {constructor() {super('headers', BlockHeader);}}

class BlockBodyDB 	extends ObjectDB {constructor() {super('bodies', BlockBody);}}

class Databases{
  constructor() {
    this.headers = new BlockHeaderDB();
    this.bodies = new BlockBodyDB();
  }
}
