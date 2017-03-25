class HasEvents {
  constructor() {
    this._callbacks = {};
  }
  onEvent(type, cb) {
    this._callbacks[type] = cb;
  }

  fire(type, obj) {
    if (this._callbacks[type])
      this._callbacks[type](obj);
  }
}

class HasEvent {
  onEvent(cb) {
    this._onEvent = cb;
  }

  fire(s) {
    if (this._onEvent)
      this._onEvent(s);
  }
}
