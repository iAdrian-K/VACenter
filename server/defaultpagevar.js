
const _ejs = require('ejs');
// example: global config
const _config = require('../config.json');
// custom ejs render function
module.exports = function render(filename, payload = {}, cb) {
    // some default page vars
    payload.config = payload.config || _config;
    // resources
    //payload.resources = payload.resources || {};
    // render file
    // you can also pass some ejs lowlevel options
    _ejs.renderFile(filename, payload, {

    }, cb);
}