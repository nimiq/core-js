module.exports = {};
const atob = require('atob');
const btoa = require('btoa');
const JDB = require('@nimiq/jungle-db');
const fs = require('fs');
const dns = require('dns');
const https = require('https');
const WebSocket = require('uws');
const NodeNative = require('bindings')('nimiq_node.node');
const chalk = require('chalk');

global.Class = {
    scope: module.exports,
    register: clazz => {
        module.exports[clazz.prototype.constructor.name] = clazz;
    }
};
