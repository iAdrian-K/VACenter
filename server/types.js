//@ts-check

/**
 * @module Types
 */

/**
 * A user Object
 * @typedef {Object} user
 * @property {string} username
 * @property {string} rank
 * @property {0|1} manualRank
 * @property {string} password
 * @property {string} display
 * @property {number} hours
 * @property {boolean} admin
 * @property {string} profileURL
 * @property {string} created
 * @property {string} llogin
 * @property {boolean} cp - Change Password Flag
 * @property {number} revoked
 * @property {array} notifications
 * @property {array} pireps
 * @property {string} VANetID - the ID assigned by the VANet servers corresponding to the user's IFC profile.
 */

/**
 * A aircraft Object
 * @typedef {Object} aircraft
 * @property {string} livID
 * @property {string} airID
 * @property {string} livName
 * @property {string} airName
 * @property {string} publicName
 */

/**
 * A event Object
 * @typedef {Object} event
 * @property {string} title
 * @property {number} ID
 * @property {string} body
 * @property {string} arrAir
 * @property {string} depAir
 * @property {string} depTime
 * @property {string} air
 * @property {string} airName
 * @property {string} server
 * @property {Array} gates
 */

/**
 * A gate Object
 * @typedef {Object} gate
 * @property {number} id
 * @property {string} event
 * @property {string} gate
 * @property {boolean} taken
 */

/**
 * A notif Object
 * @typedef {Object} notification
 * @property {number} id
 * @property {string} user
 * @property {string} title
 * @property {string} desc
 * @property {string} icon
 * @property {string} timeStamp
 * @property {string} link
 */

/**
 * A operator Object
 * @typedef {Object} operator
 * @property {number} id
 * @property {string} name
 * @property {1|0} self
 * @property {string} code
 * @property {0|1} inuse
 */

/**
 * A PIREP Object
 * @typedef {Object} PIREP
 * @property {string} id
 * @property {string} vehicle
 * @property {string} vehiclePublic
 * @property {string} author
 * @property {number} operator
 * @property {string} depICAO
 * @property {string} arrICAO
 * @property {string} route
 * @property {number} flightTime
 * @property {string} comments
 * @property {number} fuel
 * @property {string} filed
 * @property {string} status
 * @property {string} rejectReason
 * @property {string} [pirepImg]
 */

/**
 * A rank Object
 * @typedef {Object} rank
 * @property {number} id
 * @property {string} label
 * @property {0|1} manual
 * @property {number} minH - Minimum Hours
 */

/**
 * A routes Object
 * @typedef {Object} route
 * @property {string} id
 * @property {string} num
 * @property {number} ft - Flight Time
 * @property {number} operator
 * @property {string} aircraft
 * @property {string} depICAO
 * @property {string} arrICAO
 * @property {string} aircraftPublic
 * @property {?string} operatorPublic
 * @property {?string} operatorCode
 * @property {string} minRank
 */

/**
 * A slot Object
 * @typedef {Object} slot
 * @property {number} id
 * @property {string} route
 * @property {string} depTime
 * @property {string} arrTime
 * @property {route} routeObj
 */

/**
 * A token Object
 * @typedef {Object} token
 * @property {string} token
 * @property {string} user
 */

/**
 * A stat Object
 * @typedef {Object} statistic
 * @property {string} type
 * @property {any} value
 */

/**
 * A link Object
 * @typedef {Object} link
 * @property {number} id
 * @property {string} title
 * @property {string} link
 */

/**
 * A Flight Session Object
 * @typedef {Object} fsession
 * @property {number} id
 * @property {string} pilot
 * @property {string} route
 * @property {string} slotID
 * @property {string} aircraft
 * @property {string} depTime
 * @property {string} arrTime
 * @property {number|boolean} active
 * @property {string} state 
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