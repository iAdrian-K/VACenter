//@ts-check

const fs = require('fs');
const path = require('path');
const request = require('request');
const bcrypt = require('bcrypt');
const { FileWrite, FileRead, FileExists, FileRemove } = require('./fileFunctions.js');
const { JSONReq, URLReq, MethodValues } = require("./urlreqs");
const { default: async } = require('async');
let config;

/**
 * Relods the config file
 * @returns {Promise<true>} Operation Complete
 */
function reloadConfig() {
    return new Promise(async (resolve, error) => {
        config = JSON.parse(await FileRead(`${__dirname}/../config.json`));
        resolve(true);
        console.log(config)
    });

}

reloadConfig().then(() =>{
    
})

/**
 * Performs action on all elements of array
 * @param {Array} list 
 * @param {Function} action 
 * @returns {Promise<array>} The updated array
 */
function repeater(list, action){
    return new Promise(async (resolve, error)=>{
        const length = list.length;
        let counter = 0;
        list.forEach(item => {counter++;action(item)})
        let checker = setInterval(() => {
            if(counter == length){
                clearInterval(checker);
                resolve(list);
            }
        }, 100)
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
 * @typedef {import('./types.js').link} link
 * @typedef {import('./types.js').fsession} fsession
 */

/**@module VANet */

/**
 * Gets data from VANet
 * @returns {Promise<Array>} Array consisting of VANet Data
 */
function getVANetData(){
    return new Promise(async (resolve, reject) =>{
        if(config.key){
            const AircraftRequest = await URLReq("GET", "https://api.vanet.app/public/v1/aircraft", {}, null, null);
            const Aircraft = JSON.parse(AircraftRequest[2]).result;
            const AircraftMap = new Map();
            console.log(AircraftRequest[2])
            const AircraftArray = await repeater(Aircraft, function (item) {
                const itemH = JSON.parse(JSON.stringify(item));
                item = {
                    id: itemH.aircraftID,
                    name: itemH.aircraftName,
                    livery: [],
                    raw: itemH
                };
                item.livery.push({ id: itemH.liveryID, name: itemH.LiverName })
                AircraftMap.set(item.id, item)
            });
            resolve([AircraftMap]);
        }else{
            reject("No API Key provided.")
        }
    })
}

/**
 * Gets VANet ID of IFC User
 * @param {string} profileName 
 * @returns {Promise<string>} Returns ID of the user
 */
function getVANetUser(profileName){
    return new Promise(async (resolve, reject) =>{
        if (config.key) {
            const UserReqRaw = await JSONReq("GET", `https://api.vanet.app/airline/v1/user/id/${profileName}`, { "X-Api-Key": config.key }, null, null);
            const UserReq = JSON.parse(UserReqRaw[2]).result;            
            if(JSON.parse(UserReqRaw[2]).code == 0){
                resolve(UserReq);
            }else if(JSON.parse(UserReqRaw[2]).code == 6){
                reject("No user found")
            }else{
                reject("Error")
            }
        }else{
            reject("No API Key");
        }
    })
}

/**
 * Creates a new VANet PIREP
 * @param {string} pilotID 
 * @param {string} depICAO
 * @param {string} arrICAO
 * @param {string} date
 * @param {number} fuel 
 * @param {number} ft 
 * @param {string} aircraftLivID
 * @returns 
 */
function createVANetPirep(pilotID, depICAO, arrICAO, date, fuel, ft, aircraftLivID){
    console.log(pilotID, depICAO, arrICAO, date, fuel, ft, aircraftLivID)
    return new Promise(async (resolve, reject) =>{
        if(pilotID && depICAO && arrICAO && date && fuel && ft && aircraftLivID){
            (JSONReq("POST", "https://api.vanet.app/airline/v1/flights", { "X-Api-Key": config.key}, null, {
                pilotId: pilotID,
                departureICAO: depICAO,
                arrivalICAO: arrICAO,
                date: new Date(date).toUTCString(),
                fuelUsed: fuel,
                flightTime: ft/60,
                aircraftLiveryId: aircraftLivID
            })).then((state) =>{
                console.log(state[2]);
                resolve();
            })
        }else{
            reject("Missing Arguments")
        }
    })
}

module.exports = {getVANetData, getVANetUser, createVANetPirep}