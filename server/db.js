//@ts-check

/**
 * @typedef {import('./types.js').user} user
 * @typedef {import('./types.js').aircraft} aircraft
 * @typedef {import('./types.js').event} event
 * @typedef {import('./types.js').gate} gate
 * @typedef {import('./types.js').notification} notification
 * @typedef {import('./types.js').operator} operator
 * @typedef {import('./types.js').PIREP} PIREP
 * @typedef {import('./types.js').rank} rank
 * @typedef {import('./types.js').route} route
 * @typedef {import('./types.js').slot} slot
 */

const sqlite3 = require('sqlite3').verbose();

/**@module Database */

//Database
let db = new sqlite3.Database('./database.db', (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to the database.');
});

// Aircrafts
/**
 * @desc Returns record of specific aircraft id
 * @param {string} id - Unique id of aircraft 
 * @returns {Promise<Array.<aircraft>>} Record for that aircraft in an array
 */
 function GetAircraft(id) {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.get(`SELECT * FROM aircrafts WHERE livID = ?`, [id], (err, row) => {
                if (err) {
                    error(err.message);
                } else {
                    resolve(row);
                }
            });
        });
    });
}
/**
 * @desc Returns all aircrafts
 * @returns {Promise<Array.<aircraft>>} All aircraft objects in an array
 */
function GetAircrafts() {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.all(`SELECT * FROM aircrafts`, (err, rows) => {
                if (err) {
                    error(err.message);
                } else {
                    resolve(rows);
                }
            });
        });
    });
}
/**
 * @desc Creates new Aircraft
 * @param {*} livID 
 * @param {*} airID 
 * @param {*} livName 
 * @param {*} airName 
 * @param {*} publicName 
 * @returns {Promise<String|Number>} Error 
 */
function CreateAircraft(livID, airID, livName, airName, publicName) {
    return new Promise((resolve, error) => {
        db.run(`INSERT INTO aircraft(livID, airID, livName, airName, publicName) 
                VALUES(?, ?, ?, ?, ?)`, [livID, airID, livName, airName, publicName], function (err) {
            if (err) {
                error(err);
            } else {
                resolve(this.lastID)
            }
        });
    })
}


// Events
/**
 * @desc Returns record of specific event id
 * @param {string} id - Unique id of event 
 * @returns {Promise<Array.<event>>} Record for that aircraft in an array
 */
 function GetEvent(id) {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.get(`SELECT * FROM events WHERE id = ?`, [id], (err, row) => {
                if (err) {
                    error(err.message);
                } else {
                    var eventsRow = row;
                    eventsRow.gates = [];
                    db.each(`SELECT gate, taken FROM gates WHERE eventID = ?`, [id], (err, row) => {
                        eventsRow.gates.push(row);
                    }, function() {
                        resolve(eventsRow);
                    })
                    
                }
            });
        });
    });
}
/**
 * @desc Returns all aircrafts
 * @returns {Promise<Array.<event>>} All aircraft objects in an array
 */
function GetEvents() {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.all(`SELECT * FROM events`, (err, rows) => {
                if (err) {
                    error(err.message);
                } else {
                    let events = [];
                    let processed = 0;
                    rows.forEach(event => {
                        event.gates = [];
                        db.each(`SELECT gate, taken FROM gates WHERE eventID = ?`, [event.id], (err, row) => {
                            event.gates.push(row);
                        }, function() {
                            events.push(event)
                            processed ++;
                            
                        })
                    }, function(){})
                }
            });
        });
    });
}
/**
 * @desc Creates new Event
 * @param {String} title
 * @param {String} body 
 * @param {String} arrAir 
 * @param {String} depAir 
 * @param {String} depTime 
 * @param {String} air 
 * @param {String} airName 
 * @param {String} server 
 * @param {Array} gates 
 * @returns {Promise<String|Number>} Error
 */
function CreateEvent(title, body, arrAir, depAir, depTime, air, airName, server, gates) {
    return new Promise((resolve, error) => {
        db.run(`INSERT INTO events(title, body, arrAir, depAir, depTime, air, airName, server) 
                VALUES(?, ?, ?, ?, ?, ?, ?, ?)`, [title, body, arrAir, depAir, depTime, air, airName, server], function (err) {
            if (err) {
                error(err);
            } else {
                var createdEvent = this.lastID;
                gates.forEach(gate => {
                    db.run(`INSERT INTO gates(eventID, gate, taken) 
                            VALUES(?, ?, 0)`, [createdEvent, gate], function (err) {
                        if (err) {
                            error(err);
                        }
                    });
                })
                resolve(createdEvent);
            }
        });
    })
}


// PIREPS
/**
 * @desc Returns record of specific PIREP id
 * @param {string} id - Unique id of prirep 
 * @returns {Promise<Array.<PIREP>>} Record for that prirep in an array
 */
 function GetPirep(id) {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.get(`SELECT * FROM pireps WHERE id = ?`, [id], (err, row) => {
                if (err) {
                    error(err.message);
                } else {
                    resolve(row);
                }
            });
        });
    });
}
/**
 * @desc Returns all pireps
 * @returns {Promise<Array.<PIREP>>} All PIREP Objects in an array
 */
function GetPireps() {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.all(`SELECT * FROM pireps`, (err, rows) => {
                if (err) {
                    error(err.message);
                } else {
                    resolve(rows);
                }
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
 * @returns {Promise<String|Number>} Error
 */
function CreatePirep(id, vehicle, vehiclePublic, author, airline, depICAO, arrICAO, route, flightTime, comments, status, fuel, filed) {
    return new Promise((resolve, error) => {
        db.run(`INSERT INTO pireps(id, vehicle, vehiclePublic, author, airline, depICAO, arrICAO, route, flightTime, comments, status, fuel, filed) 
                VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, vehicle, vehiclePublic, author, airline, depICAO, arrICAO, route, flightTime, comments, status, fuel, filed], function (err) {
            if (err) {
                error(err);
            } else {
                resolve(this.lastID)
            }
        });
    })
}


// Tokens
/**
 * @desc Returns valid token information if provided token is valid
 * @param {string} token - User token
 * @returns {Promise<Array.<token>>} Array with the token and user associated with the token
 */
function GetToken(token) {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.get(`SELECT * FROM tokens WHERE token = ?`, [token], (err, row) => {
                if (err) {
                    error(err.message);
                } else {
                    resolve(row);
                }
            })
        })
    })
}


// Users
/**
 * @desc Returns record of specific User ID (UID)
 * @param {string} username - Unique username of user 
 * @returns {Promise<Array.<user>>} Record for that username in an array
 */
function GetUser(username) {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, row) => {
                if (err) {
                    error(err.message);
                } else {
                    resolve(row);
                }
            });
        });
    });
}

/**
 * @desc Returns all users
 * @returns {Promise<Array.<{user}>>} User objects in an array
 */
function GetUsers() {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.all(`SELECT * FROM users`, (err, rows) => {
                if (err) {
                    error(err.message);
                } else {
                    resolve(rows);
                }
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
 * @return {Promise<String|Number>} Error
 */
function CreateUser(username, rank, admin, password, display, profileURL, hours, created, llogin, cp, revoked) {
    return new Promise((resolve, error) => {
        db.run(`INSERT INTO users(username, rank, admin, password, display, hours, created, llogin, cp, revoked) 
                VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [username, rank, admin, password, display, hours, created, llogin, cp, revoked], function (err) {
            if (err) {
                error(err);
            } else {
                resolve(this.lastID)
            }
        });
    });
}


module.exports = { db,
    GetUser, GetUsers, CreateUser,
    GetPirep, GetPireps, CreatePirep,
    GetEvent, GetEvents, CreateEvent};
