//@ts-ignore
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
//Database
let db = new sqlite3.Database('./database.db', (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to the database.');
});
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
//@ts-ignore
function GetUser(username) {
    return new Promise(resolve => {
        db.serialize(() => {
            db.each(`SELECT * FROM users WHERE username = ?`, (err, row) => {
                if (err) {
                    console.error(err.message);
                }
                console.log(row);
                console.log(123);
            });
        });
    });
}
module.exports = { ReadFile, WriteFile, ExistsFile, RemoveFile };
