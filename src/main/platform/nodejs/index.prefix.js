module.exports = {};
const atob = require('atob');
const btoa = require('btoa');
const JDB = require('jungle-db');
const fs = require('fs');
const https = require('https');
const WebSocket = require('ws');
const nimiq_node = require(`${__dirname}/nimiq_node`);

global.Class = {
    register: clazz => {
        module.exports[clazz.prototype.constructor.name] = clazz;
    }
};
