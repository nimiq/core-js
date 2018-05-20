function isSupportedBrowser() {
    if (typeof Symbol === 'undefined') return false;
    try {
        /* eslint-disable no-eval */
        eval('class Foo {}');
        eval('var bar = (x) => x+1');
        eval('const func = async function() { await func; }');
        /* eslint-enable no-eval */
    } catch (e) {
        return false;
    }
    return true;
}

if (!isSupportedBrowser()) {
    document.body.classList.add('browser-outdated');
}

