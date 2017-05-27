navigator.storage.persisted().then(persistent => {
    if (persistent) {
        console.log('Storage will not be cleared except by explicit user action');
    } else {
        console.log('Storage may be cleared by the UA under storage pressure.');
    }
});

