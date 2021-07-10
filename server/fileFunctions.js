const fs = require('fs');
const path = require('path');
function newError(error) {
    const requestSPECIAL = require('request');
    const fsSPECIAL = require('fs');
    const pathSPECIAL = require('path');
    let config = JSON.parse(fsSPECIAL.readFileSync(pathSPECIAL.join(__dirname, "/../") + "config.json"))
    const options2 = {
        method: 'POST',
        url: 'https://error.va-center.com/api/reportBug',
        form: { title: "AUTO - ERROR - " + config.name, body: JSON.stringify(error), contact: JSON.stringify(config) }
    };

    requestSPECIAL(options2, function (error2, response2, body2) {
        console.log(error2)
        console.log(response2)
        console.log(body2)
    })
}

function FileWrite(path, data) {
    return new Promise(resolve => {
        fs.writeFile(path, data, function (err) {
            if (err) {
                console.error(err)
                resolve(false)
                newError(err)
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
                newError(err)
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
                newError(err)
                console.error(err)
            }
        })
    })
}

module.exports = {FileRead, FileWrite, FileExists, FileRemove}