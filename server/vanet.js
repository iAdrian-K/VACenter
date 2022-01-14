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
const AircraftMap = new Map();
function getVANetData(){
    return new Promise(async (resolve, reject) =>{
        if(config.key){
            const AircraftRequest = await URLReq("GET", "https://api.vanet.app/public/v1/aircraft", {"X-Api-Key": config.key}, null, null);
            const Aircraft = JSON.parse(AircraftRequest[2]).result;
            const AircraftArray = await repeater(Aircraft, function (item) {
                if(AircraftMap.has(item.aircraftID)){
                    const mapEl = AircraftMap.get(item.aircraftID);
                    mapEl.livery.push({ id: item.liveryID, name: item.liveryName })
                    AircraftMap.set(mapEl.id, mapEl)
                }else{
                    const data = {
                        id: item.aircraftID,
                        name: item.aircraftName,
                        livery: [{ id: item.liveryID, name: item.liveryName }],
                        raw: item
                    };
                    AircraftMap.set(data.id, data)
                }
            });
            resolve(AircraftMap);
        }else{
            await reloadConfig();
            const apiReq = await URLReq("GET", "https://api.va-center.com/VVCL/getAircraft", {"Content-Type": "application/x-www-form-urlencoded"}, null, {id: config.other.ident});
            const requestRes = apiReq[2];

            resolve(jsonToMap(requestRes));
            
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
            const UserReq = UserReqRaw[2].result;            
            if(UserReqRaw[2].status == 0){
                resolve(UserReq);
            }else if(UserReqRaw[2].status == 6){
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
                resolve();
            })
        }else{
            reject("Missing Arguments")
        }
    })
}

module.exports = {getVANetData, getVANetUser, createVANetPirep}

function mapToJson(map) {
    return JSON.stringify([...map]);
}
function jsonToMap(jsonStr) {
    return new Map(JSON.parse(jsonStr));
}