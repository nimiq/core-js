module.exports = {};
const atob = require('atob');
const btoa = require('btoa');
const JDB = require('jungle-db');

global.Class = {
    register: clazz => {
        module.exports[clazz.prototype.constructor.name] = clazz;
    }
};
