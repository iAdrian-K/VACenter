//@ts-check

//Dependancies
const fs = require('fs');
var sanitizer = require('sanitizer');
const path = require('path');
const bcrypt = require('bcrypt');
const chalk = require('chalk');
var bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const rateLimit = require("express-rate-limit");
const checkDiskSpace = require("check-disk-space").default;
var multer = require('multer');
const OS = require('os');
require('dotenv').config()
const tinify = require("tinify");
tinify.key = "KfplF6KmZjMWXfFx8vqrXM8r4Wbtyqtp";
const express = require('express');
const Sentry = require("@sentry/node");
const Tracing = require("@sentry/tracing");
const csv = require('csvtojson')
const request = require('request');
const atob = require('atob');
let operatorSearchable = new Map();

let hosting = process.env.HOSTFLAG ? true : false;



//Storage
let store = [];
let rootPath = "";
switch(OS.type()){
    case "Windows_NT":
        rootPath = ((__dirname).split(':'))[0] + ":/";
        break;
    case "Darwin":
        rootPath = "/";
        break;
    case "Linux":
        rootPath = "/";
        break;
}
var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, `${__dirname}/../data/images/`)
    },
    filename: function (req, file, cb) {
        cb(null, `${Date.now()}`) //Appending extension
    }
})
var upload = multer({ storage: storage });

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
checkDiskSpace(rootPath).then((diskSpace) => {
    store.push(((diskSpace.size - diskSpace.free) / diskSpace.size ) * 100)
    store.push(formatBytes((diskSpace.size - diskSpace.free), 2))
    store.push(formatBytes(diskSpace.size, 2))
})

//Parts
const { FileWrite, FileRead, FileExists, FileRemove } = require('./fileFunctions.js')
const { JSONReq, URLReq, MethodValues } = require("./urlreqs")
const { 
        db, GetPPURL,
        GetAircraft, GetAircrafts, CreateAircraft, DeleteAircraft,
        GetEvent, GetEvents, CreateEvent, DeleteEvent,
        GetNotifications, CreateNotification, DeleteNotification, DeleteUsersNotifications,
        GetOperatorByName, GetOperator, GetOperators, CreateOperator, DeleteOperator,
        GetPirep, GetUsersPireps, GetPireps, CreatePirep, UpdatePirep,
        GetRank, GetRanks, UpdateRank, CreateRank, DeleteRank,
        GetRoute, GetRoutes, GetRouteByNum, CreateRoute, UpdateRoute, DeleteRoute,
        GetStats, UpdateStat, DeleteStat,
        GetToken, CreateToken, DeleteTokens,
        GetUser, GetUsers, CreateUser, UpdateUser, DeleteUser, run,
        GetLinks, CreateLink, DeleteLink,
        CreateSession, GetSession, GetSessionByPilot, UpdateSession, DeleteSession,
        CreateMulti, GetMultipliers, GetMultiplier, GetMultiplierByLabel, DeleteMulti
    } = require("./db")
const { getVersionInfo } = require("./update");
const { getVANetData, getVANetUser, createVANetPirep } = require('./vanet.js');
const webhook = require("./webhook.js");
//update();

let routeSearchable = new Map();
function resetRoutes(){
    routeSearchable = new Map();
    GetRoutes().then(list =>{
        list.forEach(route =>{
            routeSearchable.set(route.id, route)
        })
        
    })
}

resetRoutes();

function resetOperators(){
    operatorSearchable = new Map();
    GetOperators().then(list => {
        list.forEach(op=>{
            operatorSearchable.set(op.id, op)
        })
    })
}
resetOperators()

async function reloadUserRanks(){
    (await GetUsers()).forEach(async user =>{
        //@ts-ignore
        user.rank = await testRank(user);
        //@ts-ignore
        UpdateUser(user.username, user.rank, user.admin, user.password, user.display, user.profileURL, user.hours, user.created, user.llogin, user.cp, user.revoked, user.VANetID, user.manualRank)
    })
}
reloadUserRanks()


let rankMap = new Map();
function loadRanksMap(){
    rankMap = new Map();
    GetRanks().then(list =>{
        list.forEach(rank =>{
            rankMap.set(rank.label, rank);
        })
    })
}
loadRanksMap();

//Versioning
let branch = getVersionInfo().branch;
let cvn = getVersionInfo().version;
let cvnb = branch == "beta" ? `${cvn}B` : (branch == "alpha" ? `${cvn}A` : `${cvn}M`)
/**
 * Used for checking the version info
 */
function reloadVersion(){
    cvn = getVersionInfo().version;
    cvnb = branch == "beta" ? `${cvn}B` : (branch == "alpha" ? `${cvn}A` : `${cvn}M`)
}

reloadVersion();

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
 * @typedef {import('./types.js').statistic} statistic
 * @typedef {import('./types.js').link} link
 * @typedef {import('./types.js').fsession} fsession
 * @typedef {import('./types.js').Multiplier} Multiplier
 */
function makeid(length) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() *
            charactersLength));
    }
    return result;
}

function randomizator(a, b) {
    return Math.floor(Math.random() * b) + a;
}
const getAppCookies = (req) => {
    if (req.headers.cookie) {
        // We extract the raw cookies from the request headers
        const rawCookies = req.headers.cookie.split('; ');
        // rawCookies = ['myapp=secretcookie, 'analytics_cookie=beacon;']

        const parsedCookies = {};
        rawCookies.forEach(rawCookie => {
            const parsedCookie = rawCookie.split('=');
            // parsedCookie = ['myapp', 'secretcookie'], ['analytics_cookie', 'beacon']
            parsedCookies[parsedCookie[0]] = parsedCookie[1];
        });
        return parsedCookies;
    } else {
        return {};
    }
};
function mode(array) {
    if (array.length == 0)
        return null;
    var modeMap = {};
    var maxEl = array[0], maxCount = 1;
    for (var i = 0; i < array.length; i++) {
        var el = array[i];
        if (modeMap[el] == null)
            modeMap[el] = 1;
        else
            modeMap[el]++;
        if (modeMap[el] > maxCount) {
            maxEl = el;
            maxCount = modeMap[el];
        }
    }
    return maxEl;
}

//Config
let config = {
    other: {
        rates: 100,
        applications:{
            state: false,
            link: ""
        }
    }
};

function getConfig() {
    // @ts-ignore
    return JSON.parse(fs.readFileSync(`${__dirname}/../config.json`));
    //return require("./../config.json");
}

/**
 * Reloads Config
 * @name Reload Config
 */
function reloadConfig(){
    return new Promise((resolve, error)=>{
            config = getConfig();
            resolve(true);
    })
    
}



reloadConfig()
setInterval(reloadConfig, 15000);

let stats = {};

/**
 * Reload Stats for VA
 * @returns {Promise}
 */

function reloadStats(){
    return new Promise(async (resolve) => {
        stats = await GetStats();
        resolve(true);
    })
}

function compareRanks(a, b) {
    if (a.minH < b.minH) {
        return -1;
    }
    if (a.minH > b.minH) {
        return 1;
    }
    return 0;
}

/**
 * 
 * @param {user} ownerObj 
 * @returns {Promise<(any)>}
 */
const testRank = async (ownerObj) =>{
    let store = ownerObj.rank;
    return new Promise(async resolve =>{
        if(ownerObj){
            if(ownerObj.manualRank != 1){
                const ranks = await GetRanks();
                ranks.sort(compareRanks);
                for (var i = 0; i < ranks.length; i++){
                    let rank = ranks[i];
                    if(rank.manual == 0){
                        if(ownerObj.hours >= rank.minH){
                            ownerObj.rank = rank.label;
                        }
                    }
                }
                if (store != ownerObj.rank && config.other) {
                    webhook.send({ title: "Rank up!", description: `${config.code}${ownerObj.username} has achieved the rank of ${ownerObj.rank}` });
                }
                resolve(ownerObj.rank);
            }else{
                resolve(ownerObj.rank)
            }
        }else{
            resolve(false);
        }
    })
}

const updateStats = async () => {
    //Craft
    let craftArray = [];
    stats.popularCraft = "";
    (await GetPireps()).forEach(pirep => {
        craftArray.push(pirep.vehiclePublic)
    })
    stats.popularCraft = mode(craftArray);
    //Lead Pilots
    stats.leadPilot = ["Unknown", 0];
    (await GetUsers()).forEach(user => {
        if(stats.leadPilot[0] == "Unknown"){
            // @ts-ignore
            stats.leadPilot = [user.username, user.hours];
        }
        // @ts-ignore
        if(user.hours > stats.leadPilot[1]){
            // @ts-ignore
            stats.leadPilot = [user.username, user.hours];
        }
        
    })
    //Hours + PIREPS
    stats.totalHours = 0;
    stats.pirepsLength = 0;
    (await GetPireps()).forEach(pirep =>{
        stats.pirepsLength++;
        if(pirep.status == "a"){
            stats.totalHours = stats.totalHours + (pirep.flightTime)/60
        }
    })
}
setInterval(updateStats, 120000)
updateStats();

let vanetCraft = new Map();


setInterval(async () => {
    if (config.other) {
        if (config.other.ident) {
            vanetCraft = (await getVANetData());
        }
    }
}, 1000 * 60 * 30);
setTimeout(async () => {
    if (config.other) {
        if(config.other.ident){
            vanetCraft = (await getVANetData());
        }
    }
}, 5000);




//App
const app = express();
//Sentry
Sentry.init({
    dsn: "https://770628b2aa5447f8906e75e5c4904c48@o996992.ingest.sentry.io/5955471",
    integrations: [
        // enable HTTP calls tracing
        new Sentry.Integrations.Http({ tracing: true }),
        // enable Express.js middleware tracing
        new Tracing.Integrations.Express({ app }),
    ],
    environment: "Production",
    // Set tracesSampleRate to 1.0 to capture 100%
    // of transactions for performance monitoring.
    // We recommend adjusting this value in production
    tracesSampleRate: 1.0,
});
//app.use(Sentry.Handlers.requestHandler());
//app.use(Sentry.Handlers.tracingHandler());
app.set('view engine', "ejs");
app.set('views', path.join(__dirname, '/../views'));
console.log(chalk.green("Starting VACenter"))
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
app.use(function(req,res,next){
    res.locals.rank_search = rankMap;
    res.locals.version = cvnb;
    res.locals.operator_search = operatorSearchable;
    res.locals.route_search = routeSearchable;
    next();
})
let limiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 200 // limit each IP to 200 requests per windowMs
});
app.use(limiter);
//app.use(cookieParser());

//Util Funcs


/**
 * Removes the pain of foreign languages
 * @param {String} str 
 * @returns {String}
 */
function removeDiacritics(str) {

    var defaultDiacriticsRemovalMap = [
        { 'base': 'A', 'letters': /[\u0041\u24B6\uFF21\u00C0\u00C1\u00C2\u1EA6\u1EA4\u1EAA\u1EA8\u00C3\u0100\u0102\u1EB0\u1EAE\u1EB4\u1EB2\u0226\u01E0\u00C4\u01DE\u1EA2\u00C5\u01FA\u01CD\u0200\u0202\u1EA0\u1EAC\u1EB6\u1E00\u0104\u023A\u2C6F]/g },
        { 'base': 'AA', 'letters': /[\uA732]/g },
        { 'base': 'AE', 'letters': /[\u00C6\u01FC\u01E2]/g },
        { 'base': 'AO', 'letters': /[\uA734]/g },
        { 'base': 'AU', 'letters': /[\uA736]/g },
        { 'base': 'AV', 'letters': /[\uA738\uA73A]/g },
        { 'base': 'AY', 'letters': /[\uA73C]/g },
        { 'base': 'B', 'letters': /[\u0042\u24B7\uFF22\u1E02\u1E04\u1E06\u0243\u0182\u0181]/g },
        { 'base': 'C', 'letters': /[\u0043\u24B8\uFF23\u0106\u0108\u010A\u010C\u00C7\u1E08\u0187\u023B\uA73E]/g },
        { 'base': 'D', 'letters': /[\u0044\u24B9\uFF24\u1E0A\u010E\u1E0C\u1E10\u1E12\u1E0E\u0110\u018B\u018A\u0189\uA779]/g },
        { 'base': 'DZ', 'letters': /[\u01F1\u01C4]/g },
        { 'base': 'Dz', 'letters': /[\u01F2\u01C5]/g },
        { 'base': 'E', 'letters': /[\u0045\u24BA\uFF25\u00C8\u00C9\u00CA\u1EC0\u1EBE\u1EC4\u1EC2\u1EBC\u0112\u1E14\u1E16\u0114\u0116\u00CB\u1EBA\u011A\u0204\u0206\u1EB8\u1EC6\u0228\u1E1C\u0118\u1E18\u1E1A\u0190\u018E]/g },
        { 'base': 'F', 'letters': /[\u0046\u24BB\uFF26\u1E1E\u0191\uA77B]/g },
        { 'base': 'G', 'letters': /[\u0047\u24BC\uFF27\u01F4\u011C\u1E20\u011E\u0120\u01E6\u0122\u01E4\u0193\uA7A0\uA77D\uA77E]/g },
        { 'base': 'H', 'letters': /[\u0048\u24BD\uFF28\u0124\u1E22\u1E26\u021E\u1E24\u1E28\u1E2A\u0126\u2C67\u2C75\uA78D]/g },
        { 'base': 'I', 'letters': /[\u0049\u24BE\uFF29\u00CC\u00CD\u00CE\u0128\u012A\u012C\u0130\u00CF\u1E2E\u1EC8\u01CF\u0208\u020A\u1ECA\u012E\u1E2C\u0197]/g },
        { 'base': 'J', 'letters': /[\u004A\u24BF\uFF2A\u0134\u0248]/g },
        { 'base': 'K', 'letters': /[\u004B\u24C0\uFF2B\u1E30\u01E8\u1E32\u0136\u1E34\u0198\u2C69\uA740\uA742\uA744\uA7A2]/g },
        { 'base': 'L', 'letters': /[\u004C\u24C1\uFF2C\u013F\u0139\u013D\u1E36\u1E38\u013B\u1E3C\u1E3A\u0141\u023D\u2C62\u2C60\uA748\uA746\uA780]/g },
        { 'base': 'LJ', 'letters': /[\u01C7]/g },
        { 'base': 'Lj', 'letters': /[\u01C8]/g },
        { 'base': 'M', 'letters': /[\u004D\u24C2\uFF2D\u1E3E\u1E40\u1E42\u2C6E\u019C]/g },
        { 'base': 'N', 'letters': /[\u004E\u24C3\uFF2E\u01F8\u0143\u00D1\u1E44\u0147\u1E46\u0145\u1E4A\u1E48\u0220\u019D\uA790\uA7A4]/g },
        { 'base': 'NJ', 'letters': /[\u01CA]/g },
        { 'base': 'Nj', 'letters': /[\u01CB]/g },
        { 'base': 'O', 'letters': /[\u004F\u24C4\uFF2F\u00D2\u00D3\u00D4\u1ED2\u1ED0\u1ED6\u1ED4\u00D5\u1E4C\u022C\u1E4E\u014C\u1E50\u1E52\u014E\u022E\u0230\u00D6\u022A\u1ECE\u0150\u01D1\u020C\u020E\u01A0\u1EDC\u1EDA\u1EE0\u1EDE\u1EE2\u1ECC\u1ED8\u01EA\u01EC\u00D8\u01FE\u0186\u019F\uA74A\uA74C]/g },
        { 'base': 'OI', 'letters': /[\u01A2]/g },
        { 'base': 'OO', 'letters': /[\uA74E]/g },
        { 'base': 'OU', 'letters': /[\u0222]/g },
        { 'base': 'P', 'letters': /[\u0050\u24C5\uFF30\u1E54\u1E56\u01A4\u2C63\uA750\uA752\uA754]/g },
        { 'base': 'Q', 'letters': /[\u0051\u24C6\uFF31\uA756\uA758\u024A]/g },
        { 'base': 'R', 'letters': /[\u0052\u24C7\uFF32\u0154\u1E58\u0158\u0210\u0212\u1E5A\u1E5C\u0156\u1E5E\u024C\u2C64\uA75A\uA7A6\uA782]/g },
        { 'base': 'S', 'letters': /[\u0053\u24C8\uFF33\u1E9E\u015A\u1E64\u015C\u1E60\u0160\u1E66\u1E62\u1E68\u0218\u015E\u2C7E\uA7A8\uA784]/g },
        { 'base': 'T', 'letters': /[\u0054\u24C9\uFF34\u1E6A\u0164\u1E6C\u021A\u0162\u1E70\u1E6E\u0166\u01AC\u01AE\u023E\uA786]/g },
        { 'base': 'TZ', 'letters': /[\uA728]/g },
        { 'base': 'U', 'letters': /[\u0055\u24CA\uFF35\u00D9\u00DA\u00DB\u0168\u1E78\u016A\u1E7A\u016C\u00DC\u01DB\u01D7\u01D5\u01D9\u1EE6\u016E\u0170\u01D3\u0214\u0216\u01AF\u1EEA\u1EE8\u1EEE\u1EEC\u1EF0\u1EE4\u1E72\u0172\u1E76\u1E74\u0244]/g },
        { 'base': 'V', 'letters': /[\u0056\u24CB\uFF36\u1E7C\u1E7E\u01B2\uA75E\u0245]/g },
        { 'base': 'VY', 'letters': /[\uA760]/g },
        { 'base': 'W', 'letters': /[\u0057\u24CC\uFF37\u1E80\u1E82\u0174\u1E86\u1E84\u1E88\u2C72]/g },
        { 'base': 'X', 'letters': /[\u0058\u24CD\uFF38\u1E8A\u1E8C]/g },
        { 'base': 'Y', 'letters': /[\u0059\u24CE\uFF39\u1EF2\u00DD\u0176\u1EF8\u0232\u1E8E\u0178\u1EF6\u1EF4\u01B3\u024E\u1EFE]/g },
        { 'base': 'Z', 'letters': /[\u005A\u24CF\uFF3A\u0179\u1E90\u017B\u017D\u1E92\u1E94\u01B5\u0224\u2C7F\u2C6B\uA762]/g },
        { 'base': 'a', 'letters': /[\u0061\u24D0\uFF41\u1E9A\u00E0\u00E1\u00E2\u1EA7\u1EA5\u1EAB\u1EA9\u00E3\u0101\u0103\u1EB1\u1EAF\u1EB5\u1EB3\u0227\u01E1\u00E4\u01DF\u1EA3\u00E5\u01FB\u01CE\u0201\u0203\u1EA1\u1EAD\u1EB7\u1E01\u0105\u2C65\u0250]/g },
        { 'base': 'aa', 'letters': /[\uA733]/g },
        { 'base': 'ae', 'letters': /[\u00E6\u01FD\u01E3]/g },
        { 'base': 'ao', 'letters': /[\uA735]/g },
        { 'base': 'au', 'letters': /[\uA737]/g },
        { 'base': 'av', 'letters': /[\uA739\uA73B]/g },
        { 'base': 'ay', 'letters': /[\uA73D]/g },
        { 'base': 'b', 'letters': /[\u0062\u24D1\uFF42\u1E03\u1E05\u1E07\u0180\u0183\u0253]/g },
        { 'base': 'c', 'letters': /[\u0063\u24D2\uFF43\u0107\u0109\u010B\u010D\u00E7\u1E09\u0188\u023C\uA73F\u2184]/g },
        { 'base': 'd', 'letters': /[\u0064\u24D3\uFF44\u1E0B\u010F\u1E0D\u1E11\u1E13\u1E0F\u0111\u018C\u0256\u0257\uA77A]/g },
        { 'base': 'dz', 'letters': /[\u01F3\u01C6]/g },
        { 'base': 'e', 'letters': /[\u0065\u24D4\uFF45\u00E8\u00E9\u00EA\u1EC1\u1EBF\u1EC5\u1EC3\u1EBD\u0113\u1E15\u1E17\u0115\u0117\u00EB\u1EBB\u011B\u0205\u0207\u1EB9\u1EC7\u0229\u1E1D\u0119\u1E19\u1E1B\u0247\u025B\u01DD]/g },
        { 'base': 'f', 'letters': /[\u0066\u24D5\uFF46\u1E1F\u0192\uA77C]/g },
        { 'base': 'g', 'letters': /[\u0067\u24D6\uFF47\u01F5\u011D\u1E21\u011F\u0121\u01E7\u0123\u01E5\u0260\uA7A1\u1D79\uA77F]/g },
        { 'base': 'h', 'letters': /[\u0068\u24D7\uFF48\u0125\u1E23\u1E27\u021F\u1E25\u1E29\u1E2B\u1E96\u0127\u2C68\u2C76\u0265]/g },
        { 'base': 'hv', 'letters': /[\u0195]/g },
        { 'base': 'i', 'letters': /[\u0069\u24D8\uFF49\u00EC\u00ED\u00EE\u0129\u012B\u012D\u00EF\u1E2F\u1EC9\u01D0\u0209\u020B\u1ECB\u012F\u1E2D\u0268\u0131]/g },
        { 'base': 'j', 'letters': /[\u006A\u24D9\uFF4A\u0135\u01F0\u0249]/g },
        { 'base': 'k', 'letters': /[\u006B\u24DA\uFF4B\u1E31\u01E9\u1E33\u0137\u1E35\u0199\u2C6A\uA741\uA743\uA745\uA7A3]/g },
        { 'base': 'l', 'letters': /[\u006C\u24DB\uFF4C\u0140\u013A\u013E\u1E37\u1E39\u013C\u1E3D\u1E3B\u017F\u0142\u019A\u026B\u2C61\uA749\uA781\uA747]/g },
        { 'base': 'lj', 'letters': /[\u01C9]/g },
        { 'base': 'm', 'letters': /[\u006D\u24DC\uFF4D\u1E3F\u1E41\u1E43\u0271\u026F]/g },
        { 'base': 'n', 'letters': /[\u006E\u24DD\uFF4E\u01F9\u0144\u00F1\u1E45\u0148\u1E47\u0146\u1E4B\u1E49\u019E\u0272\u0149\uA791\uA7A5]/g },
        { 'base': 'nj', 'letters': /[\u01CC]/g },
        { 'base': 'o', 'letters': /[\u006F\u24DE\uFF4F\u00F2\u00F3\u00F4\u1ED3\u1ED1\u1ED7\u1ED5\u00F5\u1E4D\u022D\u1E4F\u014D\u1E51\u1E53\u014F\u022F\u0231\u00F6\u022B\u1ECF\u0151\u01D2\u020D\u020F\u01A1\u1EDD\u1EDB\u1EE1\u1EDF\u1EE3\u1ECD\u1ED9\u01EB\u01ED\u00F8\u01FF\u0254\uA74B\uA74D\u0275]/g },
        { 'base': 'oi', 'letters': /[\u01A3]/g },
        { 'base': 'ou', 'letters': /[\u0223]/g },
        { 'base': 'oo', 'letters': /[\uA74F]/g },
        { 'base': 'p', 'letters': /[\u0070\u24DF\uFF50\u1E55\u1E57\u01A5\u1D7D\uA751\uA753\uA755]/g },
        { 'base': 'q', 'letters': /[\u0071\u24E0\uFF51\u024B\uA757\uA759]/g },
        { 'base': 'r', 'letters': /[\u0072\u24E1\uFF52\u0155\u1E59\u0159\u0211\u0213\u1E5B\u1E5D\u0157\u1E5F\u024D\u027D\uA75B\uA7A7\uA783]/g },
        { 'base': 's', 'letters': /[\u0073\u24E2\uFF53\u00DF\u015B\u1E65\u015D\u1E61\u0161\u1E67\u1E63\u1E69\u0219\u015F\u023F\uA7A9\uA785\u1E9B]/g },
        { 'base': 't', 'letters': /[\u0074\u24E3\uFF54\u1E6B\u1E97\u0165\u1E6D\u021B\u0163\u1E71\u1E6F\u0167\u01AD\u0288\u2C66\uA787]/g },
        { 'base': 'tz', 'letters': /[\uA729]/g },
        { 'base': 'u', 'letters': /[\u0075\u24E4\uFF55\u00F9\u00FA\u00FB\u0169\u1E79\u016B\u1E7B\u016D\u00FC\u01DC\u01D8\u01D6\u01DA\u1EE7\u016F\u0171\u01D4\u0215\u0217\u01B0\u1EEB\u1EE9\u1EEF\u1EED\u1EF1\u1EE5\u1E73\u0173\u1E77\u1E75\u0289]/g },
        { 'base': 'v', 'letters': /[\u0076\u24E5\uFF56\u1E7D\u1E7F\u028B\uA75F\u028C]/g },
        { 'base': 'vy', 'letters': /[\uA761]/g },
        { 'base': 'w', 'letters': /[\u0077\u24E6\uFF57\u1E81\u1E83\u0175\u1E87\u1E85\u1E98\u1E89\u2C73]/g },
        { 'base': 'x', 'letters': /[\u0078\u24E7\uFF58\u1E8B\u1E8D]/g },
        { 'base': 'y', 'letters': /[\u0079\u24E8\uFF59\u1EF3\u00FD\u0177\u1EF9\u0233\u1E8F\u00FF\u1EF7\u1E99\u1EF5\u01B4\u024F\u1EFF]/g },
        { 'base': 'z', 'letters': /[\u007A\u24E9\uFF5A\u017A\u1E91\u017C\u017E\u1E93\u1E95\u01B6\u0225\u0240\u2C6C\uA763]/g }
    ];

    for (var i = 0; i < defaultDiacriticsRemovalMap.length; i++) {
        str = str.replace(defaultDiacriticsRemovalMap[i].letters, defaultDiacriticsRemovalMap[i].base);
    }

    return str;

}

/**
 * GetConfig - Used for every request;
 * @returns {Object}
 */


//Test for Applications
let appConfig = getConfig();
if(appConfig.other){
    if(appConfig.other.applications){

    } else {
        appConfig.other.applications = {
            state: false,
            link: ""
        }
        fs.writeFileSync(`${__dirname}/../config.json`, JSON.stringify(appConfig, null, 2));
    }
}

/**
 * CheckCPWD - Used for checking if a user needs to change their password.
 * @param {Object} cookies 
 * @returns {Promise<boolean>}
 */
function checkForCPWD(cookies) {
    return new Promise((async resolve => {
        if (cookies.authToken) {
            const UID = await GetToken(cookies.authToken)
            if (UID) {
                if(UID.user){
                const user = await GetUser(UID.user);
                if (user) {
                    if (user.cp) {
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                } else {
                    resolve(false);
                }
            }else{
                resolve(false)
            }
            } else {
                resolve(false);
            }
        } else {
            resolve(false);
        }
    }))
}

/**
 * Check for User
 * @param {Object} cookies 
 * @returns {Promise<boolean|Object>} User Obj, or False
 */
function checkForUser(cookies){
    return new Promise((async resolve => {
        if(cookies.authToken){
            const Token = await GetToken(cookies.authToken)
            if (Token) {
                if(Token.user){
                    const user = await GetUser(Token.user);
                    if (user) {
                        resolve(user);
                    } else {
                        resolve(false);
                    }
                }else{
                    resolve(false)
                }
            } else {
                resolve(false);
            }
        }else{
            resolve(false);
        }
    }))
}

/**
 * Add a users notifications to an object
 * @param {user} userObj 
 * @param {array} flags
 * @returns {Promise<user>} User with Flagged data
 */
async function getUserWithObjs(userObj, flags){
    return new Promise((async resolve => {
        if(flags.includes('notifications')){
            const notfs = await GetNotifications(userObj.username)
            userObj.notifications = notfs;
        }
        if(flags.includes('pireps')){
            const pireps = await GetUsersPireps(userObj.username)
            userObj.pireps = pireps;
        }
        resolve(userObj);
    }))
}

async function getRoutesWithOperator(){
    return new Promise(async (resolve, error)=>{
        const routes = await GetRoutes();
        let ticker = 0;
        routes.forEach(async route => {
            route.operatorPublic = (await GetOperator(route.operator)).name;
            route.operatorCode = (await GetOperator(route.operator)).code;
            ticker++;
        })
        let checker = setInterval(()=>{
            if(ticker >= routes.length){
                clearInterval(checker);
                resolve(routes);
            }
        }, 100);
    })
}

async function getRouteWithOperator(id){
    return new Promise(async (resolve, error) => {
        const route = await GetRoute(id);
        route.operatorPublic = (await GetOperator(route.operator)).name;
        route.operatorCode = (await GetOperator(route.operator)).code;
        resolve(route);
    })
}

//Basic Routes

app.get('/api/data/user/:callsign', async (req, res) => {
    if(req.query.auth){
        if(req.query.auth == config.other.ident.slice(0,5)){
            if (req.params.callsign) {
                let callsign = req.params.callsign.toString();
                if (callsign.toString().slice(0, 4) == config.code) {
                    callsign = callsign.slice(4, callsign.length);
                }
                let user = await GetUser(callsign)
                if (user) {
                    user = await getUserWithObjs(await GetUser(callsign), ["pireps"])
                    delete user['password'];
                    delete user['admin'];
                    delete user['VANetID'];
                    delete user['cp'];
                    delete user['llogin'];
                    delete user['revoked'];
                    res.setHeader('Content-Type', 'application/json');
                    res.status(200).end(JSON.stringify(user, null, 2));
                } else {
                    res.sendStatus(404);
                }
            } else {
                res.sendStatus(400);
            }
        }else{
            res.sendStatus(401);
        }
    }else{
        res.sendStatus(401);
    }
})
app.get('/api/data/pirep/:id', async (req, res) => {
    if (req.query.auth) {
        if (req.query.auth == config.other.ident.slice(0, 5)) {
            if (req.params.id) {
                let id = req.params.id;
                let pirep = await GetPirep(id);
                if (pirep) {
                    // delete user['password'];
                    // delete user['admin'];
                    // delete user['VANetID'];
                    // delete user['cp'];
                    // delete user['llogin'];
                    // delete user['revoked'];
                    res.setHeader('Content-Type', 'application/json');
                    res.status(200).end(JSON.stringify(pirep, null, 2));
                } else {
                    res.sendStatus(404);
                }
            } else {
                res.sendStatus(400);
            }
        } else {
            res.sendStatus(401);
        }
    } else {
        res.sendStatus(401);
    }
})
app.get('/api/data/stats', async (req, res) => {
    if (req.query.auth) {
        if (req.query.auth == config.other.ident.slice(0, 5)) {
                res.setHeader('Content-Type', 'application/json');
                res.status(200).end(JSON.stringify(stats, null, 2));
        } else {
            res.sendStatus(401);
        }
    } else {
        res.sendStatus(401);
    }
})
app.get('/api/data/config', async (req, res) =>{
    if (req.query.auth) {
        if (req.query.auth == config.other.ident.slice(0, 5)) {
            res.setHeader('Content-Type', 'application/json');
            res.status(200);
            const newObj = config;
            delete newObj.other.ident;
            delete newObj.other.webhook;
            if(newObj.key){
                delete newObj.key;
                delete newObj.key;
                delete newObj.boostingTier;
            }
            res.end(JSON.stringify(newObj, null, 2));
        } else {
            res.sendStatus(401);
        }
    } else {
        res.sendStatus(401);
    }
})

app.post('/import/:comp', upload.single('csv'), async (req, res) => {
    const cookies = getAppCookies(req);
    if(((!config.code) && req.path != "/setup")){
        if((!config.code) && req.path != "/setup"){
            res.redirect('/setup')
        }else{
            res.redirect("/?r=ue")
        }
    }else{
        const changePWD = await checkForCPWD(cookies);
        let user = await checkForUser(cookies);
        if(user){
            user = await getUserWithObjs(user, ["notifications", "pireps"]);
        }
        if(changePWD == true && req.path != "/changePWD"){
            res.redirect('/changePWD');
        }else if(user.revoked == 1){
            res.clearCookie('authToken').redirect("/?r=ro")
        }else{
            switch(req.params.comp){
                case "routes":
                    let errorAllReadySent = false;
                    if(req.file){
                        csv().fromFile(req.file.path).then((jsonObj) => {
                            jsonObj.forEach(row => {
                                setTimeout(async () =>{
                                    if (row.num && row.flightTime && row.operator && row.aircraftID && row.depICAO && row.arrICAO && row.rank) {
                                        const aircraft = await GetAircraft(row.aircraftID);
                                        if (aircraft) {
                                            const rank = await GetRank(row.rank);
                                            if (rank) {
                                                if (Array.isArray(rank) == false) {
                                                    const operator = await GetOperatorByName(removeDiacritics(row.name));
                                                    if (operator) {
                                                            setTimeout(() => {
                                                                if (errorAllReadySent == false) {
                                                                    CreateRoute(makeid(50), row.num, parseInt(row.flightTime), operator.id, aircraft.livID, row.depICAO, row.arrICAO, aircraft.publicName, rank.minH.toString());
                                                                    res.redirect("/admin/routes");
                                                                }
                                                            }, 1500);
                                                    } else {
                                                        if (errorAllReadySent == false) {
                                                            errorAllReadySent = true;
                                                            res.status(404);
                                                            res.send(`Could not find Operator with the name: ${sanitizer.sanitize(row.operator)} (On ${row.num}, ${row.depICAO}, ${row.arrICAO})`)
                                                        }
                                                    }
                                                } else {
                                                    if (errorAllReadySent == false) {
                                                        errorAllReadySent = true;
                                                        res.status(400);
                                                        res.send(`Found 2 Ranks with the name: ${sanitizer.sanitize(row.rank)}, please update your ranks.`)
                                                    }
                                                }
                                            } else {
                                                if (errorAllReadySent == false) {
                                                    errorAllReadySent = true;
                                                    res.status(404);
                                                    res.send(`Can't find rank by the name: ${sanitizer.sanitize(row.rank)}`)
                                                }
                                            }
                                        } else {
                                            if (errorAllReadySent == false) {
                                                errorAllReadySent = true;
                                                res.status(404);
                                                res.send(`Can't find aircraft with the ID: ${sanitizer.sanitize(row.aircraftID)}. Check the aircraft is in your fleet.`);
                                            }
                                        }
                                    } else {
                                        if(errorAllReadySent == false){
                                            errorAllReadySent = true;
                                            res.status(400);
                                            res.send("Oh no! One of your rows was missing some data, please check you have used the template correctly.");
                                        }
                                    }
                                }, randomizator(50, 750))
                            }, () => {
                                if (errorAllReadySent == false) {
                                    res.redirect('/admin/routes')
                                }
                            })
                        })
                    }else{
                        res.status(400).send("Missing file.")
                    }
                    break;
            }
        }
    }
});

app.get('*', async (req, res, next)=>{
    const cookies = getAppCookies(req)
    if (req.path.slice(0, 8) == "/public/") {
        if (await FileExists(path.join(__dirname, "..", req.path))) {
            res.sendFile(path.join(__dirname, "..", req.path));
        } else {
            res.sendStatus(404);
        }
    } else if (req.path.slice(0, 6) == "/data/") {
        if (await FileExists(path.join(__dirname, "..", req.path))) {
            res.sendFile(path.join(__dirname, "..", req.path));
        } else {
            res.sendStatus(404);
        }
    }else if(req.path == '/mirrorContent'){
        const safedContent = sanitizer.sanitize(atob(req.query.content.toString()));
        res.render("contentMirror", {
            content: safedContent
        })
    } else {

        //Check for setup
        if (((!config.code) && req.path != "/setup")) {
            if ((!config.code) && req.path != "/setup") {
                res.redirect('/setup')
            } else {
                res.redirect("/?r=ue")
            }
        } else {
            const changePWD = await checkForCPWD(cookies);
            let user = await checkForUser(cookies);
            if (user) {
                user = await getUserWithObjs(user, ["notifications", "pireps"]);
                delete user['password'];
                seenUser(user.username);
            }
            if (changePWD == true && req.path != "/changePWD") {
                res.redirect('/changePWD');
            } else if (user.revoked == 1) {
                res.clearCookie('authToken').redirect("/?r=ro")
            } else {
                let sesID;
                let session;
                if (req.path.toUpperCase().includes("SLOT")) {
                    sesID = parseInt(req.query.ses.toString());
                    //Get Session Obj
                    session = await GetSession(sesID);
                }
                switch (req.path) {
                    case "/login":
                    case "/":
                        if (user) {
                            res.redirect("/home");
                        } else {
                            res.render("login", {
                                config: getConfig(),
                                version: cvnb
                            })
                        }
                        break;
                    case "/home":
                        if (user) {
                            let vics = [];
                            let currentSession = null;
                            (await GetSessionByPilot(user.username)).every(session => {
                                if (session.active) {
                                    currentSession = session;
                                    return false;
                                }
                                return true;
                            });
                            (await GetUsersPireps(user.username)).forEach(pirep => {
                                vics.push(pirep.vehiclePublic)
                            })
                            res.render("home", {
                                active: req.path,
                                title: "Dashboard",
                                user: user,
                                config: getConfig(),
                                vics: vics,
                                mode: mode,
                                currentSession: currentSession,
                            })
                        } else {
                            res.clearCookie("authToken").redirect("/?r=ii");
                        }

                        break;
                    case "/newPirep":
                        if (user) {
                            let activeFlight = {
                                id: -1
                            };
                            let activeFlightBool = false;
                            (await GetSessionByPilot(user.username)).every(session => {
                                if (session.active) {
                                    activeFlightBool = true;
                                    activeFlight = session;
                                    return false;
                                }
                                return true;
                            })
                            res.render("npirep", {
                                active: req.path,
                                title: "New Flight",
                                user: user,
                                routes: await getRoutesWithOperator(),
                                craft: await GetAircrafts(),
                                ops: await GetOperators(),
                                config: getConfig(),
                                multipliers: await GetMultipliers(),
                                allowNSession: !(activeFlightBool),
                                activeFlight: activeFlight
                            })
                        } else {
                            res.clearCookie("authToken").redirect("/?r=ii");
                        }

                        break;
                    case "/oldPirep":
                        if (user) {
                            res.render("opirep", {
                                active: req.path,
                                title: "Previous Flights",
                                user: user,
                                pireps: await GetUsersPireps(user.username),
                                config: getConfig()
                            })
                        } else {
                            res.clearCookie("authToken").redirect("/?r=ii");
                        }
                        break;
                    case "/events":
                        if (user) {
                            res.render("events", {
                                active: req.path,
                                title: "Events",
                                user: user,
                                events: await GetEvents(),
                                config: getConfig()
                            })
                        } else {
                            res.clearCookie("authToken").redirect("/?r=ii");
                        }
                        break;
                    case "/links":
                        if (user) {
                            res.render("links", {
                                active: req.path,
                                title: "Links",
                                user: user,
                                links: await GetLinks(),
                                config: getConfig()
                            })
                        } else {
                            res.clearCookie("authToken").redirect("/?r=ii");
                        }
                        break;
                    case "/stats/me":
                        if (user) {
                            delete user['password'];
                            res.render("stats/me", {
                                active: req.path,
                                title: "My Stats",
                                user: user,
                                config: getConfig(),
                                stats: stats
                            })
                        } else {
                            res.clearCookie("authToken").redirect("/?r=ii");
                        }
                        break;
                    case "/stats/va":
                        if (user) {
                            const specConfig = getConfig();
                            delete specConfig.other['ident'];
                            delete specConfig['key'];
                            delete specConfig['id'];
                            res.render("stats/va", {
                                active: req.path,
                                title: "VA Stats",
                                user: user,
                                config: specConfig,
                                stats: stats,
                                aircraft: await GetAircrafts(),
                                routes: await getRoutesWithOperator(),
                                pireps: await GetPireps(),
                                pilotSize: (await GetUsers()).length
                            })
                        } else {
                            res.clearCookie("authToken").redirect("/?r=ii");
                        }
                        break;
                    case "/account":
                        if (user) {
                            res.render("account", {
                                active: req.path,
                                title: "Account",
                                user: user,
                                config: getConfig()
                            })
                        } else {
                            res.clearCookie("authToken").redirect("/?r=ii");
                        }
                        break;
                    case "/admin/aircraft":
                        if (user) {
                            if (user.admin == true) {
                                res.render("admin/aircraft", {
                                    active: req.path,
                                    title: "Admin - Aircraft",
                                    user: user,
                                    activer: "/admin",
                                    aircraft: await GetAircrafts(),
                                    listCraft: vanetCraft,
                                    config: getConfig()
                                })
                            } else {
                                res.sendStatus(403);
                            }

                        } else {
                            res.clearCookie("authToken").redirect("/?r=ii");
                        }
                        break;
                    case "/admin/events":

                        if (user) {

                            if (user.admin == true) {
                                res.render("admin/events", {
                                    active: req.path,
                                    title: "Admin - Events",
                                    user: user,
                                    activer: "/admin",
                                    aircraft: await GetAircrafts(),
                                    events: await GetEvents(),
                                    config: getConfig()
                                })
                            } else {
                                res.sendStatus(403);
                            }

                        } else {
                            res.clearCookie("authToken").redirect("/?r=ii");
                        }
                        break;
                    case "/admin/pireps":
                        if (user) {
                            if (user.admin == true) {
                                res.render("admin/pireps", {
                                    active: req.path,
                                    title: "Admin - PIREPS",
                                    user: user,
                                    activer: "/admin",
                                    aircraft: await GetAircrafts(),
                                    pireps: await GetPireps(),
                                    config: getConfig()
                                })
                            } else {
                                res.sendStatus(403);
                            }

                        } else {
                            res.clearCookie("authToken").redirect("/?r=ii");
                        }
                        break;
                    case "/admin/ranks":
                        if (user) {
                            if (user.admin == true) {
                                res.render("admin/ranks", {
                                    active: req.path,
                                    title: "Admin - Ranks",
                                    user: user,
                                    activer: "/admin",
                                    aircraft: await GetAircrafts(),
                                    ranks: await GetRanks(),
                                    config: getConfig()
                                })
                            } else {
                                res.sendStatus(403);
                            }

                        } else {
                            res.clearCookie("authToken").redirect("/?r=ii");
                        }
                        break;
                    case "/admin/routes":
                        if (user) {
                            if (user.admin == true) {
                                res.render("admin/routes", {
                                    active: req.path,
                                    title: "Admin - Routes",
                                    user: user,
                                    activer: "/admin",
                                    craft: await GetAircrafts(),
                                    ops: await GetOperators(),
                                    routes: await getRoutesWithOperator(),
                                    ranks: await GetRanks(),
                                    config: getConfig()
                                })
                            } else {
                                res.sendStatus(403);
                            }

                        } else {
                            res.clearCookie("authToken").redirect("/?r=ii");
                        }
                        break;
                    case "/admin/users":
                        if (user) {
                            if (user.admin == true) {
                                res.render("admin/users", {
                                    active: req.path,
                                    title: "Admin - Users",
                                    user: user,
                                    activer: "/admin",
                                    ranks: await GetRanks(),
                                    users: await GetUsers(),
                                    ops: await GetOperators(),
                                    routes: await GetRoutes(),
                                    config: getConfig(),
                                    pireps: await GetPireps()
                                })
                            } else {
                                res.sendStatus(403);
                            }

                        } else {
                            res.clearCookie("authToken").redirect("/?r=ii");
                        }
                        break;
                        break;
                    case "/admin/links":
                        if (user) {
                            if (user.admin == true) {
                                res.render("admin/links", {
                                    active: req.path,
                                    title: "Admin - Links",
                                    user: user,
                                    activer: "/admin",
                                    links: await GetLinks(),
                                    config: getConfig()
                                })
                            } else {
                                res.sendStatus(403);
                            }

                        } else {
                            res.clearCookie("authToken").redirect("/?r=ii");
                        }
                        break;
                    case "/admin/multi":
                        if (user) {
                            if (user.admin == true) {
                                res.render("admin/multi", {
                                    active: req.path,
                                    title: "Admin - Multi",
                                    user: user,
                                    activer: "/admin",
                                    Multipliers: await GetMultipliers(),
                                    config: getConfig()
                                })
                            } else {
                                res.sendStatus(403);
                            }

                        } else {
                            res.clearCookie("authToken").redirect("/?r=ii");
                        }
                        break;

                    case "/admin/import":
                        if (user) {
                            if (user.admin == true) {
                                res.render("admin/import", {
                                    active: req.path,
                                    title: "Admin - Import",
                                    user: user,
                                    activer: "/admin",
                                    config: getConfig(),
                                    listCraft: vanetCraft
                                })
                            } else {
                                res.sendStatus(403);
                            }
                        } else {
                            res.clearCookie("authToken").redirect("/?r=ii");
                        }
                        break;
                    case "/admin/codeshare":
                        if (user) {
                            if (user.admin == true) {
                                res.render("admin/codeshare", {
                                    active: req.path,
                                    title: "Admin - Operators",
                                    user: user,
                                    activer: "/admin",
                                    operators: await GetOperators(),
                                    config: getConfig()
                                })
                            } else {
                                res.sendStatus(403);
                            }
                        } else {
                            res.clearCookie("authToken").redirect("/?r=ii");
                        }
                        break;
                    case "/admin/settings":
                        if (user) {
                            if (user.admin == true) {
                                res.setHeader("Access-Control-Allow-Origin", "*");
                                res.render("admin/settings", {
                                    active: req.path,
                                    title: "Admin - Settings",
                                    user: user,
                                    activer: "/admin",
                                    operators: await GetOperators(),
                                    config: getConfig(),
                                    cv: cvnb,
                                    store: store,
                                    hosting: hosting
                                })
                            } else {
                                res.sendStatus(403);
                            }
                        } else {
                            res.clearCookie("authToken").redirect("/?r=ii");
                        }
                        break;
                    case "/report":
                        res.redirect("https://github.com/VACenter/VACenter/issues/new?assignees=&labels=bug&template=bug_report.md&title=")
                        break;
                    case '/changePWD':
                        if (user) {
                            res.render("changePWD", {
                                config: getConfig()
                            })
                        }
                        break;
                    case "/setup":
                        if (config.other) {
                            res.redirect("/")
                        } else {
                            res.render("setup", {
                                hosting: hosting
                            })
                        }
                        break;
                    case "/getLivData":
                        res.send(JSON.stringify(vanetCraft.get(req.query.liv)))
                        break;
                    case "/logout":
                        res.clearCookie("authToken").redirect("/");
                        break;
                    case "/cancelSlot":
                        if (session) {
                            if (session.pilot == user.username) {
                                await DeleteSession(sesID.toString());
                                res.redirect('/home');
                            } else {
                                res.status(403).send("You aren't the designated pilot for this session.");
                            }

                        } else {
                            res.status(404).send("Cant find session with ID: " + sesID);
                        }
                        break;
                    case "/slotUI":
                        if (session) {
                            if (session.pilot == user.username) {
                                res.render('slotUI', {
                                    user: user,
                                    config: getConfig(),
                                    session: session,
                                    aircraft: await GetAircrafts(),
                                    route: await GetRoute(session.route),
                                    vehicleUsed: await GetAircraft(session.aircraft),
                                    multipliers: await GetMultipliers()
                                })
                            } else {
                                res.status(403).send("You aren't the designated pilot for this session.");
                            }

                        } else {
                            res.status(404).send("Cant find session with ID: " + sesID);
                        }
                        break;
                    case "/newFlightUI":
                        const routeNum = req.query.route.toString();
                        //Get Route Obj
                        const route = await GetRouteByNum(routeNum);
                        if (route) {
                            //Create Session
                            const sesID = await CreateSession(user.username, route.id.toString())
                            res.redirect(`/slotUI?ses=${sesID.toString()}`)
                        } else {
                            res.status(404).send("Cant find route with ID: " + sanitizer.sanitize(routeNum));
                        }
                        break;
                    default:
                        next();
                        break;
                }
            }
        }
    }
})

/*app.get("/debug-sentry", function mainHandler(req, res) {
    throw new Error("My first Sentry error!");
});*/

app.get("*", (req, res, next) => {
    res.render("404", {
        config: getConfig()
    })
})


/*app.use(Sentry.Handlers.errorHandler());

// Optional fallthrough error handler
app.use(function onError(err, req, res, next) {
    // The error id is attached to `res.sentry` to be returned
    // and optionally displayed to the user for support.
    res.statusCode = 500;
    res.end(res.sentry + "\n");
});*/

app.listen(process.env.PORT, () => {
    console.log(chalk.green("Listening on port " + process.env.PORT));
});

//login
app.post("/login", async (req,res) =>{
    if(req.body.user && req.body.pwd){
        const user = await GetUser(req.body.user);
        if (user){
            if(user.revoked != 1){
                if (bcrypt.compareSync(req.body.pwd, user.password) == true) {
                    const token = makeid(50);
                    CreateToken(token, user.username);
                    res.cookie("authToken", token, { maxAge: new Date().getTime() + (10 * 365 * 24 * 60 * 60) }).redirect("/home")
                } else {
                    res.redirect('/?r=ii');
                }
            }else{
                res.redirect('/?r=ro');
            }
        }else{
            res.redirect('/?r=ii')
        }
    }else{
        res.sendStatus(400)
    }
})

//setup
app.post('/setup', async (req,res)=>{
    if ((!config.code)){
    if(req.body.key){
        const Req = await URLReq(MethodValues.GET, "https://api.vanet.app/airline/v1/profile", { 'X-Api-Key': req.body.key}, null, null)
        if(Req[0]){
            res.status(500).send(Req[0]);
        }
        if(Req[1].statusCode == 200){
            const newConfig = JSON.parse(Req[1].body).result;
            newConfig.key = req.body.key;
            newConfig.other = {
                bg: "/public/images/stockBG2.jpg",
                logo: "https://va-center.com/public/images/logo.webp",
                rates: 100,
                navColor: ["dark", "dark", "primary"],
                applications: {
                    state: false,
                    link: ""
                },
                btnColor: false,
                ident: makeid(25),
                pirepPic: false,
                pirepPicExpire: 86400000,
            }
            await FileWrite(`${__dirname}/../config.json`, JSON.stringify(newConfig, null, 2));
            setTimeout(async () => {
                await reloadConfig();
                setTimeout(async () => {
                    const regReq = await URLReq(MethodValues.POST, "https://admin.va-center.com/stats/instances/new", null, null, {
                        version: `${cvnb}`,
                        airline: config.name,
                        vanetKey: config.key,
                        type: "VANET",
                        wholeConfig: JSON.stringify(config)
                    });
                    config.other.ident = regReq[2];
                    await FileWrite(`${__dirname}/../config.json`, JSON.stringify(config, null, 2));
                    setTimeout(async () => {
                        vanetCraft = await getVANetData();
                    }, 1000)
                    CreateOperator(config.name, 1, newConfig.code);
                    if (regReq[1].statusCode == 200) {
                        await reloadConfig();
                        res.sendStatus(200);
                    } else {
                        await reloadConfig();
                        res.status(regReq[1].statusCode).send(regReq[2])
                    }
                }, 1000);
                
            }, 2000);
            
        }else{
            res.status(Req[1].statusCode).send(Req[2]);
        }
    }else{
        res.sendStatus(400)
    }
    }
})
app.post('/setupNVN', async (req, res) => {
    try{
        if (req.body.data) {
            const data = JSON.parse(req.body.data);
            const newConfig = {
                code: data.code,
                name: data.name
            };
            newConfig.key = req.body.key;
            newConfig.other = {
                bg: "/public/images/stockBG2.jpg",
                logo: "https://va-center.com/public/images/logo.webp",
                rates: 100,
                navColor: ["dark", "dark", "primary"],
                applications: {
                    state: false,
                    link: ""
                },
                btnColor: false,
                ident: makeid(25),
                pirepPic: hosting ? false : data.pirepPictures,
                pirepPicExpire: 86400000,
                webhook: data.webhook
            }
            newConfig.other.navColor = [];
            newConfig.other.navColor.push(data.colors.main.value);
            if (data.colors.main.value == "light") {
                newConfig.other.navColor.push("light");
            } else {
                newConfig.other.navColor.push("dark");
            }
            newConfig.other.navColor.push(data.colors.buttons.value);

            await FileWrite(`${__dirname}/../config.json`, JSON.stringify(newConfig, null, 2));
            setTimeout(async () => {
                await reloadConfig();
                setTimeout(async () => {
                    const regReq = await URLReq(MethodValues.POST, "https://admin.va-center.com/stats/instances/new", null, null, {
                        version: `${cvnb}`,
                        airline: config.name,
                        vanetKey: config.key,
                        type: "NVANET",
                        wholeConfig: JSON.stringify(config)
                    });
                    config.other.ident = regReq[2];
                    await FileWrite(`${__dirname}/../config.json`, JSON.stringify(config, null, 2));
                    vanetCraft = await getVANetData();
                    CreateOperator(config.name, 1, newConfig.code);
                    webhook.send({ title: "Webhook Setup", description: `Your webhook has been setup successfully!` })
                    res.sendStatus(200);
                }, 1000);

            }, 2000);
        }
    }catch(err){
        res.status(500);
        console.error(err);
        Sentry.captureException(err);
        res.send("err");
    }
    
})

app.post('/OSOR', async(req, res)=>{
    const cookies = getAppCookies(req)
    let user = await checkForUser(cookies);
    if (user) {
        await DeleteTokens(user.username);
        res.redirect("/")
    }else{
        res.sendStatus(401);
    }
})

app.post('/user/update', async(req, res) =>{
    const cookies = getAppCookies(req)
    if (req.body.display && req.body.url) {
        let user = await checkForUser(cookies);
        if (user) {
            if(user.display != req.body.display){
                user.display = req.body.display;
            }
            if(user.profileURL != req.body.url){
                user.profileURL = req.body.url
            }
            await UpdateUser(user.username, user.rank, user.admin, user.password, user.display, user.profileURL, user.hours, user.created, user.llogin, user.cp, user.revoked, user.VANetID, user.manualRank)
            res.redirect("/account")
        }else{
            res.sendStatus(401);
        }
    }else{
        res.sendStatus(400);
    }
})

app.post('/CPWD', async(req, res)=>{
    const cookies = getAppCookies(req)
    if(req.body.npwd){
        let user = await checkForUser(cookies);
        if (user) {
//                if(bcrypt.comuser.password)
                user.password = bcrypt.hashSync(req.body.npwd, 10);
            await UpdateUser(user.username, user.rank, user.admin, user.password, user.display, user.profileURL, user.hours, user.created, user.llogin, false, user.revoked, user.VANetID, user.manualRank)
                await DeleteTokens(user.username);
                res.redirect("/");
        }else{
            res.sendStatus(401);
        }
    }else{
        res.sendStatus(400);
    }
})

app.post("/newPIREP", upload.single('pirepImg'), async (req, res) => {
    const cookies = getAppCookies(req);
    console.log(req.body)
    if (req.body.route && req.body.aircraft && req.body.ft && req.body.fuel && req.body.depT && (config.other.pirepImg == true ? req.file.path : true)) {
        let user = await checkForUser(cookies);
        if (user) {
            let list = await GetAircrafts();
            let backup = req.body.aircraft;
            req.body.aircraft = null;
            list.forEach(vic =>{
                if(vic.publicName == backup){
                    req.body.aircraft = vic.livID;
                    return;
                }
            })
            if(req.body.aircraft){
                if (await GetRouteByNum(req.body.route.slice(operatorSearchable.get(parseInt(req.body.op)).code.length, req.body.route.length))) {
                    if(req.file){
                    fs.readFile(req.file.path, function (err, sourceData) {
                        Sentry.captureException(err);
                        tinify.fromBuffer(sourceData).toBuffer(function (err, resultData) {
                            Sentry.captureException(err);
                            fs.unlinkSync(`${req.file.path}`);
                            req.file.path = req.file.path + ".webp";
                            fs.writeFileSync(`${req.file.path}`, resultData);
                        })
                    })
                    }
                    let ft = req.body.ft;
                    let comment = req.body.comments ? req.body.comments : "No Comment";
                    let operatorLength = (operatorSearchable.get(parseInt(req.body.op))).code.length;
                    let route = (await GetRouteByNum(req.body.route.slice(operatorLength, req.body.route.length)));
                    if(req.body.multi){
                        let multi = await GetMultiplierByLabel(req.body.multi)
                        if(multi){
                            ft = ft * parseFloat((multi.amount).toString());
                            if(comment == "No Comment"){
                                comment = `Used Multiplier: ${multi.label} (${multi.amount}x)`;
                            }else{
                                comment += `\n \n Used Multiplier: ${multi.label} (${multi.amount}x)`;
                            }
                        }
                    }
                    if(config.key && user.VANetID){
                        await createVANetPirep(user.VANetID, route.depICAO, route.arrICAO, (new Date()).toString(), req.body.fuel, ft, req.body.aircraft)
                    }
                    await CreatePirep(req.body.aircraft, (await GetAircraft(req.body.aircraft)).publicName, user.username, req.body.op, route.depICAO, route.arrICAO, req.body.route, ft, comment, "n", req.body.fuel, (new Date(req.body.depT)).toString(), (req.file ? `/data/images/${req.file.filename}` : null));
                    webhook.send({title: "PIREP Submitted", "description": `${config.code}${user.username} has submitted a PIREP, and is awaiting action.`})
                    res.redirect("/");
                } else {
                    res.status(404).send("This route does not exist. Please enter a route that appears in the search box.");
                }
            }else{
                res.status(404).send("No aircraft found.")
            }
            
        }else{
            res.sendStatus(401);
        }
    }else{
        res.sendStatus(400);
    }
})



//Data Reqs
//Events
app.post("/admin/events/new", async function (req, res) {
    const cookies = getAppCookies(req)
    if (req.body.title && req.body.desc && req.body.aircraft && req.body.server && req.body.gates && req.body.depICAO && req.body.arrICAO && req.body.date){
        let user = await checkForUser(cookies);
        if (user) {
            if(user.admin == true){
                await CreateEvent(req.body.title, req.body.desc, req.body.arrICAO, req.body.depICAO, req.body.date, req.body.aircraft, (await GetAircraft(req.body.aircraft)).publicName , req.body.server, req.body.gates.split(","))
                res.redirect("/admin/events");
                webhook.send({ title: "New Event!", description: `A new event has been scheduled (${req.body.title})! Check it out!` });
            }else{
                res.sendStatus(403);
            }
        }else{
            res.sendStatus(401);
        }
    }else{
        res.sendStatus(400)
    }
})
app.delete("/admin/events/remove", async function (req, res) {
    const cookies = getAppCookies(req)
    if (req.body.id) {
        let user = await checkForUser(cookies);
        if (user) {
            if (user.admin == true) {
                await DeleteEvent(req.body.id);
                res.redirect("/admin/events")
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    } else {
        res.sendStatus(400)
    }
})

//Operators
app.post("/admin/codeshare/new", async function (req, res) {
    const cookies = getAppCookies(req)
    if (req.body.airName && req.body.airCode) {
        let user = await checkForUser(cookies);
        if (user) {
            if (user.admin == true) {
                await CreateOperator(req.body.airName, 0, req.body.airCode)
                res.redirect("/admin/codeshare");
                resetOperators()
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    } else {
        res.sendStatus(400)
    }
})
app.delete("/admin/codeshare/remove", async function (req, res) {
    const cookies = getAppCookies(req)
    if (req.body.id) {
        let user = await checkForUser(cookies);
        if (user) {
            if (user.admin == true) {
                await DeleteOperator(req.body.id);
                res.redirect("/admin/codeshare");
                resetOperators();
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    } else {
        res.sendStatus(400)
    }
})

//Rank
app.post("/admin/ranks/new", async function (req, res) {
    const cookies = getAppCookies(req)
    if (req.body.name && req.body.min) {
        let user = await checkForUser(cookies);
        if (user) {
            if (user.admin == true) {
                await CreateRank(req.body.name, req.body.manual ? 1 : 0, req.body.min)
                res.redirect("/admin/ranks");
                loadRanksMap();
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    } else {
        res.sendStatus(400)
    }
})
app.delete("/admin/ranks/remove", async function (req, res) {
    const cookies = getAppCookies(req)
    if (req.body.id) {
        let user = await checkForUser(cookies);
        if (user) {
            if (user.admin == true) {
                await DeleteRank(req.body.id);
                res.redirect("/admin/ranks");
                loadRanksMap();
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    } else {
        res.sendStatus(400)
    }
})

//Aircraft
app.post("/admin/aircraft/new", async function (req, res) {
    const cookies = getAppCookies(req)
    if (req.body.airID && req.body.livID) {
        let user = await checkForUser(cookies);
        let aircraft = vanetCraft.get(req.body.airID)
        if(aircraft){
            let checker = false;
            aircraft.livery.forEach(async liv => {
                if (liv.id == req.body.livID) {
                    checker = true;
                    if (user) {
                        if (user.admin == true) {
                            await CreateAircraft(req.body.livID, req.body.airID, liv.name, (vanetCraft.get(req.body.airID)).name, liv.name + " - " + (vanetCraft.get(req.body.airID)).name)
                            res.redirect("/admin/aircraft");
                            webhook.send({ title: "New Aircraft!", description: `The ${liv.name + " - " + (vanetCraft.get(req.body.airID)).name} has been added to our fleet!` });
                        } else {
                            res.sendStatus(403);
                        }
                    } else {
                        res.sendStatus(401);
                    }
                }
            });
            setTimeout(() => {
                if(checker == false){
                    res.sendStatus(404);
                }
            }, 10000);
        }else{
            res.sendStatus(404);
        }
    } else {
        res.sendStatus(400)
    }
})
app.delete("/admin/aircraft/remove", async function (req, res) {
    const cookies = getAppCookies(req)
    if (req.body.id) {
        let user = await checkForUser(cookies);
        if (user) {
            if (user.admin == true) {
                await DeleteAircraft(req.body.id);
                res.redirect("/admin/aircraft")
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    } else {
        res.sendStatus(400)
    }
}) 

//Routes
app.post("/admin/routes/new", async function (req, res) {
    const cookies = getAppCookies(req)
    if (req.body.num && req.body.aircraft && req.body.ft && req.body.depIcao && req.body.arrIcao && req.body.op && req.body.minH) {
        let user = await checkForUser(cookies);
        if (user) {
            if (user.admin == true) {
                let routeID = makeid(50);
                let vehiclePublic = [];
                let counter = 0;
                if (Array.isArray(req.body.aircraft) == false) {
                    let backup = req.body.aircraft;
                    req.body.aircraft = []
                    req.body.aircraft.push(backup);
                }
                req.body.aircraft.forEach(async vic =>{
                    vehiclePublic.push((await GetAircraft(vic)).publicName)
                    counter++;
                })
                let checker = setInterval(async ()=>{
                    if(counter == req.body.aircraft.length) {
                        clearInterval(checker);
                        let vehiclePublicList = vehiclePublic.join(", ");
                        await CreateRoute(routeID, req.body.num, req.body.ft, parseInt(req.body.op), req.body.aircraft.join(','), req.body.depIcao, req.body.arrIcao, vehiclePublicList, req.body.minH.toString());
                        resetRoutes()
                        res.redirect("/admin/routes");
                    }
                }, 250)
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    } else {
        res.sendStatus(400)
    }
})
app.post("/admin/routes/update", async function (req, res) {
    const cookies = getAppCookies(req)
    if (req.body.id && req.body.num && req.body.aircraft && req.body.ft && req.body.depIcao && req.body.arrIcao && req.body.op) {
        let user = await checkForUser(cookies);
        if (user) {
            if (user.admin == true) {
                if(await GetRoute(req.body.id)){
                    let vehiclePublic = [];
                    let counter = 0;
                    if(Array.isArray(req.body.aircraft) == false){
                        let backup = req.body.aircraft;
                        req.body.aircraft = []
                        req.body.aircraft.push(backup);
                    }
                    req.body.aircraft.forEach(async vic => {
                        vehiclePublic.push((await GetAircraft(vic)).publicName)
                        counter++;
                    })
                    let checker = setInterval(async () => {
                        if (counter == req.body.aircraft.length) {
                            clearInterval(checker);
                            let vehiclePublicList = vehiclePublic.join(", ");
                            await UpdateRoute(req.body.id, req.body.num, req.body.ft, req.body.op, req.body.aircraft.join(','), req.body.depIcao, req.body.arrIcao, vehiclePublicList, req.body.rankReq);
                            resetRoutes()
                            res.redirect("/admin/routes")
                        }
                    }, 250)
                }else{
                    res.sendStatus(404);
                }
                
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    } else {
        res.sendStatus(400)
    }
})
app.delete("/admin/routes/remove", async function (req, res) {
    const cookies = getAppCookies(req)
    if (req.body.id) {
        let user = await checkForUser(cookies);
        if (user) {
            if (user.admin == true) {
                const route = await GetRoute(req.body.id);
                await DeleteRoute(req.body.id);
                resetRoutes()
                res.redirect("/admin/routes")
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    } else {
        res.sendStatus(400)
    }
})

//Users
app.post("/admin/users/new", async function (req, res) {
    const cookies = getAppCookies(req)
    if (req.body.username && req.body.password && req.body.IFC && req.body.Name) {
        let user = await checkForUser(cookies);
        if (user) {
            if (user.admin == true) {
                const checkForTarget = ((await GetUser(req.body.username)) == undefined)
                if(checkForTarget){
                    let pilotID;
                    try{
                        if(config.key){
                            pilotID = (await getVANetUser(req.body.IFC));
                        }
                    }catch(err) {
                        Sentry.captureException(err);
                        res.status(500).send(sanitizer.sanitize(err));
                    }
                    let vanetid = {
                        status: pilotID ? true: false,
                        id: pilotID ? pilotID : null,
                    }

                    await CreateUser(req.body.username, "0", req.body.manual ? 1 : 0, req.body.admin ? true : false, bcrypt.hashSync(req.body.password, 10), req.body.Name, "/public/images/defaultPP.png", req.body.hours ? req.body.hours : 0, (new Date()).toString(), (new Date(0).toString()), true, 0, vanetid.id)
                    await UpdateUser(req.body.username, await testRank(await GetUser(req.body.username)), req.body.admin ? true : false, bcrypt.hashSync(req.body.password, 10), req.body.Name, "/public/images/defaultPP.png", req.body.hours ? req.body.hours : 0, (new Date()).toString(), (new Date(0).toString()), true, 0, vanetid.id, user.manualRank)
                    
                    res.redirect("/admin/users");
                    webhook.send({ title: "New Pilot!", description: `Welcome ${req.body.Name} (${config.code}${req.body.username}) to the VA!` });
                }else{
                    res.sendStatus(409);
                }
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    } else {
        res.sendStatus(400)
    }
})
app.post("/admin/users/update", async function (req, res) {
    const cookies = getAppCookies(req)
    if (req.body.name && req.body.uid) {
        let user = await checkForUser(cookies);
        if (user) {
            if (user.admin == true) {
                const checkForTarget = ((await GetUser(req.body.uid)) != undefined)
                if (checkForTarget) {
                    const target = await GetUser(req.body.uid)
                    if(req.body.name != target.display){
                        target.display = req.body.name;
                    }
                    await UpdateUser(req.body.uid, target.rank, target.admin, target.password, target.display, target.profileURL, target.hours, target.created, target.llogin, target.cp, target.revoked, target.VANetID, user.manualRank)
                    res.redirect("/admin/users")
                } else {
                    res.sendStatus(409);
                }
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    } else {
        res.sendStatus(400)
    }
})
app.post("/admin/users/rankChange", async function (req, res){
    const cookies = getAppCookies(req)
    if (req.body.uid && req.body.rank) {
        let user = await checkForUser(cookies);
        if (user) {
            if (user.admin == true) {
                const target = await GetUser(req.body.uid);
                if(target){
                    target.manualRank = req.body.manual ? 1 : 0;
                    if(target.manualRank == 1){
                        target.rank = (await GetRank(req.body.rank)).label;
                    }else{
                        target.rank = await testRank(target);
                    }
                    UpdateUser(target.username, target.rank, target.admin, target.password, target.display, target.profileURL, target.hours, target.created, target.llogin, target.cp, target.revoked, target.VANetID, target.manualRank)
                    res.redirect("/admin/users")
                }else{
                    res.sendStatus(404);
                }
            }else{
                res.sendStatus(403)
            }
        }else{
            res.sendStatus(401)
        }
    }else{
        res.sendStatus(400)
    }
})
app.post("/admin/users/revoke", async function (req, res) {
    const cookies = getAppCookies(req)
    if (req.body.uid) {
        let user = await checkForUser(cookies);
        if (user) {
            if (user.admin == true) {
                const checkForTarget = ((await GetUser(req.body.uid)) != undefined)
                if (checkForTarget) {
                    const target = await GetUser(req.body.uid)
                    await UpdateUser(req.body.uid, target.rank, target.admin, target.password, target.display, target.profileURL, target.hours, target.created, target.llogin, target.cp, 1, target.VANetID, user.manualRank)
                    res.redirect("/admin/users")
                } else {
                    res.sendStatus(409);
                }
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    } else {
        res.sendStatus(400)
    }
})
app.post("/admin/users/unrevoke", async function (req, res) {
    const cookies = getAppCookies(req)
    if (req.body.uid) {
        let user = await checkForUser(cookies);
        if (user) {
            if (user.admin == true) {
                const checkForTarget = ((await GetUser(req.body.uid)) != undefined)
                if (checkForTarget) {
                    const target = await GetUser(req.body.uid)
                    await UpdateUser(req.body.uid, target.rank, target.admin, bcrypt.hashSync(`VACENTER_REVOKED_PASSWORD`, 10), target.display, target.profileURL, target.hours, target.created, target.llogin, true, 0, target.VANetID, user.manualRank)
                    res.redirect("/admin/users")
                } else {
                    res.sendStatus(409);
                }
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    } else {
        res.sendStatus(400)
    }
})
app.post("/admin/users/resetPWD", async function (req, res){
    const cookies = getAppCookies(req)
        let user = await checkForUser(cookies);
        if (user) {
            if (user.admin == true) {
                if (req.body.uid && req.body.newpwd) {
                    let target = await GetUser(decodeURIComponent(req.body.uid));
                    if (target) {
                        target.password = bcrypt.hashSync(decodeURIComponent(req.body.newpwd), 10);
                        await UpdateUser(target.username, target.rank, target.admin, target.password, target.display, target.profileURL, target.hours, target.created, target.llogin, true, target.revoked, target.VANetID, user.manualRank)
                        await DeleteTokens(target.username);
                        res.sendStatus(200);
                    } else {
                        res.sendStatus(404);
                    }
                }else{
                    res.sendStatus(400);
                }
            }else{
                res.sendStatus(403);
            }
        }else{
            res.sendStatus(401);
        }
})
app.post("/users/linkVANet", async function (req, res){
    const cookies = getAppCookies(req)
    let user = await checkForUser(cookies);
    if (user) {
        if (req.body.ifcname) {
            try{
                const pilotID = (await getVANetUser(req.body.ifcname));
                user.vanetID = pilotID;
                await UpdateUser(user.username, user.rank, user.admin, user.password, user.display, user.profileURL, user.hours, user.created, user.llogin, user.cp, user.revoked, pilotID, user.manualRank);
                res.redirect("/");
            }catch(err){
                Sentry.captureException(err);
                res.redirect("/account");
            }
        }else{
            res.sendStatus(400);
        }
    }else{
        res.sendStatus(401);
    }
})

//Settings
app.post("/admin/settings/logo", async function (req, res) {
    const cookies = getAppCookies(req)
    if(req.body.value){
    let user = await checkForUser(cookies);
    if (user) {
        if (user.admin == true) {
            const newConfig = getConfig();
            newConfig.other.logo = req.body.value;
            fs.writeFileSync(`${__dirname}/../config.json`, JSON.stringify(newConfig, null, 2));
            setTimeout(()=>{
                reloadConfig();
                res.redirect("/admin/settings")
            }, 1000)
        } else {
            res.sendStatus(403);
        }
    } else {
        res.sendStatus(401);
    }
    }else{
        res.sendStatus(400);
    }
})
app.post("/admin/settings/pirepPic", async function (req, res) {
    const cookies = getAppCookies(req)
    let user = await checkForUser(cookies);
    if (user) {
        if (user.admin == true) {
            if(req.body.imgExpireDays){
                const newConfig = getConfig();
                newConfig.other.pirepPic = hosting ? false : (req.body.state == "on" ? true: false);
                newConfig.other.pirepPicExpire = ((((parseFloat(req.body.imgExpireDays) * 24) * 60) * 60) * 1000);
                fs.writeFileSync(`${__dirname}/../config.json`, JSON.stringify(newConfig));
                setTimeout(() => {
                    reloadConfig();
                    res.redirect("/admin/settings");
                    if(req.body.state == "on"){
                        webhook.send({title: "PIREP Images Enabled", description: `${config.name} has turned on PIREP images, now you can submit an image as part of your PIREP.`})
                    }
                }, 1000)
            }
        } else {
            res.sendStatus(403);
        }
    } else {
        res.sendStatus(401);
    }
})
app.post("/admin/settings/bg", async function (req, res) {
    const cookies = getAppCookies(req)
    if (req.body.value) {
        let user = await checkForUser(cookies);
        if (user) {
            if (user.admin == true) {
                const newConfig = getConfig();
                newConfig.other.bg = req.body.value;
                fs.writeFileSync(`${__dirname}/../config.json`, JSON.stringify(newConfig));
                res.redirect("/admin/settings")
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    } else {
        res.sendStatus(400);
    }
})
app.post("/admin/settings/webhook", async function (req, res) {
    const cookies = getAppCookies(req)
    if (req.body.value) {
        let user = await checkForUser(cookies);
        if (user) {
            if (user.admin == true) {
                const newConfig = getConfig();
                newConfig.other.webhook = req.body.value;
                fs.writeFileSync(`${__dirname}/../config.json`, JSON.stringify(newConfig, null, 2));
                res.redirect("/admin/settings");
                webhook.send({ title: "Webhook Setup", description: `Your webhook has been setup successfully!` })
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    } else {
        res.sendStatus(400);
    }
})
app.post("/admin/settings/accent", async function (req, res) {
    const cookies = getAppCookies(req)
    if (req.body.accent) {
        let user = await checkForUser(cookies);
        if (user) {
            if (user.admin == true) {
                const newConfig = getConfig();
                newConfig.other.navColor = [];
                newConfig.other.navColor.push(req.body.accent);
                if(req.body.accent == "light" || req.body.accent == "white"){
                    newConfig.other.navColor.push("light");
                }else{
                    newConfig.other.navColor.push("dark");
                }
                if(req.body.state && req.body.accent != "danger" && req.body.accent != "light"){
                    newConfig.other.navColor.push(req.body.accent);
                    newConfig.other.btnColor = true;
                }else{
                    newConfig.other.navColor.push("primary");
                    newConfig.other.btnColor = false;
                }
                
                fs.writeFileSync(`${__dirname}/../config.json`, JSON.stringify(newConfig, null, 2));
                res.redirect("/admin/settings")
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    } else {
        res.sendStatus(400);
    }
})

//PIREPS
app.post("/admin/pireps/apr", async function (req, res){
    const cookies = getAppCookies(req)
    if (req.body.id) {
        let user = await checkForUser(cookies);
        if (user) {
            if (user.admin == true) {
                const targetPIREP = await GetPirep(req.body.id)
                if(targetPIREP){
                    targetPIREP.status = "a";
                    updateStats();
                    if(config.other.pirepPic == true){
                        setTimeout(() => {
                            FileRemove(`${__dirname}/..${targetPIREP.pirepImg}.webp`)
                            UpdatePirep(targetPIREP.id, targetPIREP.vehicle, targetPIREP.vehiclePublic, targetPIREP.author, targetPIREP.operator, targetPIREP.depICAO, targetPIREP.arrICAO, targetPIREP.route, targetPIREP.flightTime, targetPIREP.comments, targetPIREP.status, targetPIREP.fuel, targetPIREP.filed, null, "REMOVED");
                        }, config.other.pirepPicExpire);
                    }
                    await UpdatePirep(targetPIREP.id, targetPIREP.vehicle, targetPIREP.vehiclePublic, targetPIREP.author, targetPIREP.operator, targetPIREP.depICAO, targetPIREP.arrICAO, targetPIREP.route, targetPIREP.flightTime, targetPIREP.comments, "a", targetPIREP.fuel, targetPIREP.filed,null, targetPIREP.pirepImg);
                    const owner = await GetUser(targetPIREP.author);
                    if(owner){
                        owner.hours = owner.hours + (targetPIREP.flightTime / 60);
                        owner.rank = await testRank(owner)
                        await UpdateUser(owner.username, owner.rank, owner.admin, owner.password, owner.display, owner.profileURL, owner.hours, owner.created, owner.llogin, owner.cp, owner.revoked, owner.VANetID, user.manualRank)
                        res.redirect("/admin/pireps");
                        
                        webhook.send({title:"PIREP Approved", description: `${config.code}${owner.username}'s PIREP (${targetPIREP.depICAO}=>${targetPIREP.arrICAO}) has been approved!`})

                    }else{
                        res.sendStatus(500);
                    }
                    
                }else{
                    res.sendStatus(404);
                }
            }else{
                res.sendStatus(403);
            }
        }else{
            res.sendStatus(401);
        }
    }else{
        res.sendStatus(400);
    }
})
app.post("/admin/pireps/den", async function (req, res) {
    const cookies = getAppCookies(req)
    if (req.body.id && req.body.rejectReason) {    
        let user = await checkForUser(cookies);
        if (user) {
            if (user.admin == true) {
                const targetPIREP = await GetPirep(req.body.id)
                if (targetPIREP) {
                    targetPIREP.status = "d";
                    targetPIREP.rejectReason = Buffer.from(req.body.rejectReason, 'base64').toString()
                    if (config.other.pirepPic == true) {
                        setTimeout(() => {
                            FileRemove(`${__dirname}/..${targetPIREP.pirepImg}.webp`)
                            UpdatePirep(targetPIREP.id, targetPIREP.vehicle, targetPIREP.vehiclePublic, targetPIREP.author, targetPIREP.operator, targetPIREP.depICAO, targetPIREP.arrICAO, targetPIREP.route, targetPIREP.flightTime, targetPIREP.comments, "d", targetPIREP.fuel, targetPIREP.filed, Buffer.from(req.body.rejectReason, 'base64').toString(), "REMOVED");
                        }, config.other.pirepPicExpire);
                    }
                    await UpdatePirep(targetPIREP.id, targetPIREP.vehicle, targetPIREP.vehiclePublic, targetPIREP.author, targetPIREP.operator, targetPIREP.depICAO, targetPIREP.arrICAO, targetPIREP.route, targetPIREP.flightTime, targetPIREP.comments, "d", targetPIREP.fuel, targetPIREP.filed, Buffer.from(req.body.rejectReason, 'base64').toString(), targetPIREP.pirepImg);
                    res.redirect("/admin/pireps")
                } else {
                    res.sendStatus(404);
                }
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    } else {
        res.sendStatus(400);
    }
})

//Links
app.post("/admin/links/new", async function (req, res) {
    const cookies = getAppCookies(req)
    if (req.body.title && req.body.url) {
        let user = await checkForUser(cookies);
        if (user) {
            if (user.admin == true) {
                    await CreateLink(req.body.title, req.body.url);
                    res.redirect("/admin/links");
            }else{
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    } else {
        res.sendStatus(400);
    }
})
app.post("/admin/links/rem", async function (req, res) {
    const cookies = getAppCookies(req)
    if (req.body.id) {
        let user = await checkForUser(cookies);
        if (user) {
            if (user.admin == true) {
                await DeleteLink(parseInt(req.body.id));
                res.redirect("/admin/links");
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    } else {
        res.sendStatus(400);
    }
})

//Multi
app.post("/admin/multi/new", async function (req, res) {
    const cookies = getAppCookies(req)
    if (req.body.label && req.body.amount) {
        let user = await checkForUser(cookies);
        if (user) {
            if (user.admin == true) {
                if(!(await GetMultiplierByLabel(req.body.label))){
                    await CreateMulti(req.body.label, req.body.amount);
                    res.redirect("/admin/multi");
                }else{
                    res.status(409);
                    res.send("This Already Exists.")
                }
                
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    } else {
        res.sendStatus(400);
    }
})
app.post("/admin/multi/rem", async function (req, res) {
    const cookies = getAppCookies(req)
    if (req.body.id) {
        let user = await checkForUser(cookies);
        if (user) {
            if (user.admin == true) {
                await DeleteMulti(parseInt(req.body.id));
                res.redirect("/admin/multi");
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    } else {
        res.sendStatus(400);
    }
})

app.post("/admin/applications/config", async (req, res) =>{
    const cookies = getAppCookies(req);
    let user = await checkForUser(cookies);
    if (user) {
        if (user.admin == true) {
            const newConfig = getConfig();
            if(req.body.state){
                if(req.body.link){
                    newConfig.other.applications.state = true;
                    newConfig.other.applications.link = req.body.link;
                }else{
                    res.status(400);
                    res.send("Missing Link");
                }
            }else{
                newConfig.other.applications.state = false;
            }
            fs.writeFileSync(`${__dirname}/../config.json`, JSON.stringify(newConfig, null, 2));
            res.redirect("/admin/settings#apps");
        } else {
            res.sendStatus(403);
        }
    } else {
        res.sendStatus(401);
    }
})

app.post('/updateSlot', async (req, res) => {
    const cookies = getAppCookies(req);
    //Check for setup
    if (((!config.code) && req.path != "/setup")) {
        if ((!config.code) && req.path != "/setup") {
            res.redirect('/setup')
        } else {
            res.redirect("/?r=ue")
        }
    } else {
        const changePWD = await checkForCPWD(cookies);
        let user = await checkForUser(cookies);
        if (user) {
            user = await getUserWithObjs(user, ["notifications", "pireps"]);
        }
        if (changePWD == true && req.path != "/changePWD") {
            res.redirect('/changePWD');
        } else {
            const sesID = parseInt(req.query.ses.toString());
            //Get Session Obj
            const session = await GetSession(sesID);
            if (session) {
                switch (req.query.state) {
                    case "NI":
                        if (req.body.aircraft) {
                            const aircraft = await GetAircraft(req.body.aircraft);
                            if (aircraft) {
                                await UpdateSession(session.id.toString(), session.pilot, session.route, aircraft.livID, session.depTime, session.arrTime, session.active == true ? 1 : 0, "AS");
                                res.redirect(`/slotUI?ses=${session.id}`)
                            } else {
                                res.status(404).send("Can't find aircraft with that ID");
                            }
                        } else {
                            res.status(400).send("No aircraft provided.")
                        }
                        break;
                    case "SF":
                        await UpdateSession(session.id.toString(), session.pilot, session.route, session.aircraft, (new Date()).toString(), session.arrTime, 1, "FS");
                        res.sendStatus(200);
                        break;
                    case "EF":
                        await UpdateSession(session.id.toString(), session.pilot, session.route, session.aircraft, session.depTime, (((new Date().getTime() - new Date(session.depTime).getTime()) / 1000) / 60).toString(), 1, "FF");
                        res.sendStatus(200);
                        break;
                    default:
                        res.status(400).send("No state provided");
                        break;
                }
            } else {
                res.status(404).send("Cant find session with ID: " + sesID);
            }
        }
    }
})

app.post('/finSlot', upload.single('pirepImg'), async (req, res) => {
    const cookies = getAppCookies(req);
    //Check for setup
    if (((!config.code) && req.path != "/setup")) {
        if ((!config.code) && req.path != "/setup") {
            res.redirect('/setup')
        } else {
            res.redirect("/?r=ue")
        }
    } else {
        const changePWD = await checkForCPWD(cookies);
        let user = await checkForUser(cookies);
        if (user) {
            user = await getUserWithObjs(user, ["notifications", "pireps"]);
        }
        if (changePWD == true && req.path != "/changePWD") {
            res.redirect('/changePWD');
        } else {
            const sesID = parseInt(req.query.ses.toString());
            //Get Session Obj
            const session = await GetSession(sesID);
            if (session) {
                const route = await GetRoute(session.route);
                if (req.body.fuel) {
                    if(req.file){
                        fs.readFile(req.file.path, function (err, sourceData) {
                            Sentry.captureException(err);
                            tinify.fromBuffer(sourceData).toBuffer(function (err, resultData) {
                                Sentry.captureException(err);
                                fs.unlinkSync(`${req.file.path}`);
                                req.file.path = req.file.path + ".webp";
                                fs.writeFileSync(`${req.file.path}`, resultData);
                            })
                        })
                    }
                    let ft = parseInt(session.arrTime);
                    let comment = req.body.comments;
                    if (req.body.multi) {
                        let multi = await GetMultiplierByLabel(req.body.multi);
                        if (multi) {
                            ft = ft * parseFloat((multi.amount).toString());
                            if (comment == "No Comment") {
                                comment = `Used Multiplier: ${multi.label} (${multi.amount}x)`;
                            } else {
                                comment += `\n \n Used Multiplier: ${multi.label} (${multi.amount}x)`;
                            }
                        }
                    }
                    //@ts-ignore
                    CreatePirep(session.aircraft, (await GetAircraft(session.aircraft)).publicName, session.pilot, route.operator, route.depICAO, route.arrICAO, operatorSearchable.get(parseInt(route.operator)).code + route.num.toString(), ft, comment, "n", req.body.fuel, new Date().toString(), (req.file ? `/data/images/${req.file.filename}` : null));
                    webhook.send({ title: "PIREP Submitted", "description": `${config.code}${user.username} has submitted a PIREP, and is awaiting action.` })
                    UpdateSession(session.id.toString(), session.pilot, session.route, session.aircraft, session.depTime, session.arrTime, 0, "PF");
                    res.redirect("/home");
                    
                }else{
                    res.sendStatus(400);
                }
                // @ts-ignore
                
            } else {
                res.status(404).send("Cant find session with ID: " + sesID);
            }
        }
    }
})


async function seenUser(userID){
    console.log(userID)
    const user = await GetUser(userID);
    if (((new Date()).getTime() - new Date(user.llogin).getTime()) > (1000 * 60 * 10)){
        user.llogin = (new Date()).toString();
        UpdateUser(user.username, user.rank, user.admin, user.password, user.display, user.profileURL, user.hours, user.created, user.llogin, user.cp, user.revoked, user.VANetID, user.manualRank);
    }
    
}