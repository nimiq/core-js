// Print stack traces to the console.
Error.prototype.toString = function () {
    return this.stack;
};

// Don't exit on uncaught exceptions.
process.on('uncaughtException', (err) => {
    // Blacklist unsupressable WebSocket errors.
    const message = err.message;
    if (message
        && (
            message.startsWith('connect E')
            || message === "Cannot read property 'aborted' of null")
        ) {
        return;
    }

    console.error(`Uncaught exception: ${err.message || err}`, err);
});
