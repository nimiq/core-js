module.exports = {};
const atob = require('atob');
const btoa = require('btoa');
const JDB = require('../../jungle-db/dist/lmdb.js');
const fs = require('fs');
const dns = require('dns');
const https = require('https');
const WebSocket = require('ws');
const NodeNative = require(`${__dirname}/nimiq_node`);

global.Class = {
    scope: module.exports,
    register: clazz => {
        module.exports[clazz.prototype.constructor.name] = clazz;
    }
};
