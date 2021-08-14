//@ts-check

//Dependancies
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const express = require('express');
var bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const rateLimit = require("express-rate-limit");
require('dotenv').config()

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
        GetUser, GetUsers, CreateUser, UpdateUser, DeleteUser
    } = require("./db")
const { update, checkForNewVersion, getVersionInfo } = require("./update");
update();

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
console.log(makeid(50))

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
        console.log((config.other) ? (config.other.rates ? config.other.rates : 100) : 100)
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
                if(ownerObj.hours > rank.minH){
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
    (await GetPireps()).forEach(pirep => {
        craftArray.push(pirep.vehiclePublic)
    })
    console.log(mode(craftArray))
    UpdateStat("popCraft", "popCraft", mode(craftArray));
    //Route
    let routeArray = [];
    (await GetPireps()).forEach(pirep => {
        routeArray.push(pirep.route)
    })
    UpdateStat("popRoute", "popRoute", mode(routeArray));
}
//setInterval(updateStats, 120000)
//updateStats();

let vanetCraft = new Map();

async function reloadVANETData() {
    if (config.key) {
        //aircraft
        const aircraftRaw = await URLReq("GET", "https://api.vanet.app/public/v1/aircraft", { "X-Api-Key": config.key }, null, null)
        const aircraft = JSON.parse(aircraftRaw[2]).result;
        aircraft.forEach(aircraft => {
            if (!vanetCraft.has(aircraft.aircraftID)) {
                const rawAirData = aircraft;
                delete rawAirData["liveryID"]
                delete rawAirData["liveryName"]
                vanetCraft.set(aircraft.aircraftID, {
                    id: aircraft.aircraftID,
                    name: aircraft.aircraftName,
                    livery: [],
                    raw: rawAirData
                })
                const updated = vanetCraft.get(aircraft.aircraftID)
                updated.livery.push({ id: aircraft.liveryID, name: aircraft.LiverName })
                vanetCraft.set(aircraft.aircraftID, updated)
            } else {
                const updated = vanetCraft.get(aircraft.aircraftID)
                updated.livery.push({ id: aircraft.liveryID, name: aircraft.LiverName })
                vanetCraft.set(aircraft.aircraftID, updated)
            }
        })
    }
}
setTimeout(() => {
    reloadVANETData()
}, 5000);



//App
const app = express();
app.set('view engine', "ejs");
app.set('views', path.join(__dirname, '/../views'));
app.listen(process.env.PORT);
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
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
            console.log(UID)
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
app.get('*', async (req, res)=>{
    const cookies = getAppCookies(req)
    if(req.path.slice(0,8) == "/public/"){
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
            console.log(changePWD)
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
                            config: getConfig()
                        })
                        }
                        break;
                    case "/home":
                        if(user){
                            res.render("home", {
                                active: req.path,
                                title: "Dashboard",
                                user: user,
                                config: getConfig()
                            })
                        }else{
                            res.clearCookie("authToken").redirect("/?r=ii");
                        }
                        
                        break;
                    case "/newPirep":
                        if (user) {
                            res.render("npirep", {
                                active: req.path,
                                title: "New Flight",
                                user: user,
                                routes: await GetRoutes(),
                                craft: await GetAircrafts(),
                                ops: await GetOperators(),
                                config: getConfig()
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
                                console.log(1)
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
                                res.render("admin/settings", {
                                    active: req.path,
                                    title: "Admin - Settings",
                                    user: user,
                                    activer: "/admin",
                                    operators: await GetOperators(),
                                    config: getConfig(),
                                    cv: cvnb
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
                        res.send((await URLReq("GET", `https://api.vanet.app/public/v1/aircraft/${req.query.liv}`, { "X-Api-Key": config.key }, null, null))[2])
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
                navColor: null,
                ident: makeid(25)
            }
            await FileWrite(`${__dirname}/../config.json`, JSON.stringify(newConfig, null, 2));
            setTimeout(async () => {
                await reloadConfig();
                setTimeout(async () => {
                    const regReq = await URLReq(MethodValues.POST, "https://admin.va-center.com/stats/regInstance", null, null, {
                        id: config.other.ident,
                        version: `${cvnb}`,
                        airline: config.name,
                        vanetKey: config.key,
                        wholeConfig: JSON.stringify(config)
                    });
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

app.post("/newPIREP", async (req, res) => {
    const cookies = getAppCookies(req)
    if (req.body.route && req.body.aircraft && req.body.ft && req.body.op && req.body.fuel && req.body.depT && req.body.comments) {
        let user = await checkForUser(cookies);
        if (user) {
            if (await GetRouteByNum(req.body.route.slice(config.code.length, req.body.route.length))){
                await CreatePirep(req.body.aircraft, (await GetAircraft(req.body.aircraft)).publicName, user.username, req.body.op, (await GetRouteByNum(req.body.route.slice(config.code.length, req.body.route.length))).depICAO, (await GetRouteByNum(req.body.route.slice(config.code.length, req.body.route.length))).arrICAO, req.body.route, req.body.ft, req.body.comments, "n", req.body.fuel, (new Date(req.body.depT)).toString());
                res.redirect("/");
            }else{
                res.status(404).send("This route does not exist. Please enter a route that appears in the search box.");
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
    console.log(req.body)
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
    console.log(req.body)
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
    console.log(req.body)
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
        console.log(req.body)
        let user = await checkForUser(cookies);
        let liv = (JSON.parse((await URLReq(MethodValues.GET, `https://api.vanet.app/public/v1/aircraft/livery/${req.body.livID}`, {'X-API-Key': config.key}, null, null))[2]).result);
        if (user) {
            if (user.admin == true) {
                await CreateAircraft(req.body.livID, req.body.airID, liv.liveryName, (vanetCraft.get(req.body.airID)).name, liv.liveryName +" - "+ liv.aircraftName)
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
app.delete("/admin/aircraft/remove", async function (req, res) {
    const cookies = getAppCookies(req)
    console.log(req.body)
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
    if (req.body.num && req.body.aircraft && req.body.ft && req.body.depIcao && req.body.arrIcao && req.body.op) {
        let user = await checkForUser(cookies);
        if (user) {
            if (user.admin == true) {
                await CreateRoute(makeid(50), req.body.num, req.body.ft, req.body.op, req.body.aircraft, req.body.depIcao, req.body.arrIcao, (await GetAircraft(req.body.aircraft)).publicName, (await GetOperator(req.body.op)).operator, "0");
                res.redirect("/admin/routes")
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    } else {
        console.log(req.body)
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
                    await UpdateRoute(req.body.id, req.body.num, req.body.ft, req.body.op, req.body.aircraft, req.body.depIcao, req.body.arrIcao, (await GetAircraft(req.body.aircraft)).publicName, (await GetOperator(req.body.op)).operator, "0");
                    res.redirect("/admin/routes")
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
        console.log(req.body)
        res.sendStatus(400)
    }
})
app.delete("/admin/routes/remove", async function (req, res) {
    const cookies = getAppCookies(req)
    console.log(req.body)
    if (req.body.id) {
        let user = await checkForUser(cookies);
        if (user) {
            if (user.admin == true) {
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
                    const pilotIDReq = await JSONReq("GET", `https://api.vanet.app/airline/v1/user/id/${req.body.IFC}`, { "X-Api-Key": config.key }, null, null)
                    const pilotID = pilotIDReq[2].result;
                    let vanetid = {
                        status: pilotIDReq[2].status == 0 ? true : false,
                        id: pilotIDReq[2].result != false ? pilotIDReq[2].result : null,
                    }
                    await CreateUser(req.body.username, "0", req.body.admin ? true : false, bcrypt.hashSync(req.body.password, 10), req.body.Name, "/public/images/defaultPP.png", req.body.hours ? req.body.hours : 0, (new Date()).toString(), (new Date(0).toString()), true, false, vanetid.id)
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
        console.log(req.body)
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
        console.log(req.body)
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
        console.log(req.body)
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
        console.log(req.body)
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

//Settings
app.post("/admin/settings/update", async function (req, res) {
    const cookies = getAppCookies(req)
        let user = await checkForUser(cookies);
        if (user) {
            if (user.admin == true) {
                update().then(status=>{
                    console.log(status);
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
                    await UpdatePirep(targetPIREP.id, targetPIREP.vehicle, targetPIREP.vehiclePublic, targetPIREP.author, targetPIREP.airline, targetPIREP.depICAO, targetPIREP.arrICAO, targetPIREP.route, targetPIREP.flightTime, targetPIREP.comments, "a", targetPIREP.fuel, targetPIREP.filed);
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
    if (req.body.id) {
        let user = await checkForUser(cookies);
        if (user) {
            if (user.admin == true) {
                console.log(req.body.id)
                const targetPIREP = await GetPirep(req.body.id)
                console.log(targetPIREP)
                if (targetPIREP) {
                    targetPIREP.status = "d";
                    await UpdatePirep(targetPIREP.id, targetPIREP.vehicle, targetPIREP.vehiclePublic, targetPIREP.author, targetPIREP.airline, targetPIREP.depICAO, targetPIREP.arrICAO, targetPIREP.route, targetPIREP.flightTime, targetPIREP.comments, "d", targetPIREP.fuel, targetPIREP.filed)
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
