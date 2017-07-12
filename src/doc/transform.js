/**
 * transform function invoked by esdoc-plugin-transform-html
 * @param {Function} $ - the Cheerio instance
 * @param {Object} config - the global esdoc config
 * @param {Object} options - the current options object
 * @param {String} fileName - the current file being processed
 * @param {String} is - a convenience to check if the current fileName matches a glob pattern
 */
module.exports = function transform({$, config, options, fileName, is}) {
    if ($('div[class=header-notice] span[data-ice=kind]').text() === 'class') {
        const h1 = $('h1');
        if (h1.text() !== 'Nimiq') {
            h1.prepend('<span style="opacity: 0.7;">Nimiq.</span>');
        }
    }
};
