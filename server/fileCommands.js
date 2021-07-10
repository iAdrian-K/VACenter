//@ts-ignore
const fs = require('fs');
//@ts-ignore
function ReadFile(filename) {
    return new Promise(resolve => {
        fs.readFile(filename, (err, data) => {
            if (err) {
                resolve(false);
            }
            else {
                resolve(data);
            }
        });
    });
}
//@ts-ignore
function WriteFile(filename, data) {
    return new Promise(resolve => {
        fs.access(filename, fs.F_OK, (err) => {
            if (err) {
                resolve(false);
            }
            else {
                resolve(true);
            }
        });
    });
}
//@ts-ignore
function ExistsFile(filename, data) {
    return new Promise(resolve => {
        fs.writeFile(filename, data, (err) => {
            if (err) {
                resolve(false);
            }
            else {
                resolve(true);
            }
        });
    });
}
//@ts-ignore
function RemoveFile(filename) {
    return new Promise(resolve => {
        fs.unlink(filename, (err) => {
            if (err) {
                resolve(false);
            }
            else {
                resolve(true);
            }
        });
    });
}
module.exports = { ReadFile, WriteFile, ExistsFile, RemoveFile };
