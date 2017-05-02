global.atob = require('atob');
global.btoa = require('btoa');
require('./classes.js');

module.exports = Core;


if (typeof process === 'object') {
    process.on('unhandledRejection', (error, promise) => {
        console.error("== Node detected an unhandled rejection! ==");
        console.error(error,promise);
    });
}

Core.get().then( $ => {
	console.log($);
})