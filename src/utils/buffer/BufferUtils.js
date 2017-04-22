class BufferUtils {

  static toUnicode(buffer, encoding = 'utf-8') {
    const decoder = new TextDecoder(encoding);
    return decoder.decode(buffer);
  }

  static fromUnicode(string, encoding = 'utf-8') {
    const encoder = new TextEncoder(encoding);
    return encoder.encode(string);
  }

  static toBase64(buffer) {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
  }

  static fromBase64(base64) {
    return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  }

  static toBase64Clean(buffer) {
    return Buffer.toBase64(buffer).replace(/\//g, '_').replace(/\+/g, '-').replace(/=/g, '');
  }

  static concatTypedArrays(a, b) {
    const c = new (a.constructor)(a.length + b.length);
    c.set(a, 0);
    c.set(b, a.length);
    return c;
  }

  static concat(a, b)  {
    return BufferUtils.concatTypedArrays(
        new Uint8Array(a.buffer || a),
        new Uint8Array(b.buffer || b)
    );
  }

  static equals(a, b) {
    if (a.length !== b.length) return false;
    const viewA = new Uint8Array(a);
    const viewB = new Uint8Array(b);
    for (let i = 0; i < a.length; i++) {
      if (viewA[i] !== viewB[i]) return false;
    }
    return true;
  }
}
