const request = require('request');
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