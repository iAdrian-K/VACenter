//@ts-check

//Dependancies
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const express = require('express');
var bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
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
        GetRoute, GetRoutes, CreateRoute, UpdateRoute, DeleteRoute,
        GetStats, UpdateStat, DeleteStat,
        GetToken, CreateToken, DeleteTokens,
        GetUser, GetUsers, CreateUser, UpdateUser, DeleteUser
    } = require("./db")
const { update, checkForNewVersion, getVersionInfo } = require("./update");
update();

//Versioning
let branch = getVersionInfo().branch;
let cvn = getVersionInfo().version;
let cvnb = branch == "beta" ? cvn.toString() + "B" : branch == "demo" ? cvn.toString() + "D" : cvn;

/**
 * Used for checking the version info
 */
function reloadVersion(){
    // @ts-ignore
    cvn = require("./../package.json").version;
    cvnb = branch == "beta" ? cvn.toString() + "B" : branch == "demo" ? cvn.toString() + "D" : cvn;
    console.log(cvnb)
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
let config;
/**
 * Reloads Config
 * @name Reload Config
 */
function reloadConfig(){
    return new Promise(async (resolve, error) => {
        config = JSON.parse(await FileRead(`${__dirname}/../config.json`));
        resolve(true);
    })
    
}
reloadConfig()
setInterval(reloadConfig, 5000);

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
            if (UID) {
                const user = await GetUser(UID);
                if (user) {
                    if (user.cp) {
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                } else {
                    resolve(false);
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
 * @returns {Promise<user>} User with Notifs
 */
async function getUserWithNotifs(userObj){
    return new Promise((async resolve => {
        const notfs = await GetNotifications(userObj.username)
        userObj.notifications = notfs;
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
            let user = await checkForUser(cookies);
            if(user){
                user = await getUserWithNotifs(user);
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
                    case "/admin":
                        if (user) {
                            if(user.admin == true){
                                res.render("admin/selector", {
                                    active: req.path,
                                    title: "Admin Menu",
                                    user: user,
                                    activer: "/admin",
                                    config: getConfig()
                                })
                            }else{
                                res.sendStatus(403);
                            }
                            
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
                                    config: getConfig()
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