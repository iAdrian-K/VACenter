const fs = require('fs');

function FileWrite(path, data) {
    return new Promise(resolve => {
        fs.writeFile(path, data, function (err) {
            if (err) {
                console.error(err)
                resolve(false)
            } else {
                resolve(true)
            }
        })
    })

}
function FileExists(path) {
    return new Promise(resolve => {
        fs.stat(path, function (err, stat) {
            if (stat != undefined) {
                resolve(true);
            } else {
                resolve(false);
            }
        })
    })

}

function FileRemove(path) {
    return new Promise(resolve => {
        fs.unlink(path, function (err, data) {
            resolve(err ? false : data);
            if (err) {
                console.error(err)
            }
        })
    })
}

function FileRead(path) {
    return new Promise(resolve => {
        fs.readFile(path, function (err, data) {
            resolve(err ? false : data);
            if (err) {
                console.error(err)
            }
        })
    })
}

module.exports = {FileRead, FileWrite, FileExists, FileRemove}