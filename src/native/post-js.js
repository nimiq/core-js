// This gets appended to the emscripten emmitted js code but still within the Module,
// so we have access to local variables STACK_BASE, STACK_MAX, TOTAL_STACK.
Module['_getStack'] = Module._getStack = function() {
    // find stack start regardless of upwards or downwards growing stack
    var stackStart = Math.min(STACK_BASE, STACK_MAX);
    return new Uint8Array(HEAP8.buffer, stackStart, TOTAL_STACK);
}
