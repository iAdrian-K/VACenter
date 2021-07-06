const atob = require("atob");
const btoa = require("btoa");
const path = require("path");
const sanitize = require("sanitize-filename");
const { FileRead, FileWrite, FileExists, FileRemove } = require("./fileFunctions");
const { URLReq, JSONReq } = require("./urlReqs");
const { mode, compareTime, arrayRemove, getAppCookies } = require("./util")
const publicPath = path.join(__dirname + '/../public')
const dataPath = path.join(__dirname + '/../data')
const usersPath = path.join(__dirname + '/../data/users')


function isAdminUser(tokens) {
    return new Promise(resolve => {
        if (tokens.authToken != undefined) {

            const unBased = atob(tokens.authToken)
            const userID = unBased.split(":")[0];
            const realTokenPreAdjust = unBased.split(":")[1];
            if (realTokenPreAdjust) {
                const realToken = realTokenPreAdjust.slice(0, realTokenPreAdjust.length - 1)
                const userExists = FileExists(`${usersPath}/` + sanitize(userID) + '.json').then(exists => {
                    if (exists) {
                        FileRead(`${usersPath}/` + sanitize(userID) + '.json').then(rawUser => {
                            const user = JSON.parse(rawUser)
                            const correctToken = user.tokens.includes(realToken);
                            if (correctToken) {
                                resolve(user.admin)
                            } else {
                                resolve(false)
                            }

                        })


                    } else {
                        resolve(false);
                    }
                })

            } else {
                resolve(false)
            }
        } else {
            resolve(false)
        }
    })
}

function isNormalUser(tokens) {
    return new Promise(resolve => {
        if (tokens.authToken != undefined) {

            const unBased = atob(tokens.authToken)
            const userID = unBased.split(":")[0];
            const realTokenPreAdjust = unBased.split(":")[1];
            if (realTokenPreAdjust) {
                const realToken = realTokenPreAdjust.length == 33 ? realTokenPreAdjust.slice(0, realTokenPreAdjust.length - 1) : realTokenPreAdjust
                const userExists = FileExists(`${usersPath}/` + sanitize(userID) + '.json').then(exists => {
                    if (exists) {
                        FileRead(`${usersPath}/` + sanitize(userID) + '.json').then(rawUser => {
                            const user = JSON.parse(rawUser)
                            const correctToken = (user.tokens.includes(realToken) && user.revoked == false);
                            resolve(correctToken);
                        })


                    } else {
                        resolve(false);
                    }
                })

            } else {
                resolve(false)
            }
        } else {
            resolve(false)
        }
    })

}

module.exports = {isAdminUser, isNormalUser}