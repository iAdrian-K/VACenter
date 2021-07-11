//@ts-check

const sqlite3 = require('sqlite3').verbose();

//Database
let db = new sqlite3.Database('./database.db', (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to the database.');
});

//Users
/**
 * @desc Returns record of specific UID
 * @param {string} username - unique username of user 
 * @returns {promise} Record for that username in an array
 */
function GetUser(username) {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.each(`SELECT * FROM users WHERE username = ?`, [username], (err, row) => {
                if (err) {
                    error(err.message);
                }
                resolve(row);
            });
        });
    });
}

/**
 * @desc Returns all users
 *
 * @returns {promise} All users in an array
 */
function GetUsers() {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.all(`SELECT * FROM users`, (err, rows) => {
                if (err) {
                    error(err.message);
                }
                resolve(rows);
            });
        });
    });
}

function CreateUser(username, rank, admin, password, display, hours, created, llogin, cp, revoked) {
    db.run(`INSERT INTO users(username, rank, admin, password, display, hours, created, llogin, cp, revoked) 
            VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [username, rank, admin, password, display, hours, created, llogin, cp, revoked], function (err) {
        return err;
    });
}

function GetPirep(id) {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.each(`SELECT * FROM pireps WHERE id = ?`, [id], (err, row) => {
                if (err) {
                    error(err.message);
                }
                resolve(row);
            });
        });
    });
}

function GetPireps() {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.all(`SELECT * FROM pireps`, (err, rows) => {
                if (err) {
                    error(err.message);
                }
                resolve(rows);
            });
        });
    });
}

function CreatePirep(username, rank, admin, password, display, hours, created, llogin, cp, revoked) {
    db.run(`INSERT INTO users(username, rank, admin, password, display, hours, created, llogin, cp, revoked) 
            VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [username, rank, admin, password, display, hours, created, llogin, cp, revoked], function (err) {
        return err;
    });
}
module.exports = { db, GetUser, GetUsers, CreateUser, GetPirep, GetPireps, CreatePirep };
