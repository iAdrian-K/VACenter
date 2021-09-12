//@ts-check

//Dependancies
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const chalk = require('chalk');
const express = require('express');
var bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const rateLimit = require("express-rate-limit");
const checkDiskSpace = require("check-disk-space").default;
var multer = require('multer');
const OS = require('os');
require('dotenv').config()
const tinify = require("tinify");
tinify.key = "KfplF6KmZjMWXfFx8vqrXM8r4Wbtyqtp";

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
        GetOperator, GetOperators, CreateOperator, DeleteOperator,
        GetPirep, GetUsersPireps, GetPireps, CreatePirep, UpdatePirep,
        GetRanks, UpdateRank, CreateRank, DeleteRank,
        GetRoute, GetRoutes, GetRouteByNum, CreateRoute, UpdateRoute, DeleteRoute,
        GetStats, UpdateStat, DeleteStat,
        GetToken, CreateToken, DeleteTokens,
        GetUser, GetUsers, CreateUser, UpdateUser, DeleteUser,
        GetSlots, UpdateSlot, CreateSlot, DeleteSlot, GetSlot, GetSlotsWithRoutes, run,
        GetLinks, CreateLink, DeleteLink,
    CreateSession, GetSession, GetSessionByPilot, UpdateSession, DeleteSession
    } = require("./db")
const { update, checkForNewVersion, getVersionInfo } = require("./update");
const { getVANetData, getVANetUser, createVANetPirep } = require('./vanet.js');
//update();

async function reloadUserRanks(){
    (await GetUsers()).forEach(async user =>{
        //@ts-ignore
        user.rank = await testRank(user);
        //@ts-ignore
        UpdateUser(user.username, user.rank, user.admin, user.password, user.display, user.profileURL, user.hours, user.created, user.llogin, user.cp, user.revoked)
    })
}
reloadUserRanks()

//Versioning
let branch = getVersionInfo().branch;
let cvn = getVersionInfo().version;
let cvnb = branch == "beta" ? `${cvn}B` : (branch == "demo" ? `${cvn}B` : `${cvn}`)
/**
 * Used for checking the version info
 */
function reloadVersion(){
    cvn = getVersionInfo().version;
    cvnb = branch == "beta" ? `${cvn}B` : (branch == "demo" ? `${cvn}B` : `${cvn}`)
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
 * @typedef {import('./types.js').slot} slot
 * @typedef {import('./types.js').statistic} statistic
 * @typedef {import('./types.js').link} link
 * @typedef {import('./types.js').fsession} fsession
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
        rates: 100
    }
};
let limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
/**
 * Reloads Config
 * @name Reload Config
 */
function reloadConfig(){
    return new Promise(async (resolve, error) => {
        config = JSON.parse(await FileRead(`${__dirname}/../config.json`));
        let limiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: (config.other) ? (config.other.rates ? config.other.rates : 100) : 100 // limit each IP to 100 requests per windowMs
        });
        app.use(limiter);
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
    return new Promise(async resolve =>{
        if(ownerObj){
            const ranks = await GetRanks();
            ranks.sort( compareRanks );
            for (var i = 0; i < ranks.length; i++) { 
                let rank = ranks[i];
                if(ownerObj.hours >= rank.minH){
                    ownerObj.rank = rank.rank;
                }
            }
            resolve(ownerObj.rank);
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
    const VANetData = await getVANetData();
    vanetCraft = VANetData[0];
}, 86400000);
setTimeout(async () => {
    if (config.other) {
        if(config.other.ident){
            vanetCraft = await getVANetData();
        }
    }
}, 5000);




//App
const app = express();
app.set('view engine', "ejs");
app.set('views', path.join(__dirname, '/../views'));
console.log(chalk.green("Starting VACenter"))
app.listen(process.env.PORT, () =>{
    console.log(chalk.green("Listening on port " + process.env.PORT));
});
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
app.use(function(req,res,next){
    res.locals.version = cvnb;
    next();
})
//app.use(cookieParser());

//Util Funcs
/**
 * GetConfig - Used for every request;
 * @returns {Object}
 */
function getConfig(){
    return require("./../config.json");
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


//Basic Routes

app.get('/newSlotUI', async (req, res) =>{
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
            const slotID = req.query.slot.toString();
            //Get Slot Obj
            const slot = await GetSlot(slotID);
            if(slot){
                //Get Route Obj
                const route = await GetRoute(slot.route)
                //Create Session
                const sesID = await CreateSession(user.username, route.id.toString(), slotID, slot.depTime)
                res.redirect(`/slotUI?ses=${sesID.toString()}`)
            }else{
                res.status(404).send("Cant find slot with ID: " + slotID);
            }
        }
    }
})

app.get('/slotUI', async (req, res) => {
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
                if(session.pilot == user.username){
                    res.render('slotUI', {
                        user: user,
                        config: getConfig(),
                        session: session,
                        aircraft: await GetAircrafts(),
                        route: await GetRoute(session.route),
                        vehicleUsed: await GetAircraft(session.aircraft)
                    })
                }else{
                    res.status(403).send("You aren't the designated pilot for this session.");
                }
                
            } else {
                res.status(404).send("Cant find session with ID: " + sesID);
            }
        }
    }
})

app.get('/cancelSlot', async (req, res) => {
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
                if (session.pilot == user.username) {
                    await DeleteSession(sesID.toString());
                    res.redirect('/home');
                } else {
                    res.status(403).send("You aren't the designated pilot for this session.");
                }

            } else {
                res.status(404).send("Cant find session with ID: " + sesID);
            }
        }
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
                switch(req.query.state){
                    case "NI":
                        if(req.body.aircraft){
                            const aircraft = await GetAircraft(req.body.aircraft);
                            if(aircraft){
                                await UpdateSession(session.id.toString(), session.pilot, session.route, session.slotID, aircraft.livID, session.depTime, session.arrTime, session.active == true? 1 : 0 , "AS");
                                res.redirect(`/slotUI?ses=${session.id}`)
                            }else{
                                res.status(404).send("Can't find aircraft with that ID");
                            }
                        }else{
                            res.status(400).send("No aircraft provided.")
                        }
                        break;
                    case "SF":
                        await UpdateSession(session.id.toString(), session.pilot, session.route, session.slotID, session.aircraft, (new Date()).toString(), session.arrTime, 1, "FS");
                        res.sendStatus(200);
                        break;
                    case "EF":
                        await UpdateSession(session.id.toString(), session.pilot, session.route, session.slotID, session.aircraft, session.depTime, (((new Date().getTime() - new Date(session.depTime).getTime())/1000)/60).toString(), 1, "FF");
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
                if (req.file && req.body.fuel) {
                    fs.readFile(req.file.path, function (err, sourceData) {
                        tinify.fromBuffer(sourceData).toBuffer(function (err, resultData) {
                            fs.unlinkSync(`${req.file.path}`);
                            req.file.path = req.file.path + ".webp";
                            fs.writeFileSync(`${req.file.path}`, resultData);
                        })
                    })
                }
                CreatePirep(session.aircraft, (await GetAircraft(session.aircraft)).publicName, session.pilot, route.operator, route.depICAO, route.arrICAO, config.code + route.num.toString(), parseInt(session.arrTime), req.body.comments ? req.body.comments : "No comments.", "n", req.body.fuel, new Date().toString(), (req.file ? `/data/images/${req.file.filename}` : null))
                UpdateSession(session.id.toString(), session.pilot, session.route, session.slotID, session.aircraft, session.depTime, session.arrTime, 0, "PF")
                res.redirect("/home");
            } else {
                res.status(404).send("Cant find session with ID: " + sesID);
            }
        }
    }
})

app.get('*', async (req, res)=>{
    const cookies = getAppCookies(req)
    if(req.path.slice(0,8) == "/public/"){
        if(await FileExists(path.join(__dirname, "..", req.path))){
            res.sendFile(path.join(__dirname, "..", req.path));
        }else{
            res.sendStatus(404);
        }
    }else if(req.path.slice(0,6) == "/data/"){
        if(await FileExists(path.join(__dirname, "..", req.path))){
            res.sendFile(path.join(__dirname, "..", req.path));
        }else{
            res.sendStatus(404);
        }
    }else{

        //Check for setup
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
            }else{
                switch(req.path){
                    case "/":
                        if(user){
                            res.redirect("/home");
                        }else{
                        res.render("login", {
                            config: getConfig(),
                            version: cvnb
                        })
                        }
                        break;
                    case "/home":
                        if(user){
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
                        }else{
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
                                if(session.active){
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
                                routes: await GetRoutes(),
                                craft: await GetAircrafts(),
                                ops: await GetOperators(),
                                slots: await GetSlotsWithRoutes(),
                                config: getConfig(),
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
                    case "/aboutVA":
                        if (user) {
                            res.render("about", {
                                active: req.path,
                                title: "About",
                                user: user,
                                config: getConfig(),
                                stats: stats,
                                fleet: await GetAircrafts(),
                                events: await GetEvents(),
                                route: await GetRoutes()
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
                                    ranks: await GetRanks() ,
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
                                    routes: await GetRoutes(),
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
                                    users: await GetUsers(),
                                    ops: await GetOperators(),
                                    routes: await GetRoutes(),
                                    config: getConfig()
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
                                    store: store
                                })
                            } else {
                                res.sendStatus(403);
                            }
                        } else {
                            res.clearCookie("authToken").redirect("/?r=ii");
                        }
                        break;
                    case "/report":
                        res.render("report",{
                            config: getConfig()
                        })
                        break;
                    case '/changePWD':
                        if(user){
                            res.render("changePWD",{
                                config: getConfig()
                            })
                        }
                        break;
                    case "/setup":
                        if(config.other){
                            res.redirect("/")
                        }else{
                            res.render("setup")
                        }
                        break;
                    case "/getLivData":
                        res.send(JSON.stringify(vanetCraft.get(req.query.liv)))
                        break;
                    case "/logout":
                        res.clearCookie("authToken").redirect("/");
                        break;
                    default:
                        res.render("404", {
                            config: getConfig()
                        });
                        break;
                }
            }
        }
    }
})

//login
app.post("/login", async (req,res) =>{
    if(req.body.user && req.body.pwd){
        const user = await GetUser(req.body.user);
        if (user){
            if(bcrypt.compareSync(req.body.pwd, user.password) == true){
                const token = makeid(50);
                CreateToken(token, user.username);
                res.cookie("authToken", token, { maxAge: new Date().getTime() + (10 * 365 * 24 * 60 * 60) }).redirect("/home")
            }else{
                res.redirect('/?r=ii');
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
                logo: "",
                rates: 100,
                navColor: ["dark", "dark"],
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
                    CreateOperator(config.name)
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
    if (req.body.data) {
        const data = JSON.parse(req.body.data);
            const newConfig = {
                code: data.code,
                name: data.name
            };
            newConfig.key = req.body.key;
            newConfig.other = {
                bg: "/public/images/stockBG2.jpg",
                logo: "",
                rates: 100,
                navColor: ["dark", "dark"],
                ident: makeid(25),
                pirepPic: data.pirepPictures,
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
                        type: "NVANET",
                        wholeConfig: JSON.stringify(config)
                    });
                    config.other.ident = regReq[2];
                    await FileWrite(`${__dirname}/../config.json`, JSON.stringify(config, null, 2));
                    vanetCraft = await getVANetData();
                    CreateOperator(config.name)
                    res.sendStatus(200);
                }, 1000);

            }, 2000);
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
            await UpdateUser(user.username, user.rank, user.admin, user.password, user.display, user.profileURL, user.hours, user.created, user.llogin, user.cp, user.revoked, user.VANetID)
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
            if(user.cp){
//                if(bcrypt.comuser.password)
                user.password = bcrypt.hashSync(req.body.npwd, 10);
                await UpdateUser(user.username, user.rank, user.admin, user.password, user.display, user.profileURL, user.hours, user.created, user.llogin, false, user.revoked)
                await DeleteTokens(user.username);
                res.redirect("/");
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

app.post("/newPIREP", upload.single('pirepImg'), async (req, res) => {
    const cookies = getAppCookies(req)
    if (req.body.route && req.body.aircraft && req.body.ft && req.body.op && req.body.fuel && req.body.depT && (config.other.pirepImg == true ? req.file.path : true)) {
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
                if (await GetRouteByNum(req.body.route.slice(config.code.length, req.body.route.length))) {
                    if(req.file){
                    fs.readFile(req.file.path, function (err, sourceData) {
                        tinify.fromBuffer(sourceData).toBuffer(function (err, resultData) {
                            fs.unlinkSync(`${req.file.path}`);
                            req.file.path = req.file.path + ".webp";
                            fs.writeFileSync(`${req.file.path}`, resultData);
                        })
                    })
                    }
                    if(config.key && user.VANetID){
                        await createVANetPirep(user.VANetID, (await GetRouteByNum(req.body.route.slice(config.code.length, req.body.route.length))).depICAO, (await GetRouteByNum(req.body.route.slice(config.code.length, req.body.route.length))).arrICAO, (new Date()).toString(), req.body.fuel, req.body.ft, req.body.aircraft)
                    }
                    
                    await CreatePirep(req.body.aircraft, (await GetAircraft(req.body.aircraft)).publicName, user.username, req.body.op, (await GetRouteByNum(req.body.route.slice(config.code.length, req.body.route.length))).depICAO, (await GetRouteByNum(req.body.route.slice(config.code.length, req.body.route.length))).arrICAO, req.body.route, req.body.ft, req.body.comments ? req.body.comments : "No comments.", "n", req.body.fuel, (new Date(req.body.depT)).toString(), (req.file ? `/data/images/${req.file.filename}` : null));
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
                res.redirect("/admin/events")
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
    if (req.body.airName) {
        let user = await checkForUser(cookies);
        if (user) {
            if (user.admin == true) {
                await CreateOperator(req.body.airName)
                res.redirect("/admin/codeshare")
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
                await CreateRank(req.body.name, req.body.min)
                res.redirect("/admin/ranks")
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
    if (req.body.name) {
        let user = await checkForUser(cookies);
        if (user) {
            if (user.admin == true) {
                await DeleteRank(req.body.name);
                res.redirect("/admin/ranks")
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
                            res.redirect("/admin/aircraft")
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
                        await CreateRoute(routeID, req.body.num, req.body.ft, req.body.op, req.body.aircraft.join(','), req.body.depIcao, req.body.arrIcao, vehiclePublicList, (await GetOperator(req.body.op)).operator, req.body.minH);
                        Object.keys(req.body).forEach(async function (k, v) {
                            if (k.slice(0, 5) == "slot_") {
                                const value = req.body[k]
                                CreateSlot(`routeID_slot_${k[6]}`, routeID, `${value}`, `NF_${v}`);
                            }
                        });
                        res.redirect("/admin/routes")
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
                            await UpdateRoute(req.body.id, req.body.num, req.body.ft, req.body.op, req.body.aircraft.join(','), req.body.depIcao, req.body.arrIcao, vehiclePublicList, (await GetOperator(req.body.op)).operator, "0");
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
                (await GetSlots()).forEach(slot =>{
                    if(slot.route.toString() == route.id.toString()){
                        DeleteSlot(slot.id.toString());
                    }
                })
                await DeleteRoute(req.body.id);
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
                        pilotID = (await getVANetUser(req.body.IFC));
                    }catch(err) {
                        res.status(500).send(err);
                    }
                    let vanetid = {
                        status: pilotID ? true: false,
                        id: pilotID ? pilotID : null,
                    }

                    await CreateUser(req.body.username, "0", req.body.admin ? true : false, bcrypt.hashSync(req.body.password, 10), req.body.Name, "/public/images/defaultPP.png", req.body.hours ? req.body.hours : 0, (new Date()).toString(), (new Date(0).toString()), true, false, vanetid.id)
                    await UpdateUser(req.body.username, await testRank(await GetUser(req.body.username)), req.body.admin ? true : false, bcrypt.hashSync(req.body.password, 10), req.body.Name, "/public/images/defaultPP.png", req.body.hours ? req.body.hours : 0, (new Date()).toString(), (new Date(0).toString()), true, false, vanetid.id)
                    
                    res.redirect("/admin/users")
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
                    await UpdateUser(req.body.uid, target.rank, target.admin, target.password, target.display, target.profileURL, target.hours, target.created, target.llogin, target.cp, target.revoked, target.VANetID)
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
app.post("/admin/users/revoke", async function (req, res) {
    const cookies = getAppCookies(req)
    if (req.body.uid) {
        let user = await checkForUser(cookies);
        if (user) {
            if (user.admin == true) {
                const checkForTarget = ((await GetUser(req.body.uid)) != undefined)
                if (checkForTarget) {
                    const target = await GetUser(req.body.uid)
                    await UpdateUser(req.body.uid, target.rank, target.admin, target.password, target.display, target.profileURL, target.hours, target.created, target.llogin, target.cp, true, target.VANetID)
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
                    await UpdateUser(req.body.uid, target.rank, target.admin, bcrypt.hashSync(`VACENTER_REVOKED_PASSWORD`, 10), target.display, target.profileURL, target.hours, target.created, target.llogin, true, false, target.VANetID)
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
                if (req.body.targetUID) {
                    let target = await GetUser(req.body.targetUID);
                    if (target) {
                        if (!target.cp) {
                            target.password = bcrypt.hashSync("VACENTERBACKUP1", 10);
                            await UpdateUser(target.username, target.rank, target.admin, target.password, target.display, target.profileURL, target.hours, target.created, target.llogin, true, target.revoked)
                            await DeleteTokens(target.username);
                            res.redirect("/admin/users");
                        } else {
                            res.sendStatus(409);
                        }
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
                await UpdateUser(user.username, user.rank, user.admin, user.password, user.display, user.profileURL, user.hours, user.created, user.llogin, user.cp, user.revoked,pilotID);
                res.redirect("/");
            }catch(err){
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
app.post("/admin/settings/update", async function (req, res) {
    const cookies = getAppCookies(req)
        let user = await checkForUser(cookies);
        if (user) {
            if (user.admin == true) {
                update().then(status=>{
                    res.sendStatus(status == true ? 202 : 204);
                })
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
})
app.post("/admin/settings/rate", async function (req, res) {
    const cookies = getAppCookies(req)
    if(req.body.value){
    let user = await checkForUser(cookies);
    if (user) {
        if (user.admin == true) {
            const newConfig = getConfig();
            newConfig.other.rates = req.body.value;
            fs.writeFileSync(`${__dirname}/../config.json`, JSON.stringify(newConfig));
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
                newConfig.other.pirepPic = req.body.state == "on" ? true: false;
                newConfig.other.pirepPicExpire = ((((parseFloat(req.body.imgExpireDays) * 24) * 60) * 60) * 1000);
                fs.writeFileSync(`${__dirname}/../config.json`, JSON.stringify(newConfig));
                setTimeout(() => {
                    reloadConfig();
                    res.redirect("/admin/settings")
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

app.post("/admin/settings/accent", async function (req, res) {
    const cookies = getAppCookies(req)
    if (req.body.accent) {
        let user = await checkForUser(cookies);
        if (user) {
            if (user.admin == true) {
                const newConfig = getConfig();
                newConfig.other.navColor = [];
                newConfig.other.navColor.push(req.body.accent);
                if(req.body.accent == "light"){
                    newConfig.other.navColor.push("light");
                }else{
                    newConfig.other.navColor.push("dark");
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
                    if(config.other.pirepPic == true){
                        setTimeout(() => {
                            FileRemove(`${__dirname}/..${targetPIREP.pirepImg}.webp`)
                            UpdatePirep(targetPIREP.id, targetPIREP.vehicle, targetPIREP.vehiclePublic, targetPIREP.author, targetPIREP.airline, targetPIREP.depICAO, targetPIREP.arrICAO, targetPIREP.route, targetPIREP.flightTime, targetPIREP.comments, targetPIREP.status, targetPIREP.fuel, targetPIREP.filed, null, "REMOVED");
                        }, config.other.pirepPicExpire);
                    }
                    await UpdatePirep(targetPIREP.id, targetPIREP.vehicle, targetPIREP.vehiclePublic, targetPIREP.author, targetPIREP.airline, targetPIREP.depICAO, targetPIREP.arrICAO, targetPIREP.route, targetPIREP.flightTime, targetPIREP.comments, "a", targetPIREP.fuel, targetPIREP.filed,null, targetPIREP.pirepImg);
                    const owner = await GetUser(targetPIREP.author);
                    if(owner){
                        owner.hours = owner.hours + (targetPIREP.flightTime / 60);
                        owner.rank = await testRank(owner)
                        await UpdateUser(owner.username, owner.rank, owner.admin, owner.password, owner.display, owner.profileURL, owner.hours, owner.created, owner.llogin, owner.cp, owner.revoked, owner.VANetID)
                        res.redirect("/admin/pireps")
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
                            UpdatePirep(targetPIREP.id, targetPIREP.vehicle, targetPIREP.vehiclePublic, targetPIREP.author, targetPIREP.airline, targetPIREP.depICAO, targetPIREP.arrICAO, targetPIREP.route, targetPIREP.flightTime, targetPIREP.comments, "d", targetPIREP.fuel, targetPIREP.filed, Buffer.from(req.body.rejectReason, 'base64').toString(), "REMOVED");
                        }, config.other.pirepPicExpire);
                    }
                    await UpdatePirep(targetPIREP.id, targetPIREP.vehicle, targetPIREP.vehiclePublic, targetPIREP.author, targetPIREP.airline, targetPIREP.depICAO, targetPIREP.arrICAO, targetPIREP.route, targetPIREP.flightTime, targetPIREP.comments, "d", targetPIREP.fuel, targetPIREP.filed, Buffer.from(req.body.rejectReason, 'base64').toString(), targetPIREP.pirepImg);
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
