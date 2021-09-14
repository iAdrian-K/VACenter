//@ts-check
const fs = require('fs');
const Sentry = require("@sentry/node");
const Tracing = require("@sentry/tracing");

//Sentry
Sentry.init({
    dsn: "https://6d767a62451e42bea695a23f8f9bf6d7@o999289.ingest.sentry.io/5958189",

    // We recommend adjusting this value in production, or using tracesSampler
    // for finer control
    tracesSampleRate: 1.0,
});

/**@module File Functions*/

/**
 * File Write to FS
 * @param {string} path 
 * @param {any} data 
 * @returns {Promise<boolean|Error>} - Will return error (fail) or true (success) 
 */
function FileWrite(path, data){
    return new Promise((resolve, error) => {
        fs.writeFile(path, data, (err)=>{
            if(err){
                Sentry.captureException(err);
            }else{
                resolve(true)
            }
        })
    })
}
/**
 * 
 * @param {string} path 
 * @returns {Promise<string|Error|object|null>} Data from file
 */
function FileRead(path){
    return new Promise((resolve, error) =>{
        fs.readFile(path, (err, data)=>{
            if(err){
                Sentry.captureException(err);
            }else{
                resolve(data)
            }
        })
    })
}
/**
 * 
 * @param {string} path 
 * @returns {Promise<boolean>} State of the file
 */
function FileExists(path){
    return new Promise((resolve, error) =>{
        fs.access(path, err => {
            if(err){
                Sentry.captureException(err);
                resolve(false);
            }else{
                resolve(true);
            }
        })
    })
}

/**
 * 
 * @param {string} path - File Path 
 * @returns {Promise<boolean|Error>} If operation is successful
 */
function FileRemove(path) {
    return new Promise((resolve, error) => {
        fs.unlink(path, err => {
            if (err) {
                Sentry.captureException(err);;
            } else {
                resolve(true);
            }
        })
    })
}

module.exports = {FileWrite, FileRead, FileExists, FileRemove}