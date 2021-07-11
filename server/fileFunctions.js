//@ts-check
const fs = require('fs');
/**
 * File Functions
 * @namespace File Functions
 */

/**
 * File Write to FS
 * @param {string} path 
 * @param {any} data 
 * @memberof File Functions
 * @returns {Promise<boolean|Error>} - Will return error (fail) or true (success) 
 */
function FileWrite(path, data){
    return new Promise((resolve, error) => {
        fs.writeFile(path, data, (err)=>{
            if(err){
                error(err)
            }else{
                resolve(true)
            }
        })
    })
}
/**
 * 
 * @param {string} path 
 * @memberof File Functions
 * @returns {Promise<string|Error|object|null>} Data from file
 */
function FileRead(path){
    return new Promise((resolve, error) =>{
        fs.readFile(path, (err, data)=>{
            if(err){
                error(err)
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
 * @memberof File Functions
 */
function FileExists(path){
    return new Promise((resolve, error) =>{
        fs.access(path, err => {
            if(err){
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
 * @memberof File Functions
 */
function FileRemove(path) {
    return new Promise((resolve, error) => {
        fs.unlink(path, err => {
            if (err) {
                error(err);
            } else {
                resolve(true);
            }
        })
    })
}
module.exports = {FileWrite, FileRead, FileExists, FileRemove}