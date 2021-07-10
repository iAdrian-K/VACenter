const request = require('request');
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
function URLReq(method, url, headers, query, data) {
    return new Promise(resolve => {
        const options = {
            method: method,
            url: url,
            headers: headers,
            qs: query,
            form: data,
        };

        request(options, function (error, response, body) {
            if (error) newError(error);
            resolve([error, response, body]);
        });
    })

}
function JSONReq(method, url, headers, query, data) {
    return new Promise(resolve => {
        const options = {
            method: method,
            url: url,
            headers: headers,
            qs: query,
            body: data,
            json: true
        };

        request(options, function (error, response, body) {
            if (error) newError(error);
            resolve([error, response, body]);
        });
    })

}

module.exports = {URLReq, JSONReq}