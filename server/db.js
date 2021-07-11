//@ts-check

const sqlite3 = require('sqlite3').verbose();

//Database
let db = new sqlite3.Database('./database.db', (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to the database.');
});
/** @namespace DB - Aircrafts */

/** @namespace DB - Events */

/** @namespace DB - Gates */

/** @namespace DB - News */

/** @namespace DB - Notifications */

/** @namespace DB - Operators */

/** @namespace DB - PIREPS */
/**
 * @desc Returns record of specific PIREP id
 * @param {string} id - Unique id of prirep 
 * @returns {Promise<Array>} Record for that prirep in an array
 * @memberof DB - PIREPS
 */
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
/**
 * @desc Returns all pireps
 * @returns {Promise<Array>} All PIREP Objects in an array
 * @memberof DB - PIREPS
 */
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
/**
 * @desc Creates new PIREP
 * @param {string} id - Unique ID of pirep
 * @param {string} vehicle - Livery ID
 * @param {string} vehiclePublic - Name of Vehicle
 * @param {string} author - Pirep Creator
 * @param {string} airline - Airline
 * @param {string} depICAO - Departing ICAO code
 * @param {string} arrICAO - Arriving ICAO code
 * @param {string} route - Route
 * @param {number} flightTime - Flight time
 * @param {string} comments - Comments for flight
 * @param {string} status - "N": Pending, "A": Approved, "D": Denided
 * @param {number} fuel - Fuel used
 * @param {string} filed - Time of creation
 * @return Error
 * @memberof DB - PIREPS
 */
function CreatePirep(id, vehicle, vehiclePublic, author, airline, depICAO, arrICAO, route, flightTime, comments, status, fuel, filed) {
    db.run(`INSERT INTO users(id, vehicle, vehiclePublic, author, airline, depICAO, arrICAO, route, flightTime, comments, status, fuel, filed) 
            VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, vehicle, vehiclePublic, author, airline, depICAO, arrICAO, route, flightTime, comments, status, fuel, filed], function (err) {
        return err;
    });
}
/** @namespace DB - Ranks */

/** @namespace DB - Routes */

/** @namespace DB - Slots */

/** @namespace DB - Tokens */

/** @namespace DB - Users */
/**
 * @desc Returns record of specific User ID (UID)
 * @param {string} username - Unique username of user 
 * @returns {Promise<Array>} Record for that username in an array
 * @memberof DB - Users
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
 * @returns {Promise<Array>} User objects in an array
 * @memberof DB - Users
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

/**
 * @desc Creates a new user
 * @param {string} username - Digit Username
 * @param {string} rank - Rank of user
 * @param {boolean} admin - Admin status
 * @param {string} password - Hashed password of user
 * @param {string} display - Display Name
 * @param {string} profileURL - URL to profile picture
 * @param {number} hours - Flight Hours
 * @param {string} created - Date and time created
 * @param {string} llogin - Last logged in
 * @param {boolean} cp - Force change password on next login
 * @param {boolean} revoked - User access revoked
 * @return Error
 * @memberof DB - Users
 */
function CreateUser(username, rank, admin, password, display, profileURL, hours, created, llogin, cp, revoked) {
    db.run(`INSERT INTO users(username, rank, admin, password, display, hours, created, llogin, cp, revoked) 
            VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [username, rank, admin, password, display, hours, created, llogin, cp, revoked], function (err) {
        return err;
    });
}


module.exports = { db,
    GetUser, GetUsers, CreateUser,
    GetPirep, GetPireps, CreatePirep };
