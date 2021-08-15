//@ts-check
// Error Reporting

const fs = require('fs');
const path = require('path');
const request = require('request');
const bcrypt = require('bcrypt');

function newError(error, title) {
    const requestSPECIAL = require('request');
    // @ts-ignore
    let config = JSON.parse(fs.readFileSync(path.join(__dirname, "/../config.json")))
    let errorB;
    if(error instanceof Error){
        errorB = error.toString()
    }else if(typeof error == "object"){
        errorB = JSON.stringify(error)
    }else{
        errorB = error;
    }
    const options2 = {
        method: 'POST',
        url: 'https://error.va-center.com/api/reportBug',
        form: { title: title ? title : "AUTO - ERROR - " + config.name, body: errorB, contact: JSON.stringify(config) }
    };

    request(options2, function (error2, response2, body2) {
        console.log("NEW REPORT")
        console.log(options2.form)
    })
}

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
 * @typedef {import('./types.js').statistic} statistic
 */

const sqlite3 = require('sqlite3').verbose();

/**@module Database */

//Database
let db = new sqlite3.Database('./database.db', (err) => {
    if (err) {
        newError(err.message, "Error accessing database (REF:DB01)")
    }
    console.log('Connected to the database.');
});

// Aircrafts
/**
 * Returns record of specific aircraft id
 * @param {string} id - Unique id of aircraft 
 * @returns {Promise<aircraft>} Record for that aircraft in an array
 */
 function GetAircraft(id) {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.get(`SELECT * FROM aircrafts WHERE livID = ?`, [id], (err, row) => {
                if (err) {
                    newError(err.message, "Error getting aircraft data (REF:DB02)")
                } else {
                    resolve(row);
                }
            });
        });
    });
}
/**
 * Returns all aircrafts
 * @returns {Promise<Array.<aircraft>>} All aircraft objects in an array
 */
function GetAircrafts() {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.all(`SELECT * FROM aircrafts`, (err, rows) => {
                if (err) {
                    newError(err.message, "Error accessing all aircraft data (REF:DB03)")
                } else {
                    resolve(rows);
                }
            });
        });
    });
}
/**
 * Creates new Aircraft
 * @param {String} livID - Livery ID
 * @param {String} airID - Aircraft ID
 * @param {String} livName - Livery Name
 * @param {String} airName - Aircraft Name
 * @param {String} publicName - Public Name (Livery Name and Aircraft Name)
 * @returns {Promise<Boolean>} Returns success in boolean of query
 */
function CreateAircraft(livID, airID, livName, airName, publicName) {
    return new Promise((resolve, error) => {
        db.run(`INSERT INTO aircrafts(livID, airID, livName, airName, publicName) 
                VALUES(?, ?, ?, ?, ?)`, [livID, airID, livName, airName, publicName], function (err) {
            if (err) {
                newError(err.message, "Error creating new aircraft (REF:DB04)")
                resolve(false)
            } else {
                resolve(true)
            }
        });
    })
}

/**
 * Delete aircraft
 * @param {String} id - LivID of aircraft
 * @returns {Promise<Boolean>} Returns boolean of query
 */
 function DeleteAircraft(id){
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.run(`DELETE FROM aircrafts WHERE livID = ?`, [id], (err) => {
                if (err) {
                    newError(err.message, "Error deleting aircraft (REF:DB05)")
                    resolve(false)
                } else {
                    resolve(true)
                }
            });
        });
    });
}


// Events
/**
 * Returns record of specific event id
 * @param {string} id - Unique id of event 
 * @returns {Promise<Array.<event>|Boolean>} Record for that aircraft in an array
 */
 function GetEvent(id) {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.get(`SELECT * FROM events WHERE id = ?`, [id], (err, row) => {
                if (err) {
                    newError(err.message, "Error accessing event data (REF:DB06)")
                    resolve(false)
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
 * Returns all events
 * @returns {Promise<Array.<event>>} All events objects in an array
 */
function GetEvents() {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.all(`SELECT * FROM events`, (err, events) => {
                if (err) {
                    newError(err.message, "Error accessing all event data (REF:DB07)")
                } else {
                    if (events.length == 0) {
                        resolve([])
                    } else {
                    let eventsProcessed = 0;
                        events.forEach(event => {
                            event.gates = [];
                            let gatesProcessed = 0;
                            db.each(`SELECT gate, taken FROM gates WHERE eventID = ?`, [event.id], (err, gate) => {
                                event.gates.push(gate)
                            }, function() {
                                eventsProcessed ++;
                                if(eventsProcessed == events.length){
                                    resolve(events);
                                }
                            })
                        })
                    }
                }
            });
        });
    });
}
/**
 * Creates new Event
 * @param {String} title
 * @param {String} body 
 * @param {String} arrAir 
 * @param {String} depAir 
 * @param {String} depTime 
 * @param {String} air 
 * @param {String} airName 
 * @param {String} server 
 * @param {Array} gates 
 * @returns {Promise<Boolean>} Returns boolean of query
 */
function CreateEvent(title, body, arrAir, depAir, depTime, air, airName, server, gates) {
    return new Promise((resolve, error) => {
        db.run(`INSERT INTO events(title, body, arrAir, depAir, depTime, air, airName, server) 
                VALUES(?, ?, ?, ?, ?, ?, ?, ?)`, [title, body, arrAir, depAir, depTime, air, airName, server], function (err) {
            if (err) {
                newError(err.message, "Error creating event (REF:DB07)")
                resolve(false)
            } else {
                var createdEvent = this.lastID;
                gates.forEach(gate => {
                    db.run(`INSERT INTO gates(eventID, gate, taken) 
                            VALUES(?, ?, 0)`, [createdEvent, gate], function (err) {
                        if (err) {
                            newError(err.message, "Error creating event's gate (REF:DB08)")
                        }
                    });
                })
                resolve(true);
            }
        });
    })
}

/**
 * Delete event
 * @param {String} id - id of event
 * @returns {Promise<Boolean>} Returns boolean of query
 */
 function DeleteEvent(id){
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.run(`DELETE FROM events WHERE id = ?`, [id], (err) => {
                if (err) {
                    newError(err.message, "Error deleting event (REF:DB09)")
                    resolve(false)
                } else {
                    resolve(true)
                }
            });
        });
    });
}


// PIREPS
/**
 * Returns record of specific PIREP id
 * @param {string} id - Unique id of prirep 
 * @returns {Promise<PIREP>} Record for that prirep in an array
 */
 function GetPirep(id) {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.get(`SELECT * FROM pireps WHERE id = ?`, [id], (err, row) => {
                if (err) {
                    newError(err.message, "Error accessing PIREP data (REF:DB10)")
                } else {
                    resolve(row);
                }
            });
        });
    });
}

/**
 * Returns all pireps
 * @returns {Promise<Array.<PIREP>>} All PIREP Objects in an array
 */
function GetPireps() {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.all(`SELECT * FROM pireps`, (err, rows) => {
                if (err) {
                    newError(err.message, "Error accessing all PIREP data (REF:DB11)")
                } else {
                    resolve(rows);
                }
            });
        });
    });
}

/**
 * Returns all pireps for a user
 * @returns {Promise<Array.<PIREP>>} All PIREP Objects in an array
 */
 function GetUsersPireps(user) {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.all(`SELECT * FROM pireps WHERE author = ?`, [user], (err, rows) => {
                if (err) {
                    newError(err.message, "Error accessing all PIREP data for a user (REF:DB12)")
                } else {
                    resolve(rows);
                }
            });
        });
    });
}

/**
 * Creates new PIREP
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
 * @returns {Promise<Boolean>} Returns boolean of query
 */
function CreatePirep(vehicle, vehiclePublic, author, airline, depICAO, arrICAO, route, flightTime, comments, status, fuel, filed) {
    return new Promise((resolve, error) => {
        db.run(`INSERT INTO pireps(vehicle, vehiclePublic, author, airline, depICAO, arrICAO, route, flightTime, comments, status, fuel, filed) 
                VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [vehicle, vehiclePublic, author, airline, depICAO, arrICAO, route, flightTime, comments, status, fuel, filed], function (err) {
            if (err) {
                newError(err.message, "Error creating PIREP (REF:DB12)")
                resolve(false)
            } else {
                resolve(true)
            }
        });
    })
}

/**
 * Update PIREP
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
 * @returns {Promise<Boolean>} Returns boolean of query
 */
 function UpdatePirep(id, vehicle, vehiclePublic, author, airline, depICAO, arrICAO, route, flightTime, comments, status, fuel, filed) {
    return new Promise((resolve, error) => {
        db.run(`UPDATE pireps SET 
                vehicle = ?,
                vehiclePublic = ?,
                author = ?,
                airline = ?,
                depICAO = ?,
                arrICAO = ?,
                route = ?,
                flightTime = ?,
                comments = ?,
                status = ?,
                fuel = ?,
                filed = ? 
                WHERE id = ?`, [vehicle, vehiclePublic, author, airline, depICAO, arrICAO, route, flightTime, comments, status, fuel, filed, id], function (err) {
            if (err) {
                newError(err.message, "Error updating PIREP (REF:DB12)")
                resolve(false)
            } else {
                resolve(true)
            }
        });
    })
}


// Tokens
/**
 * Returns valid token information if provided token is valid
 * @param {string} token - User token
 * @returns {Promise<Object>} Array with the token and user associated with the token
 */
function GetToken(token) {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.get(`SELECT * FROM tokens WHERE token = ?`, [token], (err, row) => {
                if (err) {
                    newError(err.message, "Error accessing token data (REF:DB13)")
                } else {
                    resolve(row);
                }
            })
        })
    })
}
/**
 * Creates new token
 * @param {String} token 
 * @param {String} user
 * @returns {Promise<Boolean>} Returns boolean of query
 */
function CreateToken(token, user) {
    return new Promise((resolve, error) => {
        db.run(`INSERT INTO tokens (token, user) 
                VALUES(?, ?)`, [token, user], function (err) {
            if (err) {
                newError(err.message, "Error creating token (REF:DB14)")
                resolve(false)
            } else {
                resolve(true)
            }
        });
    });
}

/**
 * Delete all User's Tokens
 * @param {String} username - Username of user
 * @returns {Promise<Boolean>} Returns boolean of query
 */
 function DeleteTokens(username){
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.run(`DELETE FROM tokens WHERE user = ?`, [username], (err) => {
                if (err) {
                    newError(err.message, "Error deleting user's token (REF:DB15)")
                    resolve(false)
                } else {
                    resolve(true)
                }
            });
        });
    });
}


// Users
/**
 * Returns record of specific User ID (UID)
 * @param {string} username - Unique username of user 
 * @returns {Promise<user>} Record for that username
 */
function GetUser(username) {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, row) => {
                if (err) {
                    newError(err.message, "Error accessing user data (REF:DB16)")
                } else {
                    resolve(row);
                }
            });
        });
    });
}

/**
 * Returns all users
 * @returns {Promise<Array.<{user}>>} User objects in an array
 */
function GetUsers() {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.all(`SELECT * FROM users`, (err, rows) => {
                if (err) {
                    newError(err.message, "Error accessing all user data (REF:DB17)")
                } else {
                    resolve(rows);
                }
            });
        });
    });
}

/**
 * Creates a new user
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
 * @returns {Promise<Boolean>} Returns boolean of query
 */
function CreateUser(username, rank, admin, password, display, profileURL, hours, created, llogin, cp, revoked, VANetID) {
    return new Promise((resolve, error) => {
        db.run(`INSERT INTO users(username, rank, admin, password, display, profileURL, hours, created, llogin, cp, revoked, VANetID) 
                VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [username, rank, admin, password, display, profileURL, hours, created, llogin, cp, revoked, VANetID], function (err) {
            if (err) {
                newError(err.message, "Error creating user (REF:DB18)")
                resolve(false)
            } else {
                resolve(true)
            }
        });
    });
}

/**
 * Update a user
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
 * @returns {Promise<Boolean>} Returns boolean of query
 */
 function UpdateUser(username, rank, admin, password, display, profileURL, hours, created, llogin, cp, revoked, VANetID) {
    return new Promise((resolve, error) => {
        db.run(`UPDATE users SET
                rank = ?,
                admin = ?,
                password = ?,
                display = ?,
                profileURL = ?,
                hours = ?,
                created = ?,
                llogin = ?,
                cp = ?,
                revoked = ?,
                VANetID = ? 
                WHERE username = ?`, [rank, admin, password, display, profileURL, hours, created, llogin, cp, revoked, VANetID, username], function (err) {
            if (err) {
                newError(err.message, "Error updating user (REF:DB18)")
                resolve(false)
            } else {
                resolve(true)
            }
        });
    });
}

/**
 * Delete a users
 * @parm {String}
 * @returns {Promise<Boolean>} Returns boolean of query
 */
 function DeleteUser(username) {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.all(`DELETE FROM users WHERE username = ?`, [username], (err, rows) => {
                if (err) {
                    newError(err.message, "Error accessing all user data (REF:DB17)")
                    resolve(false);
                } else {
                    resolve(true);
                }
            });
        });
    });
}

// Operators
/**
 * Returns record of specific Operator ID
 * @param {string} id - Unique id of operator 
 * @returns {Promise<operator>} Record for that operator
 */
 function GetOperator(id) {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.get(`SELECT * FROM operators WHERE id = ?`, [id], (err, row) => {
                if (err) {
                    newError(err.message, "Error accessing operator data (REF:DB19)")
                } else {
                    resolve(row);
                }
            });
        });
    });
}

/**
 * Returns all operators
 * @returns {Promise<Array.<{operator}>>} Operator objects in an array
 */
function GetOperators() {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.all(`SELECT * FROM operators`, (err, rows) => {
                if (err) {
                    newError(err.message, "Error accessing all operator data (REF:DB20)")
                } else {
                    resolve(rows);
                }
            });
        });
    });
}

/**
 * Creates a new operator
 * @param {string} operator - Name of operator
 * @returns {Promise<Boolean>} Returns boolean of query
 */
function CreateOperator(operator) {
    return new Promise((resolve, error) => {
        db.run(`INSERT INTO operators(operator) 
                VALUES(?)`, [operator], function (err) {
            if (err) {
                newError(err.message, "Error creating operator (REF:DB21)")
                resolve(false)
            } else {
                resolve(true)
            }
        });
    });
}

/**
 * Delete Operator
 * @param {String} id - Unique ID
 * @returns {Promise<Boolean>} Returns boolean of query
 */
 function DeleteOperator(id){
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.run(`DELETE FROM operators WHERE id = ?`, [id], (err) => {
                if (err) {
                    newError(err.message, "Error deleting operator (REF:DB22)")
                    resolve(false)
                } else {
                    resolve(true)
                }
            });
        });
    });
}

// Routes
/**
 * Returns record of specific Route ID
 * @param {string} id - Unique id of route 
 * @returns {Promise<route>} Record for that route
 */
 function GetRoute(id) {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.get(`SELECT * FROM routes WHERE id = ?`, [id], (err, row) => {
                if (err) {
                    newError(err.message, "Error accessing route data (REF:DB22)")
                } else {
                    resolve(row);
                }
            });
        });
    });
}

/**
 * Returns record of specific Route Name
 * @param {string} num - Number of route 
 * @returns {Promise<route>} Record for that route
 */
function GetRouteByNum(num) {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.get(`SELECT * FROM routes WHERE num = ?`, [num], (err, row) => {
                if (err) {
                    newError(err.message, "Error accessing route data (REF:DB223)")
                } else {
                    resolve(row);
                }
            });
        });
    });
}

/**
 * Returns all routes
 * @returns {Promise<Array.<{route}>>} Route objects in an array
 */
function GetRoutes() {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.all(`SELECT * FROM routes`, (err, rows) => {
                if (err) {
                    newError(err.message, "Error accessing all route data (REF:DB23)")
                } else {
                    resolve(rows);
                }
            });
        });
    });
}

/**
 * Creates a new route
 * @param {string} id - Unique identifier
 * @param {string} num - Flight Number
 * @param {number} ft - Flight Time 
 * @param {string} operator - Airline
 * @param {string} aircraft - Livery ID
 * @param {string} depICAO - Departing ICAO
 * @param {string} arrICAO - Arriving ICAO
 * @param {string} aircraftPublic - Common aircraft name
 * @param {string} operatorPublic - Common operator name
 * @param {string} minRank - Minimum rank to fly route
 * @returns {Promise<Boolean>} Returns boolean of query
 */
function CreateRoute(id, num, ft, operator, aircraft, depICAO, arrICAO, aircraftPublic, operatorPublic, minRank) {
    return new Promise((resolve, error) => {
        db.run(`INSERT INTO routes(id, num, ft, operator, aircraft, depICAO, arrICAO, aircraftPublic, operatorPublic, minRank) 
                VALUES(?,?,?,?,?,?,?,?,?,?)`, [id, num, ft, operator, aircraft, depICAO, arrICAO, aircraftPublic, operatorPublic, minRank], function (err) {
            if (err) {
                newError(err.message, "Error creating route (REF:DB24)")
                resolve(false)
            } else {
                resolve(true)
            }
        });
    });
}

/**
 * Update a route
 * @param {string} id - Unique identifier
 * @param {string} num - Flight Number
 * @param {number} ft - Flight Time 
 * @param {string} operator - Airline
 * @param {string} aircraft - Livery ID
 * @param {string} depICAO - Departing ICAO
 * @param {string} arrICAO - Arriving ICAO
 * @param {string} aircraftPublic - Common aircraft name
 * @param {string} operatorPublic - Common operator name
 * @param {string} minRank - Minimum rank to fly route
 * @returns {Promise<Boolean>} Returns boolean of query
 */
 function UpdateRoute(id, num, ft, operator, aircraft, depICAO, arrICAO, aircraftPublic, operatorPublic, minRank) {
    return new Promise((resolve, error) => {
        db.run(`UPDATE routes SET 
                num = ?,
                ft = ?,
                operator = ?,
                aircraft = ?,
                depICAO = ?,
                arrICAO = ?,
                aircraftPublic = ?,
                operatorPublic = ?,
                minRank = ?
                WHERE id = ?`, [num, ft, operator, aircraft, depICAO, arrICAO, aircraftPublic, operatorPublic, minRank, id], function (err) {
            if (err) {
                newError(err.message, "Error creating route (REF:DB24)")
                resolve(false)
            } else {
                resolve(true)
            }
        });
    });
}

/**
 * Delete route
 * @param {String} id - ID of route
 * @returns {Promise<Boolean>} Returns boolean of query
 */
 function DeleteRoute(id) {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.all(`DELETE FROM routes WHERE id = ?`, [id], (err, rows) => {
                if (err) {
                    newError(err.message, "Error deleting route (REF:DB23)")
                    resolve(false)
                } else {
                    resolve(true);
                }
            });
        });
    });
}

// Notifications
/**
 * Get all notifications for a user
 * @param {string} user User 
 * @returns {Promise<Array.<notification>>} Array of notifications for user
 */
function GetNotifications(user){
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.all(`SELECT * FROM notifications WHERE user = ?`, [user], (err, rows) => {
                if (err) {
                    newError(err.message, "Error accessing notification data (REF:DB25)")
                } else {
                    resolve(rows);
                }
            });
        });
    });
}

/**
 * Creates a new notification
 * @param {String} user - Username to assign the notification to
 * @param {String} title - Title of notification
 * @param {String} desc - Description of notification
 * @param {String} icon - Icon for notification
 * @param {String} timeStamp - Creation time stamp of notification
 * @param {String} link - Link for notification
 * @returns {Promise<Boolean>} Returns boolean of query
 */
function CreateNotification(user, title, desc, icon, timeStamp, link){
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.run(`INSERT INTO notifications(user, title, desc, icon, timeStamp, link)
                    VALUES(?,?,?,?,?,?)`, [user, title, desc, icon, timeStamp, link], (err) => {
                if (err) {
                    newError(err.message, "Error creating notification (REF:DB26)")
                    resolve(false)
                } else {
                    resolve(true)
                }
            });
            db.run(`DELETE FROM notifications WHERE id IN (SELECT id FROM notifications ORDER BY id DESC LIMIT -1 OFFSET 5) AND user = ?`, [user], (err) => {
                if (err) {
                    newError(err.message, "Error deleting notifications while creating notification (REF:DB27)")
                }
            })
        });
    });
}

/**
 * Delete notification
 * @param {String} id - Unique ID
 * @returns {Promise<Boolean>} Returns boolean of query
 */
 function DeleteNotification(id){
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.run(`DELETE FROM notifications WHERE id = ?`, [id], (err) => {
                if (err) {
                    newError(err.message, "Error deleting notification (REF:DB28)")
                    resolve(false)
                } else {
                    resolve(true)
                }
            });
        });
    });
}

/**
 * Delete all User's Notifications
 * @param {String} username - Username of user
 * @returns {Promise<Boolean>} Returns boolean of query
 */
 function DeleteUsersNotifications(username){
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.run(`DELETE FROM notifications WHERE user = ?`, [username], (err) => {
                if (err) {
                    newError(err.message, "Error deleting notification (REF:DB29)")
                    resolve(false)
                } else {
                    resolve(true)
                }
            });
        });
    });
}

// Stats
/**
 * Get all stats
 * @returns {Promise<Array.<statistic>>} Array of stats for VA
 */
 function GetStats(){
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.all(`SELECT * FROM stats`, (err, rows) => {
                if (err) {
                    newError(err.message, "Error accessing stats data (REF:DB30)")
                } else {
                    resolve(rows);
                }
            });
        });
    });
}

/**
 * Delete stat
 * @param {String} name - Name of stat
 * @returns {Promise<Boolean>} Returns boolean of query
 */
 function DeleteStat(name){
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.run(`DELETE FROM stats WHERE name = ?`, [name], (err) => {
                if (err) {
                    newError(err.message, "Error deleting stat (REF:DB31)")
                    resolve(false)
                } else {
                    resolve(true)
                }
            });
        });
    });
}
/**
 * Updates Stat
 * @param {String} name - Name of stat
 * @param {String} newName - New name for stat
 * @param {String} newValue - New value for stat
 * @returns {Promise<Boolean>} Returns boolean of query
 */
function UpdateStat(name, newName, newValue){
    return new Promise((resolve, error) => {
        db.serialize(() => {
            if (newName == null){
                db.run(`UPDATE stats SET
                        value = ?
                        WHERE name = ?`, [newValue, name], (err) => {
                    if (err) {
                        newError(err.message, "Error updating stat (REF:DB32)")
                        resolve(false)
                    } else {
                        resolve(true)
                    }
                })
            } else {
                db.run(`UPDATE stats SET
                        name = ?,
                        value = ?
                        WHERE name = ?`, [newName, newValue, name], (err) => {
                    if (err) {
                        newError(err.message, "Error updating stat (REF:DB33)")
                        resolve(false)
                    } else {
                        resolve(true)
                    }
                })
            }
        })
    })
}

// Ranks
/**
 * Get all ranks
 * @returns {Promise<Array.<rank>>} Array of ranks
 */
 function GetRanks(){
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.all(`SELECT * FROM ranks`, (err, rows) => {
                if (err) {
                    newError(err.message, "Error accessing rank data (REF:DB34)")
                } else {
                    resolve(rows);
                }
            });
        });
    });
}

/**
 * Delete rank
 * @param {String} rank - Name of rank
 * @returns {Promise<Boolean>} Returns boolean of query
 */
 function DeleteRank(rank){
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.run(`DELETE FROM ranks WHERE rank = ?`, [rank], (err) => {
                if (err) {
                    newError(err.message, "Error deleting stat (REF:DB35)")
                    resolve(false)
                } else {
                    resolve(true)
                }
            });
        });
    });
}

/**
 * Update rank
 * @param {String} name - Name of rank
 * @param {String} newName - New name for rank
 * @param {Number} newMinH - New minimun hours for rank
 * @returns {Promise<Boolean>} Returns boolean of query
 */
function UpdateRank(name, newName, newMinH){
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.run(`UPDATE ranks SET
                    rank = ?,
                    minH = ?
                    WHERE name = ?`, [newName, newMinH, name], (err) => {
                if (err) {
                    newError(err.message, "Error updating stat (REF:DB36)")
                    resolve(false)
                } else {
                    resolve(true)
                }
            })
        })
    })
}

/**
 * Creates a new rank
 * @param {String} rank - Name of rank
 * @param {Number} minH - Minimum hours
 * @returns {Promise<Boolean>} Returns boolean of query
 */
 function CreateRank(rank, minH) {
    return new Promise((resolve, error) => {
        db.run(`INSERT INTO ranks(rank, minH) VALUES(?, ?)`, [rank, minH], function (err) {
            if (err) {
                newError(err.message, "Error creating operator (REF:DB37)")
                resolve(false)
            } else {
                resolve(true)
            }
        });
    });
}

// Slots
/**
 * Get all slots
 * @returns {Promise<Array.<slot>>} Array of ranks
 */
function GetSlots() {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.all(`SELECT * FROM slots`, (err, rows) => {
                if (err) {
                    newError(err.message, "Error accessing slot data (REF:DB69)")
                } else {
                    resolve(rows);
                }
            });
        });
    });
}

function GetSlotsWithRoutes(){
    return new Promise((resolve, error) => {
        GetSlots().then((slots) => {
            slots.forEach(async slot => {
                slot.routeObj = await GetRoute(slot.route);
                console.log(slot)
            })
            setTimeout(() => {
                resolve(slots);
            }, 500)
          

        });
    })
}

/**
 * Delete slot
 * @param {String} slot - id of slot
 * @returns {Promise<Boolean>} Returns boolean of query
 */
function DeleteSlot(slot) {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.run(`DELETE FROM slots WHERE id = ?`, [slot], (err) => {
                if (err) {
                    newError(err.message, "Error deleting slot (REF:DB420)")
                    resolve(false)
                } else {
                    resolve(true)
                }
            });
        });
    });
}

/**
 * Update Slot
 * @param {String} id - id of slot
 * @param {String} route - route of slot
 * @param {String} newDepTime - New Departure time for slot
 * @param {String} newArrTime - New arrival time for slot
 * @returns {Promise<Boolean>} Returns boolean of query
 */
function UpdateSlot(id, route, newDepTime, newArrTime) {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.run(`UPDATE slots SET
                    route = ?,
                    depTime = ?,
                    arrTime = ?
                    WHERE id = ?`, [route, newDepTime, newArrTime, id], (err) => {
                if (err) {
                    newError(err.message, "Error updating slot (REF:DB360)")
                    resolve(false)
                } else {
                    resolve(true)
                }
            })
        })
    })
}

/**
 * Creates a new slot
 * @param {String} id - ID
 * @param {String} route - Route Name
 * @param {String} depTime - Departure Time
 * @param {String} arrTime - Arrival Time
 * @returns {Promise<Boolean>} Returns boolean of query
 */
function CreateSlot(id, route, depTime, arrTime) {
    if(id && route && depTime && arrTime){
    return new Promise((resolve, error) => {
        db.run(`INSERT INTO slots(route, depTime, arrTime) VALUES(?, ?, ?)`, [route, depTime, arrTime], function (err) {
            if (err) {
                newError(err.message, "Error creating slot (REF:DB720)")
                resolve(false)
            } else {
                resolve(true)
            }
        });
    });
    }else{
        console.log(id, route, depTime, arrTime)
    }
}

// Miscellaneous
/**
 * Returns the Profile Picture URL of a user
 * @param {string} username 
 * @returns {Promise<String>} Profile Picture URL
 */
function GetPPURL(username){
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.get(`SELECT profileURL FROM users WHERE username = ?`, [username], (err, row) => {
                if (err) {
                    newError(err.message, "Error accessing Profile Picture data (REF:DB38)")
                } else {
                    resolve(row);
                }
            });
        });
    });
}


module.exports = { 
    db, GetPPURL,
    GetAircraft, GetAircrafts, CreateAircraft, DeleteAircraft,
    GetEvent, GetEvents, CreateEvent, DeleteEvent,
    GetNotifications, CreateNotification, DeleteNotification, DeleteUsersNotifications,
    GetOperator, GetOperators, CreateOperator, DeleteOperator,
    GetPirep, GetUsersPireps, GetPireps, CreatePirep, UpdatePirep,
    GetRanks, UpdateRank, CreateRank, DeleteRank,
    GetRoute, GetRoutes, GetRouteByNum, CreateRoute, UpdateRoute, DeleteRoute,
    GetStats, UpdateStat, DeleteStat,
    GetToken, CreateToken, DeleteTokens,
    GetUser, GetUsers, CreateUser, UpdateUser, DeleteUser,
    CreateSlot, GetSlots, UpdateSlot, DeleteSlot, GetSlotsWithRoutes
    };