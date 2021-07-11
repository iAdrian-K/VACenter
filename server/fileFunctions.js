//@ts-check
const fs = require('fs');

/**
 * File Write to FS
 * @param {string} path 
 * @param {any} data 
 * @returns {promise} - Will return error (fail) or true (success) 
 */
function FileWrite(path, data){
    return new Promise((resolve, error) => {
        fs.writeFile(path, data, (err)=>{
            if(err){
                error(false)
            }else{
                resolve(true)
            }
        })
    })
}
/**
 * 
 * @param {string} path 
 * @returns {promise} Data from file
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
 * @returns {promise} State of the file
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
 * @returns {promise} If operation is successful
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