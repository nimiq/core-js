/**
 * transform function invoked by esdoc-plugin-transform-html
 * @param {Function} $ - the Cheerio instance
 * @param {Object} config - the global esdoc config
 * @param {Object} options - the current options object
 * @param {String} fileName - the current file being processed
 * @param {Function} is - a convenience to check if the current fileName matches a glob pattern
 */
module.exports = function transform({$, config, options, fileName, is}) {
    if (fileName.indexOf('class/src/main') === 0) {
        const h1 = $('h1');
        if (h1.text() !== 'Nimiq') {
            h1.prepend('<span style="opacity: 0.7;">Nimiq.</span>');
        }
    }
    $('div[class=nav-dir-path]').each((_, _navLi) => {
        const navLi = $(_navLi);
        if (navLi.text().startsWith('main/generic/')) {
            navLi.text(navLi.text().substring(13));
        } else {
            if (navLi.text() === 'main/platform/browser') {
                const sub = navLi.siblings().first();
                sub.removeClass('kind-class');
                sub.addClass('kind-external');
                navLi.parent().parent().prepend(navLi.parent());
            }
            navLi.remove();
        }
    });
};
