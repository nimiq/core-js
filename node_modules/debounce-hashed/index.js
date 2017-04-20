module.exports = function (fn, hashingfn, interval, immediate) {
  var timeouts = {}

  return function () {
    var context = this
    var args = arguments
    var hash = hashingfn.apply(this, arguments)
    var timeout = timeouts[hash]
    var callNow = immediate && !timeout

    function later() {
      delete timeouts[hash]
      if (!immediate) fn.apply(context, args);
    }

    if (timeout) clearTimeout(timeout);
    timeouts[hash] = setTimeout(later, interval)
    if (callNow) return fn.apply(context, args);
  }
}
