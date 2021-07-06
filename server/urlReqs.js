const request = require('request');

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
            if (error) throw new Error(error)
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
            if (error) throw new Error(error)
            resolve([error, response, body]);
        });
    })

}

module.exports = {URLReq, JSONReq}