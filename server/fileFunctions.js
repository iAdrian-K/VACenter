const fs = require('fs');
const path = require('path');
function newError(error, title) {
    const requestSPECIAL = require('request');
    const fsSPECIAL = require('fs');
    const pathSPECIAL = require('path');
    let config = JSON.parse(fsSPECIAL.readFileSync(pathSPECIAL.join(__dirname, "/../") + "config.json"))
    let errorB;
    if (error instanceof Error) {
        errorB = error.toString()
    } else if (typeof error == "object") {
        errorB = JSON.stringify(error)
    } else {
        errorB = error;
    }
    const options2 = {
        method: 'POST',
        url: 'https://error.va-center.com/api/reportBug',
        form: { title: title ? title : "AUTO - ERROR - " + config.name, body: errorB, contact: JSON.stringify(config) }
    };

    requestSPECIAL(options2, function (error2, response2, body2) {
        console.log("NEW REPORT")
        console.log(options2.form)
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