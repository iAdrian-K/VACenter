//@ts-check

const request = require("request");
const Sentry = require("@sentry/node");
const Tracing = require("@sentry/tracing");
require('dotenv').config()

//Sentry
/* Sentry.init({
    dsn: "https://473725d276b441ea867cdde3d17b868b@o996992.ingest.sentry.io/5955471",
    // We recommend adjusting this value in production, or using tracesSampler
    // for finer control
    tracesSampleRate: 0.5,
}); */

/**@module Requests */

/**
 * Enum string values.
 * @enum {string}
 * @readonly
 * 
 */
const MethodValues = {
    /** Use for requesting data */
    GET: "GET",
    /** Use for creating data */
    POST: "POST",
    /** Use for removing data */
    DELETE: "DELETE",
    /** Use for updating data */
    PUT: "PUT",
    /** Use for asking for headers to be returned if it were a get request on path*/
    HEAD: "HEAD",
    /** Don't use */
    CONNECT: "CONNECT",
    /** Use for requesting request data like CORS */
    OPTIONS: "OPTIONS"
};

/**
 * JSON Request to URL
 * @param {MethodValues} method
 * @param {String} url 
 * @param {Object} headers 
 * @param {String} query - The Query String to be added to the URL.
 * @param {any} data - What data to be submitted to server
 * @returns {Promise<Array>} response - Array of Error, Response, Body
 */
function JSONReq(method, url, headers, query, data){
    return new Promise(resolve =>{
        const options = {
            method: method,
            url: url,
            headers: headers,
            qs: query,
            body: data,
            json: true
        };
        request(options, function(err, response, body){
            if(err) throw Sentry.captureException(err);
            resolve([err, response, body]);
        })
    })
}

/**
 * Form URL Encoded Request to URL
 * @param {MethodValues} method
 * @param {String} url
 * @param {Object} headers
 * @param {String} query - The Query String to be added to the URL.
 * @param {any} data - What data to be submitted to server
 * @returns {Promise<Array>} response - Array of Error, Response, Body
 */
function URLReq(method, url, headers, query, data) {
    return new Promise(resolve => {
        const options = {
            method: method,
            url: url,
            headers: headers,
            qs: query,
            form: data,
        };
        request(options, function (err, response, body) {
            if (err) throw Sentry.captureException(err);
            resolve([err, response, body]);
        })
    })
}

module.exports = {JSONReq, URLReq, MethodValues}
