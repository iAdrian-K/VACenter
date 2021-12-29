//@ts-check

/**
 * @module Types
 */

/**
 * A user Object
 * @typedef {Object} user
 * @property {String} username
 * @property {String} rank
 * @property {0|1} manualRank
 * @property {String} password
 * @property {String} display
 * @property {number} hours
 * @property {boolean} admin
 * @property {String} profileURL
 * @property {String} created
 * @property {String} llogin
 * @property {boolean} cp - Change Password Flag
 * @property {number} revoked
 * @property {array} notifications
 * @property {array} pireps
 * @property {String} VANetID - the ID assigned by the VANet servers corresponding to the user's IFC profile.
 */

/**
 * A aircraft Object
 * @typedef {Object} aircraft
 * @property {String} livID
 * @property {String} airID
 * @property {String} livName
 * @property {String} airName
 * @property {String} publicName
 */

/**
 * A event Object
 * @typedef {Object} event
 * @property {String} title
 * @property {number} ID
 * @property {String} body
 * @property {String} arrAir
 * @property {String} depAir
 * @property {String} depTime
 * @property {String} air
 * @property {String} airName
 * @property {String} server
 * @property {Array} gates
 */

/**
 * A gate Object
 * @typedef {Object} gate
 * @property {number} id
 * @property {String} event
 * @property {String} gate
 * @property {boolean} taken
 */

/**
 * A notif Object
 * @typedef {Object} notification
 * @property {number} id
 * @property {String} user
 * @property {String} title
 * @property {String} desc
 * @property {String} icon
 * @property {String} timeStamp
 * @property {String} link
 */

/**
 * A operator Object
 * @typedef {Object} operator
 * @property {number} id
 * @property {String} name
 * @property {1|0} self
 * @property {String} code
 * @property {0|1} inuse
 */

/**
 * A PIREP Object
 * @typedef {Object} PIREP
 * @property {String} id
 * @property {String} vehicle
 * @property {String} vehiclePublic
 * @property {String} author
 * @property {number} operator
 * @property {String} depICAO
 * @property {String} arrICAO
 * @property {String} route
 * @property {number} flightTime
 * @property {String} comments
 * @property {number} fuel
 * @property {String} filed
 * @property {String} status
 * @property {String} rejectReason
 * @property {String} [pirepImg]
 */

/**
 * A rank Object
 * @typedef {Object} rank
 * @property {number} id
 * @property {String} label
 * @property {0|1} manual
 * @property {number} minH - Minimum Hours
 */

/**
 * A routes Object
 * @typedef {Object} route
 * @property {String} id
 * @property {String} num
 * @property {number} ft - Flight Time
 * @property {number} operator
 * @property {String} aircraft
 * @property {String} depICAO
 * @property {String} arrICAO
 * @property {String} aircraftPublic
 * @property {?String} operatorPublic
 * @property {?String} operatorCode
 * @property {String} minRank
 */

/**
 * A slot Object
 * @typedef {Object} slot
 * @property {number} id
 * @property {String} route
 * @property {String} depTime
 * @property {String} arrTime
 * @property {route} routeObj
 */

/**
 * A token Object
 * @typedef {Object} token
 * @property {String} token
 * @property {String} user
 */

/**
 * A stat Object
 * @typedef {Object} statistic
 * @property {String} type
 * @property {any} value
 */

/**
 * A link Object
 * @typedef {Object} link
 * @property {number} id
 * @property {String} title
 * @property {String} link
 */

/**
 * A Flight Session Object
 * @typedef {Object} fsession
 * @property {number} id
 * @property {String} pilot
 * @property {String} route
 * @property {String} slotID
 * @property {String} aircraft
 * @property {String} depTime
 * @property {String} arrTime
 * @property {number|boolean} active
 * @property {String} state 
 */

/**
 * A Multiplier Object
 * @typedef {Object} Multiplier
 * @property {number} id
 * @property {String} label
 * @property { String|Number } amount - Floating point number (or String of number) to multiply;
 */

const colours = {
    Reset: "\x1b[0m",
    Bright: "\x1b[1m",
    Dim: "\x1b[2m",
    Underscore: "\x1b[4m",
    Blink: "\x1b[5m",
    Reverse: "\x1b[7m",
    Hidden: "\x1b[8m",
    FgBlack: "\x1b[30m",
    FgRed: "\x1b[31m",
    FgGreen: "\x1b[32m",
    FgYellow: "\x1b[33m",
    FgBlue: "\x1b[34m",
    FgMagenta: "\x1b[35m",
    FgCyan: "\x1b[36m",
    FgWhite: "\x1b[37m",
    BgBlack: "\x1b[40m",
    BgRed: "\x1b[41m",
    BgGreen: "\x1b[42m",
    BgYellow: "\x1b[43m",
    BgBlue: "\x1b[44m",
    BgMagenta: "\x1b[45m",
    BgCyan: "\x1b[46m",
    BgWhite: "\x1b[47m"
}

module.exports = {};