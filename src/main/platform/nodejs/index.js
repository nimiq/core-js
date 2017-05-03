// Print stack traces to the console.
Error.prototype.toString = function() {
	return this.stack;
};

global.atob = require('atob');
global.btoa = require('btoa');
require('./classes.js');

module.exports = Core;

Core.get().then( $ => {
	console.log('Got Nimiq Core',$);
})
