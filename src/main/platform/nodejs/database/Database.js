var levelup = require('levelup');

class RawIndexedDB{
  constructor(tableName){
    this._db = levelup('./database/tables/'+tableName);
  }

  put(key, value){
    return new Promise( (resolve,error) => {
      this._db.put(key,value, err => err ? error(err) : resolve());
    });
  }

  get(key){
    return new Promise( (resolve,error) => {
      this._db.get(key, (err,value) => resolve(value));
    }); 
  }

  delete(key){
    return new Promise( (resolve,error) => {
      this._db.del(key, err => resolve());
    }); 
  }
}

Class.register(RawIndexedDB);
