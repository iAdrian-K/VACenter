let currentBranch = "beta";
const express = require('express');
const RateLimit = require('express-rate-limit');
require('dotenv').config()
const sanitize = require("sanitize-filename");
const package = require('./../package.json')
const addition2 = currentBranch == "beta" ? "B" : ""
const cv = require('./../package.json').version + addition2;
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt')
const salt = 10;
const btoa = require('btoa')
const atob = require('atob')
const uniqueString = require('unique-string');
const request = require("request");

//Parts
const {FileRead, FileWrite, FileExists, FileRemove} = require("./fileFunctions");
const { URLReq, JSONReq } = require("./urlReqs");
const {isAdminUser, isNormalUser} = require("./userAuth")
const {mode, compareTime, arrayRemove, getAppCookies} = require("./util")

//Stats Utils
function setVAStats() {
    return new Promise(async resolve =>{
        console.log(vaData)
        await FileWrite(`${__dirname}/stats.json`, JSON.stringify(vaData, null, 2));
        resolve(true)
    })
    
}

function updateVAStats() {
    vaData.popular.route = mode(vaData.raw.routes);
    vaData.popular.aircraft = mode(vaData.raw.aircraft);
}

//VACenter Config
let config = JSON.parse(fs.readFileSync(path.join(__dirname, "/../") + "config.json"))
let clientConfig = config
let defaultLimits = 100;
let limiter;
if(config.other){
    if (!config.other.color) {
        config.other.color = ["light", "light"]
        FileWrite((path.join(__dirname, "/../") + "config.json"), JSON.stringify(config, null, 2))
    }
    if(config.other.toldVACenter != true){
        config.other.ident = uniqueString();
        config.other.toldVACenter = true
        FileWrite(`${__dirname}/../config.json`, JSON.stringify(config, null, 2))
        const options2 = {
            method: 'POST',
            url: 'https://admin.va-center.com/stats/regInstance',
            form: { id: config.other.ident, version: `${cv}`, airline: config.name, vanetKey: config.key, wholeConfig: JSON.stringify(config) }
        };

        request(options2, function (error2, response2, body2) {
            if (response2.statusCode == 200) {
                console.log("#@$#ER")
            } else {
                console.error([response2.statusCode, response2.body])
            }
        })
    }
    limiter = new RateLimit({
        windowMs: 1 * 60 * 1000,
        max: config.other.rates,
        message: "<h1>Oh no!</h1><p>Your Rate Limits have been exceded, check with you system admin if you think this is an error."
    })
}else{
    limiter = new RateLimit({
        windowMs: 1 * 60 * 1000,
        max: 100,
        message: "<h1>Oh no!</h1><p>Your Rate Limits have been exceded, check with you system admin if you think this is an error."
    })
}
function reloadConfig(){
    config = JSON.parse(fs.readFileSync(path.join(__dirname, "/../") + "config.json"))
    clientConfig = config
    if (config.other) {
        limiter = new RateLimit({
            windowMs: 1 * 60 * 1000,
            max: config.other.rates,
            message: "<h1>Oh no!</h1><p>Your Rate Limits have been exceded, check with you system admin if you think this is an error."
        })
    } else {
        limiter = new RateLimit({
            windowMs: 1 * 60 * 1000,
            max: 100,
            message: "<h1>Oh no!</h1><p>Your Rate Limits have been exceded, check with you system admin if you think this is an error."
        })
    }
}

//Express App
const app = express();
const urlEncodedParser = bodyParser.urlencoded({ extended: false })
app.use(urlEncodedParser)
app.use(cors())
app.use(limiter)
app.set('views', path.join(__dirname, '../views'));
app.set('view engine', 'ejs')
app.listen(process.env.port)

//Paths
const publicPath = path.join(__dirname + '/../')
const dataPath = path.join(__dirname + '/../data')
const usersPath = path.join(__dirname + '/../data/users')

//VAData
let stats = {userCount: 0}
let users = new Map()
let events = new Map();
let crafts = new Map();
let ops = new Map();
let pireps = new Map();
let routes = new Map();
let ranks = new Map();
let vanetCraft = new Map();
let vaData = {
    raw: {
        routes: [],
        aircraft: []
    },
    popular: {
        route: "None",
        aircraft: "None"
    },
    totalHours: 0
}
FileExists(`${__dirname}/stats.json`).then(async value=>{
    if(value == false){
        await setVAStats()
        process.exit(11)
    }
})

function reloadData() {
    return new Promise(async resolve => {
        try {
            events = new Map();
            crafts = new Map();
            ranks = new Map();
            ops = new Map();
            pireps = new Map();
            routes = new Map();
            fs.readdirSync(dataPath + "/events").forEach(async event => {
                let pushedEventRaw = await FileRead(dataPath + "/events" + "/" + event)
                let pushedEvent = JSON.parse(pushedEventRaw)
                events.set(pushedEvent.id, pushedEvent)
            })
            fs.readdirSync(dataPath + "/ranks").forEach(async rank => {
                let pushedRankRaw = await FileRead(dataPath + "/ranks" + "/" + rank)
                let pushedRank = JSON.parse(pushedRankRaw)
                ranks.set(pushedRank.name, pushedRank)
            })
            fs.readdirSync(dataPath + "/aircraft").forEach(async craft => {
                let pushedCraftRaw = await FileRead(dataPath + "/aircraft" + "/" + craft)
                let pushedCraft = JSON.parse(pushedCraftRaw)
                crafts.set(pushedCraft.livID, pushedCraft)
            })
            fs.readdirSync(dataPath + "/operators").forEach(async airline => {
                let pushedAirlineRaw = await FileRead(dataPath + "/operators" + "/" + airline)
                let pushedAirline = JSON.parse(pushedAirlineRaw)
                ops.set(pushedAirline.id, pushedAirline)
            })
            fs.readdirSync(dataPath + "/pireps").forEach(async pirep => {
                let pushedPirepRaw = await FileRead(dataPath + "/pireps" + "/" + pirep)
                let pushedPirep = JSON.parse(pushedPirepRaw)
                pireps.set(pushedPirep.id, pushedPirep)
            })
            fs.readdirSync(dataPath + "/routes").forEach(async route => {
                let pushedRouteRaw = await FileRead(dataPath + "/routes" + "/" + route)
                let pushedRoute = JSON.parse(pushedRouteRaw)
                routes.set(pushedRoute.id, pushedRoute)
            })
            vaData = JSON.parse(await FileRead(`${__dirname}/stats.json`))
            resolve(true)
        }
        catch (error) {
            console.log(error)
            console.log("!!!!")
            resolve(false)
        }
    })
}
reloadData()

function reloadUsers() {
    return new Promise(resolve => {
        try {
            stats.userCount = 0;
            fs.readdirSync(usersPath).forEach(async user => {
                stats.userCount = stats.userCount + 1
                let pushedUserRaw = await FileRead(usersPath + "/" + user)
                let pushedUser = JSON.parse(pushedUserRaw)
                pushedUser.usernameAtob = atob(pushedUser.username)
                delete pushedUser['password']
                delete pushedUser['tokens']
                users.set(pushedUser.username, pushedUser)
            })
            resolve(true);
        }
        catch (error) {
            console.log(error)
            console.log("!!!!")
            resolve(false)
        }
    })
}
reloadUsers()

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
reloadVANETData()

//User Utils

async function remToken(tokens) {
    const unBased = atob(tokens.authToken)
    const userID = unBased.split(":")[0];
    const realTokenPreAdjust = unBased.split(":")[1];
    if (realTokenPreAdjust) {
        const realToken = realTokenPreAdjust.slice(0, realTokenPreAdjust.length)
        const userExists = await FileExists(`${usersPath}/` + sanitize(userID) + '.json')
        if (exists) {
                const user = JSON.parse(await FileRead(`${usersPath}/` + sanitize(userID) + '.json'))
                if (user.tokens.includes(realToken)) {
                    user.tokens = arrayRemove(user.tokens, realToken);
                    await FileWrite(`${usersPath}/` + sanitize(userID) + '.json', JSON.stringify(user, null, 2))
                    reloadUsers()
                }
        }
    }
}

async function notifyUser(user, event){
    return new Promise(async resolve => {
        if (user == "all") {
            users.forEach(async user => {
                const uid = user.username;
                const userData = JSON.parse(await FileRead(`${usersPath}/${uid}.json`));
                userData.notifications.push(event);
                userData.notifications.sort(compareTime);
                if (userData.notifications.length > 5) {
                    userData.notifications.pop();
                }
                await FileWrite(`${usersPath}/${uid}.json`, JSON.stringify(userData, null, 2));
            })
            resolve(true);
        } else {
            const userExists = await FileExists(`${usersPath}/` + sanitize(user) + '.json');
            if (userExists) {
                const userData = JSON.parse(await FileRead(`${usersPath}/${user}.json`));
                userData.notifications.push(event);
                userData.notifications.sort(compareTime);
                if (userData.notifications.length > 5) {
                    userData.notifications.pop();
                }
                await FileWrite(`${usersPath}/${user}.json`, JSON.stringify(userData, null, 2));
                resolve(true)
            } else {
                console.error("No user found to notify! " + user);
                resolve(false)
            }
        }
    })
}

function getUserID(tokens){
    return new Promise(resolve => {
        if (tokens.authToken != undefined) {
            const unBased = atob(tokens.authToken)
            const userID = unBased.split(":")[0];
            resolve(userID)
        } else {
            resolve(false)
        }
    })
}

function getUserData(tokens){
    return new Promise(async resolve => {
        if (tokens.authToken != undefined) {

            const unBased = atob(tokens.authToken)
            const userID = unBased.split(":")[0];
            const realTokenPreAdjust = unBased.split(":")[1];
            if (realTokenPreAdjust) {
                const realToken = realTokenPreAdjust.length == 33 ? realTokenPreAdjust.slice(0, realTokenPreAdjust.length - 1) : realTokenPreAdjust
                const exists = await FileExists(`${usersPath}/` + sanitize(userID) + '.json')
                    if (exists) {
                        const user = JSON.parse(await FileRead(`${usersPath}/` + sanitize(userID) + '.json'))
                        resolve(user);
                    } else {
                        resolve(false);
                    }
            } else {
                resolve(false)
            }
        } else {
            resolve(false)
        }
    })
}

//App Reqs

app.get('*', async (req, res) => {
    const cookies = getAppCookies(req)
    const fp = req.path.slice(0, 8)
    const fp2 = req.path.slice(0, 12)
    if (fp == "/public/") {
        if (fs.existsSync(publicPath + req.path)) {
            res.sendFile(publicPath + req.path)
        } else {
            res.sendStatus(404)
        }
    } else if (fp2 == "/components/") {
        if (fs.existsSync(`${__dirname}/${req.path}`)) {
            res.sendFile(`${__dirname}/${req.path}`);
        }
    } else {
        if (req.path != "/setup" && clientConfig.id == undefined) {
            res.redirect("/setup")
        } else {
            switch (req.path) {
                case "/":
                    if (cookies.hasOwnProperty('authToken')) {
                        res.redirect("/home")
                    } else {
                        res.render('login', {
                            config: clientConfig
                        })
                    }

                    break;
                case "/home":
                    if (await isNormalUser(cookies)) {
                        const uid = atob(cookies.authToken).split(":")[0];
                        const userInfo = JSON.parse(await FileRead(`${usersPath}/` + sanitize(uid) + '.json'))
                        if (!userInfo.meta.cp) {
                            delete userInfo['password']
                            delete userInfo['tokens']
                            //userInfo.apiKey
                            res.render('home', {
                                config: clientConfig,
                                user: userInfo,
                                active: req.path,
                                stats: vaData,
                                title: "Dashboard"
                            })
                        } else {
                            res.redirect("/changePWD")
                        }
                    } else {
                        res.clearCookie('authToken').redirect('/?r=ii')
                    }

                    break;
                case "/newPirep":
                    if (await isNormalUser(cookies)) {
                        const uid = atob(cookies.authToken).split(":")[0];
                        const userInfo = JSON.parse(await FileRead(`${usersPath}/` + sanitize(uid) + '.json'))
                        if (!userInfo.meta.cp) {
                            delete userInfo['password']
                            delete userInfo['tokens']
                            //userInfo.apiKey
                            res.render('npirep', {
                                config: clientConfig,
                                user: userInfo,
                                active: req.path,
                                stats: vaData,
                                title: "New Flight"
                            })
                        } else {
                            res.redirect("/changePWD")
                        }
                    } else {
                        res.clearCookie('authToken').redirect('/?r=ii')
                    }
                    break;
                case "/oldPirep":
                    if (await isNormalUser(cookies)) {
                        const uid = atob(cookies.authToken).split(":")[0];
                        const userInfo = JSON.parse(await FileRead(`${usersPath}/` + sanitize(uid) + '.json'))
                        if (!userInfo.meta.cp) {
                            delete userInfo['password']
                            delete userInfo['tokens']
                            //userInfo.apiKey
                            res.render('opirep', {
                                config: clientConfig,
                                user: userInfo,
                                active: req.path,
                                stats: vaData,
                                title: "My Flights"
                            })
                        } else {
                            res.redirect("/changePWD")
                        }
                    } else {
                        res.clearCookie('authToken').redirect('/?r=ii')
                    }
                    break;
                case "/events":
                    if (await isNormalUser(cookies)) {
                        const uid = atob(cookies.authToken).split(":")[0];
                        const userInfo = JSON.parse(await FileRead(`${usersPath}/` + sanitize(uid) + '.json'))
                        if (!userInfo.meta.cp) {
                            delete userInfo['password']
                            delete userInfo['tokens']
                            //userInfo.apiKey
                            res.render('events', {
                                config: clientConfig,
                                user: userInfo,
                                events: events,
                                active: req.path,
                                title: "Events"
                            })
                        } else {
                            res.redirect("/changePWD")
                        }
                    } else {
                        res.clearCookie('authToken').redirect('/?r=ii')
                    }
                    break;
                case "/aboutVA":
                    if (await isNormalUser(cookies)) {
                        const uid = atob(cookies.authToken).split(":")[0];
                        const userInfo = JSON.parse(await FileRead(`${usersPath}/` + sanitize(uid) + '.json'))
                        if (!userInfo.meta.cp) {
                            delete userInfo['password']
                            delete userInfo['tokens']
                            //userInfo.apiKey
                            res.render('about', {
                                config: clientConfig,
                                user: userInfo,
                                active: req.path,
                                stats: vaData,
                                title: "About " + config.name,
                                fleet: crafts,
                                route: routes
                            })
                        } else {
                            res.redirect("/changePWD")
                        }
                    } else {
                        res.clearCookie('authToken').redirect('/?r=ii')
                    }
                    break;
                case "/account":
                    if (await isNormalUser(cookies)) {
                        const uid = atob(cookies.authToken).split(":")[0];
                        const userInfo = JSON.parse(await FileRead(`${usersPath}/` + sanitize(uid) + '.json'))
                        if (!userInfo.meta.cp) {
                            delete userInfo['password']
                            delete userInfo['tokens']
                            //userInfo.apiKey
                            res.render('account', {
                                config: clientConfig,
                                user: userInfo,
                                active: req.path,
                                title: "My Account - " + userInfo.name
                            })
                        } else {
                            res.redirect("/changePWD")
                        }
                    } else {
                        res.clearCookie('authToken').redirect('/?r=ii')
                    }

                    break;
                case "/admin":
                    if (await isNormalUser(cookies)) {
                        if (await isAdminUser(cookies)) {
                            const uid = atob(cookies.authToken).split(":")[0];
                            const userInfo = JSON.parse(await FileRead(`${usersPath}/` + sanitize(uid) + '.json'))
                            if (!userInfo.meta.cp) {
                                delete userInfo['password']
                                delete userInfo['tokens']
                                    res.render('admin/selector', {
                                        config: clientConfig,
                                        user: userInfo,
                                        active: req.path,
                                        activer: req.path,
                                        title: "Admin Page Selector"
                                    })
                            } else {
                                res.redirect("/changePWD")
                            }
                        } else {
                            res.sendStatus(403)
                        }
                    } else {
                        res.clearCookie('authToken').redirect('/?r=ii')
                    }
                    break;
                case "/admin/routes":
                    if (await isNormalUser(cookies)) {
                        if (await isAdminUser(cookies)) {
                            const uid = atob(cookies.authToken).split(":")[0];
                            const userInfo = JSON.parse(await FileRead(`${usersPath}/` + sanitize(uid) + '.json'))
                            if (!userInfo.meta.cp) {
                                delete userInfo['password']
                                delete userInfo['tokens']
                                res.render('admin/routes', {
                                    config: clientConfig,
                                    user: userInfo,
                                    activer: req.path,
                                    active: "/admin",
                                    title: "Admin - Routes",
                                    routes: routes
                                })
                            } else {
                                res.redirect("/changePWD")
                            }
                        } else {
                            res.sendStatus(403)
                        }
                    } else {
                        res.clearCookie('authToken').redirect('/?r=ii')
                    }
                    break;
                case "/admin/aircraft":
                    if (await isNormalUser(cookies)) {
                        if (await isAdminUser(cookies)) {
                            const uid = atob(cookies.authToken).split(":")[0];
                            const userInfo = JSON.parse(await FileRead(`${usersPath}/` + sanitize(uid) + '.json'))
                            if (!userInfo.meta.cp) {
                                delete userInfo['password']
                                delete userInfo['tokens']
                                res.render('admin/aircraft', {
                                    config: clientConfig,
                                    user: userInfo,
                                    activer: req.path,
                                    active: "/admin",
                                    title: "Admin - Aircraft",
                                    aircraft: crafts,
                                    listCraft: vanetCraft
                                })
                            } else {
                                res.redirect("/changePWD")
                            }
                        } else {
                            res.sendStatus(403)
                        }
                    } else {
                        res.clearCookie('authToken').redirect('/?r=ii')
                    }
                    break;
                case "/admin/codeshare":
                    if (await isNormalUser(cookies)) {
                        if (await isAdminUser(cookies)) {
                            const uid = atob(cookies.authToken).split(":")[0];
                            const userInfo = JSON.parse(await FileRead(`${usersPath}/` + sanitize(uid) + '.json'))
                            if (!userInfo.meta.cp) {
                                delete userInfo['password']
                                delete userInfo['tokens']
                                res.render('admin/codeshare', {
                                    config: clientConfig,
                                    user: userInfo,
                                    activer: req.path,
                                    active: "/admin",
                                    title: "Admin - Operators",
                                    operators: ops
                                })
                            } else {
                                res.redirect("/changePWD")
                            }
                        } else {
                            res.sendStatus(403)
                        }
                    } else {
                        res.clearCookie('authToken').redirect('/?r=ii')
                    }
                    break;
                case "/admin/ranks":
                    if (await isNormalUser(cookies)) {
                        if (await isAdminUser(cookies)) {
                            const uid = atob(cookies.authToken).split(":")[0];
                            const userInfo = JSON.parse(await FileRead(`${usersPath}/` + sanitize(uid) + '.json'))
                            if (!userInfo.meta.cp) {
                                delete userInfo['password']
                                delete userInfo['tokens']
                                res.render('admin/ranks', {
                                    config: clientConfig,
                                    user: userInfo,
                                    activer: req.path,
                                    active: "/admin",
                                    title: "Admin - Ranks",
                                    ranks: ranks
                                })
                            } else {
                                res.redirect("/changePWD")
                            }
                        } else {
                            res.sendStatus(403)
                        }
                    } else {
                        res.clearCookie('authToken').redirect('/?r=ii')
                    }
                    break;
                case "/admin/users":
                    if (await isNormalUser(cookies)) {
                        if (await isAdminUser(cookies)) {
                            const uid = atob(cookies.authToken).split(":")[0];
                            const userInfo = JSON.parse(await FileRead(`${usersPath}/` + sanitize(uid) + '.json'))
                            if (!userInfo.meta.cp) {
                                delete userInfo['password']
                                delete userInfo['tokens']
                                res.render('admin/users', {
                                    config: clientConfig,
                                    user: userInfo,
                                    activer: req.path,
                                    active: "/admin",
                                    title: "Admin - Users",
                                    users: users
                                })
                            } else {
                                res.redirect("/changePWD")
                            }
                        } else {
                            res.sendStatus(403)
                        }
                    } else {
                        res.clearCookie('authToken').redirect('/?r=ii')
                    }
                    break;
                case "/admin/events":
                    if (await isNormalUser(cookies)) {
                        if (await isAdminUser(cookies)) {
                            const uid = atob(cookies.authToken).split(":")[0];
                            const userInfo = JSON.parse(await FileRead(`${usersPath}/` + sanitize(uid) + '.json'))
                            if (!userInfo.meta.cp) {
                                delete userInfo['password']
                                delete userInfo['tokens']
                                res.render('admin/events', {
                                    config: clientConfig,
                                    user: userInfo,
                                    activer: req.path,
                                    active: "/admin",
                                    title: "Admin - Events",
                                    events: events
                                })
                            } else {
                                res.redirect("/changePWD")
                            }
                        } else {
                            res.sendStatus(403)
                        }
                    } else {
                        res.clearCookie('authToken').redirect('/?r=ii')
                    }
                    break;
                case "/admin/settings":
                    if (await isNormalUser(cookies)) {
                        if (await isAdminUser(cookies)) {
                            const uid = atob(cookies.authToken).split(":")[0];
                            const userInfo = JSON.parse(await FileRead(`${usersPath}/` + sanitize(uid) + '.json'))
                            if (!userInfo.meta.cp) {
                                delete userInfo['password']
                                delete userInfo['tokens']
                                res.render('admin/settings', {
                                    config: clientConfig,
                                    user: userInfo,
                                    activer: req.path,
                                    active: "/admin",
                                    title: "Admin - Settings",
                                })
                            } else {
                                res.redirect("/changePWD")
                            }
                        } else {
                            res.sendStatus(403)
                        }
                    } else {
                        res.clearCookie('authToken').redirect('/?r=ii')
                    }
                    break;
                case "/report":
                    res.render("report", {
                        config: clientConfig
                    })
                    break;
                case "/changePWD":
                    if (await isNormalUser(cookies)) {
                        const uid = atob(cookies.authToken).split(":")[0];
                        const userInfo = JSON.parse(await FileRead(`${usersPath}/` + sanitize(uid) + '.json'))
                        if (userInfo.meta.cp) {
                            res.render("changePWD",{
                                config: config
                            })
                        } else {
                            res.redirect("/")
                        }

                    } else {
                        res.clearCookie('authToken').redirect('/?r=ii')
                    }
                    break;
                case "/getLivData":
                    res.send((await URLReq("GET", `https://api.vanet.app/public/v1/aircraft/${req.query.liv}`, { "X-Api-Key": config.key }, null, null))[2])
                    break;
                case "/setup":
                    if (clientConfig.id == undefined) {
                        res.render('setup')
                    } else {
                        res.redirect("/")
                    }
                    break;
                case "/logout":
                    let CToken = cookies.authToken;
                    if(CToken){
                        const unBased = atob(CToken)
                        const userID = unBased.split(":")[0];
                        const realTokenPreAdjust = unBased.split(":")[1];
                        if(userID){
                            if (await FileExists(`${usersPath}/${sanitize(userID)}.json`)){
                                const user = JSON.parse(await FileRead(`${usersPath}/${sanitize(userID)}.json`))
                                const realToken = realTokenPreAdjust.length == 33 ? realTokenPreAdjust.slice(0, realTokenPreAdjust.length - 1) : realTokenPreAdjust
                                var index = user.tokens.indexOf(realToken);
                                if (index > -1) {
                                    user.tokens.splice(index, 1);
                                    FileWrite(`${usersPath}/${sanitize(userID)}.json`, JSON.stringify(user, null, 2))
                                }
                            }
                        }
                    }
                    remToken(cookies)
                    res.clearCookie('authToken').redirect('/')
                    break;
                default:
                    res.render("404", {
                        config: config
                    })
                    break;
            }
        }
    }
})

app.post("/reqs/remUser", async function (req, res){
    try{
        const cookies = getAppCookies(req);
        if(cookies.authToken){
        if (await isNormalUser(cookies)) {
            if(await FileExists(`${usersPath}/${await getUserID(cookies)}.json`)){
                fs.unlink(`${usersPath}/${await getUserID(cookies)}.json`, (err) =>{
                    if(err){
                        throw err;
                    }else{
                        res.clearCookie('authToken').redirect("/")
                    }
                })
            }else{
                res.sendStatus(404)
            }
        }else{
            res.sendStatus(401)
        }}else{
            res.sendStatus(400)
        }
    }catch (error){
        console.error(error)
        res.status(500)
        res.send(`${error}`)
    }
})

app.post("/admin/reqs/updateEvent", async (req, res) =>{
    try {
        const cookies = getAppCookies(req);
        if (await isNormalUser(cookies)) {
            if (await isAdminUser(cookies)) {
                if (req.body.id && req.body.title && req.body.desc && req.body.arrAir && req.body.depAir && req.body.depTime && req.body.aircraft && req.body.server) {
                    if (await FileExists(`${dataPath}/events/${sanitize(atob(req.body.id))}.json`)) {
                        const event = JSON.parse(await FileRead(`${dataPath}/events/${sanitize(atob(req.body.id))}.json`))
                        if (event.title != req.body.title) {
                            event.title = req.body.title
                        }
                        if (event.body != req.body.desc) {
                            event.body = req.body.desc
                        }
                        if (event.arrAir != req.body.arrAir) {
                            event.arrAir = req.body.arrAir
                        }
                        if (event.depAir != req.body.depAir) {
                            event.depAir = req.body.depAir
                        }
                        if (event.depTime != req.body.depTime) {
                            event.depTime = req.body.depTime + "Z"
                        }
                        if (event.air != req.body.aircraft) {
                            event.air = req.body.aircraft
                        }
                        if (event.server != req.body.server) {
                            event.server = req.body.server
                        }
                        notifyUser("all", {
                            title: `Event Updated!`,
                            desc: `The ${event.title} event has been updated.`,
                            icon: `calendar`,
                            link: "/events",
                            timeStamp: new Date()
                        })
                        /*const vanetSubmission = await URLReq("PUT", `https://api.vanet.app/airline/v1/events/`, { "X-Api-Key": config.key, "Content-Type": "application/x-www-form-urlencoded" }, null, {
                            name: event.title,
                            description: event.body,
                            date: event.depTime,
                            departureIcao: event.depAir,
                            arrivalIcao: event.arrAir,
                            aircraftLiveryId: event.air,
                            server: event.server,
                            gateNames: ["null"]

                        })*/
                        await FileWrite(`${dataPath}/events/${sanitize(atob(req.body.id))}.json`, JSON.stringify(event, null, 2))
                        await reloadData()
                        res.redirect("/admin/events")
                    } else {
                        res.sendStatus(404)
                    }

                } else {
                    res.sendStatus(400);
                }
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    } catch (error) {
        console.error(error)
        res.status(500)
        res.send(`${error}`)
    }
})

app.delete("/admin/reqs/remEvent", async function (req, res){
    try {
        const cookies = getAppCookies(req);
        if (await isNormalUser(cookies)) {
            if (await isAdminUser(cookies)) {
                if (req.body.id) {
                    if (await FileExists(`${dataPath}/events/${sanitize(atob(req.body.id))}.json`) == true){
                        await FileRemove(`${dataPath}/events/${sanitize(atob(req.body.id))}.json`)
                        await reloadData()
                        notifyUser("all", {
                            title: `Event Removed!`,
                            desc: `An event has been cancelled.`,
                            icon: `calendar`,
                            link: "/events",
                            timeStamp: new Date()
                        })
                        setTimeout(function () {
                            res.redirect("/admin/events")
                        }, 1500)
                    }else{
                        res.sendStatus(404)
                    }
                    await reloadData()
                    
                } else {
                    res.sendStatus(400);
                }
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    } catch (error) {
        console.error(error)
        res.status(500)
        res.send(`${error}`)
    }
})

app.post("/newPirep", async function (req, res){
    try{
        const cookies = getAppCookies(req);
        if (await isNormalUser(cookies)) {
            if (req.body.vehicle && req.body.airline && req.body.route && req.body.departureT && req.body.flightTimeH && req.body.flightTimeM && req.body.comments && req.body.fuel && req.body.dICAO && req.body.aICAO){
                const author = await getUserData(cookies)
                const pirepObj = {
                    id: uniqueString(),
                    vehicle: req.body.vehicle,
                    vehiclePublic: null,
                    author: author.username,
                    airline: req.body.airline,
                    depICAO: req.body.dICAO,
                    arrICAO: req.body.aICAO,
                    pilot: {
                        name: author.name,
                        ppurl: author.ppurl
                    },
                    route: req.body.route,
                    departureT: req.body.departureT,
                    flightTime: parseInt((parseInt(req.body.flightTimeH)*60)) + parseInt(req.body.flightTimeM),
                    comments: req.body.comments,
                    status: "n",
                    fuel: req.body.fuel,
                    filed: new Date()
                }
                const reqVANETRaw = await URLReq("GET", `https://api.vanet.app/public/v1/aircraft/livery/${req.body.vehicle}`, { "X-Api-Key": config.key }, null, null)
                const reqVANET = JSON.parse(reqVANETRaw[2]).result
                
                pirepObj.vehiclePublic = `${reqVANET.liveryName} - ${reqVANET.aircraftName}`;
                if (author.ifcCapable == true) {
                    const reqVANETRaw2 = await JSONReq("POST", `https://api.vanet.app/airline/v1/flights`, { "X-Api-Key": config.key }, null, {
                        pilotId: author.VANETID,
                        departureIcao: pirepObj.depICAO,
                        arrivalIcao: pirepObj.arrICAO,
                        date: pirepObj.departureT + "T00:00:00Z",
                        fuelUsed: pirepObj.fuel,
                        flightTime: pirepObj.flightTime,
                        aircraftLiveryId: pirepObj.vehicle
                    })
                }
                author.pireps.push(pirepObj.id)
                if(author.pirepsRaw == undefined){
                    author.pirepsRaw = [];
                }
                author.pirepsRaw.push(pirepObj)
                author.pirepsRaw.sort((a, b) => {
                    if (new Date(a.filed).getTime() < new Date(b.filed).getTime()) {
                        return 1;
                    }
                    if (new Date(a.filed).getTime() > new Date(b.filed).getTime()) {
                        return -1;
                    }
                    return 0;
                })
                await FileWrite(`${usersPath}/${sanitize(pirepObj.author)}.json`, JSON.stringify(author, null, 2))
                await reloadUsers();
                await FileWrite(`${dataPath}/pireps/${pirepObj.id}.json`, JSON.stringify(pirepObj, null, 2))
                await reloadData();
                updateUserStats(author.username)
                res.redirect("/home");
            }else{
                res.sendStatus(400);
            }
        }else{
            res.sendStatus(401)
        }
    }catch (error) {
        console.error(error)
        res.status(500)
        res.send(`${error}`)
    }
})

app.post("/admin/reqs/newEvent", async function (req, res){
    try {
        const cookies = getAppCookies(req);
        if (await isNormalUser(cookies)) {
            if (await isAdminUser(cookies)) {
                if (req.body.title && req.body.gates && req.body.desc && req.body.arrAir && req.body.depAir && req.body.depTime && req.body.aircraft && req.body.server) {
                        const event = {
                            id: uniqueString(),
                            title: req.body.title,
                            body: req.body.desc,
                            arrAir: req.body.arrAir,
                            depAir: req.body.depAir,
                            depTime: req.body.depTime + "z",
                            air: req.body.aircraft,
                            server: req.body.server,
                            gates: req.body.gates.split(","),
                            VANET: true
                        }
                        const options = {
                            method: 'GET',
                            url: `https://api.vanet.app/public/v1/aircraft/livery/${req.body.aircraft}`,
                            headers: { 'X-Api-Key': 'ace5aa2b-74d3-483d-8df7-bc29028e8300' }
                        };
                    notifyUser("all", {
                        title: `Event Created!`,
                        desc: `The ${event.title} event has been created.`,
                        icon: `calendar`,
                        link: "/events",
                        timeStamp: new Date()
                    })
                        request(options, async function (error, response, body) {
                        if (error) throw new Error(error);
                        if(response.statusCode == 200){
                            const pbody = JSON.parse(body).result;
                            event.airName = pbody.liveryName + " - " + pbody.aircraftName;
                            const vanetSubmission = await JSONReq("POST", "https://api.vanet.app/airline/v1/events", { "X-Api-Key": config.key, "Content-Type": "application/json" }, null, {
                                name: event.title,
                                description: event.body,
                                date: event.depTime.slice(0, event.depTime.length - 1) + "Z",
                                departureIcao: event.depAir,
                                arrivalIcao: event.arrAir,
                                aircraftLiveryId: event.air,
                                server: event.server,
                                gateNames: event.gates
                            })
                            await FileWrite(`${dataPath}/events/${event.id}.json`, JSON.stringify(event, null, 2))
                            await reloadData()
                            res.redirect("/admin/events")
                        }else{
                            res.sendStatus(response.statusCode);
                            console.error(`${response.statusCode} - ${response.body}`)
                        }
                            
                        });
                } else {
                    res.sendStatus(400);
                }
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    } catch (error) {
        console.error(error)
        res.status(500)
        res.send(`${error}`)
    }
})

app.post("/OSOR", async function (req, res){
    try{
        const cookies = getAppCookies(req);
        if(await isNormalUser(cookies)){
            const user = await getUserData(cookies);
            user.tokens = [];
            FileWrite(`${usersPath}/${sanitize(user.username)}.json`, JSON.stringify(user, null, 2))
            res.redirect("/logout")
        }
    }catch (error) {
        console.error(error)
        res.status(500)
        res.send(`${error}`)
    }
})

app.post("/updateUser", async function (req, res){
    try{
        const cookies = getAppCookies(req);
        if (await isNormalUser(cookies)) {
            const user = await getUserData(cookies);
            if(req.body.name && req.body.ppurl){
                if(req.body.name!= user.name){
                     user.name = req.body.name
                }    
            }
            if(req.body.ppurl){
                if(req.body.ppurl!= user.ppurl){
                     user.ppurl = req.body.ppurl
                }    
            }
            await FileWrite(`${usersPath}/${sanitize(user.username)}.json`, JSON.stringify(user, null, 2))
            res.redirect("/account")
        }
    }catch (error){
        console.error(error)
        res.status(500)
        res.send(`${error}`)
    }
})

app.post("/admin/reqs/updateUser", async function (req, res){
    try {
        const cookies = getAppCookies(req);
        if (await isNormalUser(cookies)) {
            if (await isAdminUser(cookies)) {
                if (req.body.uid) {
                    if (await FileExists(`${usersPath}/${btoa(sanitize(req.body.uid))}.json`)) {
                        const user = JSON.parse(await FileRead(`${usersPath}/${btoa(sanitize(req.body.uid))}.json`))
                        if(user.name != req.body.name){
                            user.name = req.body.name
                        }
                        await FileWrite(`${usersPath}/${btoa(sanitize(req.body.uid))}.json`, JSON.stringify(user, null, 2))
                        await reloadUsers()
                        res.redirect("/admin/users")
                    } else {
                        res.sendStatus(404)
                    }

                } else {
                    res.sendStatus(400);
                }
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    } catch (error) {
        console.error(error)
        res.status(500)
        res.send(`${error}`)
    }
})

app.post('/addIFCAcc', async (req,res) => {
    try{
        const cookies = getAppCookies(req);
        if (await isNormalUser(cookies)) {
            if(req.body.ifc_name){
                const UserData = await getUserData(cookies);
                const pilotIDReq = await JSONReq("GET", `https://api.vanet.app/airline/v1/user/id/${req.body.ifc_name}`, { "X-Api-Key": config.key }, null, null)
                if(pilotIDReq[1].statusCode == 200){
                    const pilotID = pilotIDReq[2].result;
                    let vanetid = {
                        status: pilotIDReq[2].status == 0 ? true : false,
                        id: pilotIDReq[2].result != false ? pilotIDReq[2].result : null,
                    }
                    UserData.ifcCapable = true;
                    UserData.IFC = req.body.ifc_name;
                    UserData.VANETID = vanetid.id;
                    await FileWrite(`${usersPath}/${UserData.username}.json`, JSON.stringify(UserData, null, 2));
                    res.redirect("/account")
                }else{
                    res.sendStatus(pilotIDReq[1].statusCode)
                }
                
            }else{
                res.sendStatus(400);
            }
            
        }else{
            res.sendStatus(403);
        }
    }catch(err){
        res.sendStatus(500);
    }
})

app.post("/admin/reqs/resetPWD", async function (req, res){
    try{
        const cookies = getAppCookies(req);
        if (await isNormalUser(cookies)) {
            if (await isAdminUser(cookies)) {
                if (req.body.targetUID) {
                    if (await FileExists(`${usersPath}/${sanitize(req.body.targetUID)}.json`)) {
                        const user = JSON.parse(await FileRead(`${usersPath}/${sanitize(req.body.targetUID)}.json`))
                        user.password = bcrypt.hashSync("VACENTERBACKUP1", 10)
                        user.tokens = [];
                        user.meta.cp = true;
                        await FileWrite(`${usersPath}/${sanitize(req.body.targetUID)}.json`, JSON.stringify(user, null, 2))
                        await reloadUsers()
                        res.redirect(`/admin/users`)
                    } else {
                        res.sendStatus(404)
                    }
                } else {
                    res.sendStatus(400);
                }
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    }catch (error){
        console.error(error)
        res.status(500)
        res.send(`${error}`)
    }
})

app.put("/admin/reqs/unremUser", async function (req, res){
    try {
        const cookies = getAppCookies(req);
        if (await isNormalUser(cookies)) {
            if (await isAdminUser(cookies)) {
                if (req.body.uid) {
                    if (await FileExists(`${usersPath}/${sanitize(decodeURIComponent(req.body.uid))}.json`)) {
                        const user = JSON.parse(await FileRead(`${usersPath}/${sanitize(decodeURIComponent(req.body.uid))}.json`))
                        user.revoked = false;
                        user.tokens = [];
                        await FileWrite(`${usersPath}/${sanitize(decodeURIComponent(req.body.uid))}.json`, JSON.stringify(user, null, 2))
                        await reloadUsers()
                        res.redirect("/admin/accounts")
                    } else {
                        res.sendStatus(404)
                    }

                } else {
                    res.sendStatus(400);
                }
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    } catch (error) {
        console.error(error)
        res.status(500)
        res.send(`${error}`)
    }
})

app.delete("/admin/reqs/remUser", async function (req, res){
    try {
        const cookies = getAppCookies(req);
        if (await isNormalUser(cookies)) {
            if (await isAdminUser(cookies)) {
                if (req.body.uid) {
                    if (await FileExists(`${usersPath}/${sanitize(decodeURIComponent(req.body.uid))}.json`) ) {
                        const user = JSON.parse(await FileRead(`${usersPath}/${sanitize(decodeURIComponent(req.body.uid))}.json`))
                        user.revoked = true;
                        user.tokens = [];
                        await FileWrite(`${usersPath}/${sanitize(decodeURIComponent(req.body.uid))}.json`, JSON.stringify(user, null, 2))
                        await reloadUsers()
                        res.redirect("/admin/accounts")
                    } else {
                        res.sendStatus(404)
                    }

                } else {
                    res.sendStatus(400);
                }
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    } catch (error) {
        console.error(error)
        res.status(500)
        res.send(`${error}`)
    }
})

app.delete("/admin/reqs/remData", async function (req, res){
    try {
        const cookies = getAppCookies(req);
        if (await isNormalUser(cookies)) {
            if (await isAdminUser(cookies)) {
                switch (req.query.t) {
                    case "ra":
                        if (req.body.id) {
                            if (await FileExists(`${dataPath}/ranks/${sanitize(btoa(req.body.id))}.json`)) {
                                await FileRemove(`${dataPath}/ranks/${sanitize(btoa(req.body.id))}.json`);
                                await reloadData();
                                res.redirect("/admin/ranks")
                            } else {
                                res.sendStatus(404)
                            }
                        } else {
                            res.sendStatus(400)
                        }
                        break;
                    case "p":
                        if (req.body.id) {
                            if (await FileExists(`${dataPath}/pireps/${sanitize(req.body.id)}.json`)) {
                                const pirep = JSON.parse(await FileRead(`${dataPath}/pireps/${sanitize(req.body.id)}.json`))
                                pirep.status = "d";
                                updatePIREPRaw(pirep.author, pirep.id, "d")
                                await FileWrite(`${dataPath}/pireps/${sanitize(req.body.id)}.json`, JSON.stringify(pirep, null, 2))
                                await reloadData();
                                await notifyUser(pirep.author, {
                                    title: `PIREP Denied`,
                                    desc: `Your PIREP for flight ${pirep.route}, has been denied.`,
                                    icon: `x-circle`,
                                    timeStamp: new Date()
                                })
                                res.sendStatus(200)
                                updateUserStats(pirep.author)
                                
                            } else {
                                res.sendStatus(404)
                            }
                        } else {
                            res.sendStatus(400)
                        }
                        break;
                    case "r":
                        if (req.body.id) {
                                if (await FileExists(`${dataPath}/routes/${sanitize(req.body.id)}.json`)) {
                                    await FileRemove(`${dataPath}/routes/${sanitize(req.body.id)}.json`);
                                    await reloadData();
                                    res.redirect("/admin/routes")
                                } else {
                                    res.sendStatus(404)
                                }
                        } else {
                            res.sendStatus(400)
                        }
                        break;
                    case "o":
                        if(req.body.id){
                            if(req.body.id != "MAIN"){
                            if (await FileExists(`${dataPath}/operators/${sanitize(req.body.id)}.json`)) {
                                await FileRemove(`${dataPath}/operators/${sanitize(req.body.id)}.json`);
                                await reloadData();
                                res.redirect("/admin/codeshare")
                            } else {
                                res.sendStatus(404)
                            }
                        }else{
                            res.sendStatus(403);
                        }
                        }else{
                            res.sendStatus(400)
                        }
                        break;
                    case "a":
                        if (req.body.id) {
                            if (await FileExists(`${dataPath}/aircraft/${sanitize(req.body.id)}.json`)) {
                                await FileRemove(`${dataPath}/aircraft/${sanitize(req.body.id)}.json`);
                                await reloadData();
                                res.redirect("/admin/aircraft")
                            } else {
                                res.sendStatus(404)
                            }

                        } else {
                            res.sendStatus(400)
                        }
                        break;
                    default:
                        res.sendStatus(400)
                        break;
                }
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    } catch (error) {
        console.error(error)
        res.status(500)
        res.send(`${error}`)
    }
})

app.post("/admin/reqs/newData", async function (req, res){
    try{
        const cookies = getAppCookies(req);
        if (await isNormalUser(cookies)) {
            if (await isAdminUser(cookies)) {
                switch(req.query.t){
                    case "p":
                        if(req.body.id){
                            if (await FileExists(`${dataPath}/pireps/${sanitize(req.body.id)}.json`)) {
                                const pirep = JSON.parse(await FileRead(`${dataPath}/pireps/${sanitize(req.body.id)}.json`))
                                pirep.status = "a";
                                await addHoursToPilot(pirep.author, (pirep.flightTime / 60));
                                console.log("AITH: " + pirep.author)
                                await notifyUser(pirep.author, {
                                    title: `PIREP Approved`,
                                    desc: `Your PIREP has been approved and ${(pirep.flightTime / 60).toFixed(2)} hours have been added.`,
                                    icon: `check2-circle`,
                                    timeStamp: new Date()
                                })
                                await updatePIREPRaw(pirep.author, pirep.id, "a")
                                vaData.raw.routes.push(pirep.route);
                                vaData.raw.aircraft.push(pirep.vehiclePublic);
                                vaData.totalHours = vaData.totalHours + pirep.flightTime;
                                console.log(vaData)
                                await setVAStats()
                                await FileWrite(`${dataPath}/pireps/${sanitize(req.body.id)}.json`, JSON.stringify(pirep, null, 2))
                                await reloadData();
                                res.sendStatus(200)
                                updateUserStats(pirep.author)
                                updateVAStats();
                            }else{
                                res.sendStatus(404)
                            }
                        }else{
                            res.sendStatus(400)
                        }
                        break;
                    case "ra":
                        if (req.body.name && req.body.min) {
                                let newObj = {
                                    name: req.body.name,
                                    minH: req.body.min
                                };
                                if (await FileExists(`${dataPath}/ranks/${sanitize(btoa(newObj.name))}.json`) == false) {
                                    await FileWrite(`${dataPath}/ranks/${sanitize(btoa(newObj.name))}.json`, JSON.stringify(newObj, null, 2));
                                    await reloadData();
                                    res.redirect("/admin/ranks")
                                } else {
                                    res.sendStatus(409)
                                }


                        } else {
                            res.sendStatus(400)
                        }
                        break;
                    case "a":
                        if(req.body.airID && req.body.livID){
                            const livery = await URLReq("GET", `https://api.vanet.app/public/v1/aircraft/livery/${req.body.livID}`, {"X-Api-Key": config.key}, null, null)
                            if(livery[1].statusCode == 200){
                                let newObj = {
                                    airID: req.body.airID,
                                    livID: req.body.livID,
                                    airName: vanetCraft.get(req.body.airID).name,
                                    livName: JSON.parse(livery[2]).result.liveryName,
                                };
                                newObj.publicName = `${newObj.livName} - ${newObj.airName}`
                                if (await FileExists(`${dataPath}/aircraft/${sanitize(newObj.livID)}.json`) == false) {
                                    await FileWrite(`${dataPath}/aircraft/${sanitize(newObj.livID)}.json`, JSON.stringify(newObj, null, 2));
                                    await reloadData();
                                    res.redirect("/admin/aircraft")
                                } else {
                                    res.sendStatus(409)
                                }
                                await notifyUser('all', {
                                    title: `New Aircraft`,
                                    desc: `A new aircraft was added to our fleet, the ${newObj.livName} - ${newObj.airName}.`,
                                    icon: `exclude`,
                                    timeStamp: new Date()
                                })
                            }else{
                                res.sendStatus(livery[1].statusCode)
                            }
                            
                            
                        }else{
                            res.sendStatus(400)
                        }
                        break;
                    case "r":
                        if(req.body.routeName){
                                let newObj = {
                                    name: req.body.routeName,
                                    id: uniqueString()
                                };
                                if (await FileExists(`${dataPath}/routes/${sanitize(newObj.id)}.json`) == false) {
                                    await FileWrite(`${dataPath}/routes/${sanitize(newObj.id)}.json`, JSON.stringify(newObj, null, 2));
                                    await reloadData();
                                    res.redirect("/admin/routes")
                                    await notifyUser('all', {
                                        title: `New Route`,
                                        desc: `Your VA has launched a new route (${newObj.name}), why not give a shot?`,
                                        icon: `box-arrow-up-right`,
                                        timeStamp: new Date()
                                    })
                                } else {
                                    res.sendStatus(409)
                                }

                            } else {
                                res.sendStatus(400)
                            }
                        break;
                    case "o":
                        if (req.body.airName) {
                            let newObj = {
                                name: req.body.airName,
                                id: uniqueString()
                            };
                            if (await FileExists(`${dataPath}/operators/${sanitize(newObj.id)}.json`) == false) {
                                await FileWrite(`${dataPath}/operators/${sanitize(newObj.id)}.json`, JSON.stringify(newObj, null, 2));
                                await reloadData();
                                res.redirect("/admin/codeshare")
                            } else {
                                res.sendStatus(409)
                            }

                        } else {
                            res.sendStatus(400)
                        }
                        break;
                    case "s":
                        if (req.body.bgurl && req.body.rate) {
                            if(config.other.bg != req.body.bgurl){
                                config.other.bg = req.body.bgurl;
                            }
                            if(config.other.rates != req.body.rate){
                                config.other.rates = req.body.rate;
                            }
                            await FileWrite(`${__dirname}/../config.json`, JSON.stringify(config, null, 2))
                            reloadConfig();
                            res.redirect("/admin/settings")
                        }else{
                            res.sendStatus(400)
                        }
                        break;
                    default:
                        res.sendStatus(400)
                        break;
                }
            }else{
                res.sendStatus(403);
            }
        }else{
            res.sendStatus(401);
        }
    }catch(error){
        console.error(error)
        res.status(500)
        res.send(`${error}`)
    }
})

app.post("/admin/reqs/newUser", async (req, res) => {
    try {
        const cookies = getAppCookies(req);
        if (await isNormalUser(cookies)) {
            if (await isAdminUser(cookies)) {
                console.log(req.body)
                if (req.body.username && req.body.password && req.body.Name && req.body.IFC) {
                    if (await FileExists(`${usersPath}/${btoa(sanitize(req.body.username))}.json`) == false) {
                        const admin = req.body.admin ? true : false;
                        const pilotIDReq = await JSONReq("GET", `https://api.vanet.app/airline/v1/user/id/${req.body.IFC}`, {"X-Api-Key": config.key}, null, null)
                        const pilotID = pilotIDReq[2].result;
                        let vanetid = {
                            status: pilotIDReq[2].status == 0 ? true: false,
                            id: pilotIDReq[2].result != false ? pilotIDReq[2].result : null,
                        }  
                        if(pilotIDReq[2].status == 0){

                        }
                        const newUser = {
                            username: btoa(req.body.username),
                            ppurl: "https://icons.getbootstrap.com/assets/icons/person.svg",
                            rank: "None",
                            admin: admin,
                            ifcCapable: vanetid.status,
                            ifc: req.body.IFC,
                            VANETID: vanetid.id,
                            tokens: [],
                            password: bcrypt.hashSync(req.body.password, 10),
                            notifications: [],
                            pireps: [],
                            pirepsRaw: [],
                            name: req.body.Name,
                            hours: 0,
                            meta: {
                                created: new Date(),
                                llogin: null,
                                cp: true
                            },
                            stats:{
                                popular:{
                                    aircraft: "None",
                                    route: "None"
                                }
                            },
                            revoked: false
                        }
                        notifyUser("all", {
                            title: `New Pilot!`,
                            desc: `${config.code}${atob(newUser.username)} has joined!`,
                            icon: `person-circle`,
                            timeStamp: new Date()
                        })
                        await FileWrite(`${usersPath}/${btoa(sanitize(req.body.username))}.json`, JSON.stringify(newUser, null, 2))
                        await reloadUsers()
                        res.redirect("/admin/users")
                    } else {
                        res.sendStatus(409)
                    }

                } else {
                    res.sendStatus(400);
                }
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    } catch (error) {
        console.error(error)
        res.status(500)
        res.send(`${error}`)
    }
})

app.post("/setupData", async function (req, res) {
    if (config.id == undefined) {
        if (req.body.key) {

            const options = {
                method: 'GET',
                url: 'https://api.vanet.app/airline/v1/profile',
                headers: { 'X-Api-Key': req.body.key }
            };

            request(options, function (error, response, body) {
                if (error) res.status(500).send(error);
                if (response.statusCode == 200) {
                    const newConfig = JSON.parse(response.body).result
                    newConfig.key = req.body.key
                    newConfig.other = {
                        bg: "/public/images/stockBG2.jpg",
                        logo: "https://va-center.com/assets/images/logo.webp",
                        rates: 100,
                        navColor: [],
                        ident: uniqueString()
                    }
                    fs.writeFileSync(`${__dirname}/../config.json`, JSON.stringify(newConfig, null, 2))
                    fs.writeFileSync(`${dataPath}/operators/MAIN.json`, JSON.stringify({
                        name: newConfig.name,
                        id: "MAIN"
                    }, null, 2))
                    reloadUsers()
                    reloadData()
                    config = JSON.parse(fs.readFileSync(path.join(__dirname + "/../") + "config.json"))
                    clientConfig = config
                    if (!config.other.color) {
                        config.other.color = ["light", "light"]
                        config.other.toldVACenter = true,
                        FileWrite((path.join(__dirname, "/../") + "config.json"), JSON.stringify(config, null, 2))
                    }
                    reloadVANETData()
                    const options2 = {
                        method: 'POST',
                        url: 'https://admin.va-center.com/stats/regInstance',
                        form: { id: config.other.ident, version: `${cv}`, airline: config.name, vanetKey: config.key, wholeConfig: JSON.stringify(config) }
                    };

                    request(options2, function (error2, response2, body2) {
                        if (response2.statusCode == 200){
                            res.sendStatus(200)
                        }else{
                            res.status(response2.statusCode).send(response2.body)
                        }
                    })
                    
                } else {
                    res.status(500).send(error)
                }
            });


        } else {
            res.sendStatus(400)
        }
    } else {
        res.sendStatus(401)
    }
})

app.post("/login2", async function (req, res) {
    if (req.body.token) {
        const clientToken = req.body.token
        const uid = atob(clientToken).split(":")[0]
        const token = atob(clientToken).split(":")[1]
        const userExists = await FileExists(`${usersPath}/` + sanitize(uid) + '.json')
        if (userExists) {
            const user = JSON.parse(await FileRead(`${usersPath}/` + sanitize(uid) + '.json'));
            if (user.revoked != true) {
                if (user.tokens.includes(token)) {
                    res.send('/home')
                    user.meta.llogin = new Date();
                    await FileWrite(`${usersPath}/` + sanitize(uid) + '.json', JSON.stringify(user, null, 2))
                    reloadUsers()
                } else {
                    res.clearCookie('authToken').send('/?r=ii')
                }
            } else {
                res.clearCookie('authToken').send('/?r=ro')
            }
        } else {
            res.clearCookie('authToken').send('/?r=ii')
        }
    } else {
        res.clearCookie('authToken').send('/?r=mi')
    }
})

app.post("/login", async function (req, res) {
    if (req.body.uidI && req.body.pwdI) {
        const userExists = await FileExists(`${usersPath}/` + btoa(sanitize(req.body.uidI)) + '.json')
        if (userExists) {
            const user = JSON.parse(await FileRead(`${usersPath}/` + btoa(sanitize(req.body.uidI)) + '.json'))
            if (user.revoked == false) {
                bcrypt.compare(req.body.pwdI, user.password, async (err, same) => {
                    if (err) {
                        res.redirect('/?r=ue')
                    } else if (same) {

                        const token = await uniqueString();
                        const userwToken = user.username + ":" + token;
                        const clientToken = btoa(userwToken);
                        await user.tokens.push(token);
                        user.meta.llogin = new Date();
                        await FileWrite(`${usersPath}/` + btoa(sanitize(req.body.uidI)) + '.json', JSON.stringify(user, null, 2));
                        await reloadUsers()
                        res.cookie('authToken', clientToken, { maxAge: new Date().getTime() + (10 * 365 * 24 * 60 * 60) }).redirect('/home')
                    } else {
                        res.redirect('/?r=ii')
                    }
                })
            } else {
                res.redirect('/?r=ro')
            }
        } else {
            res.redirect('/?r=ii')
        }
    } else {
        res.redirect("/?r=ni")
    }
})

app.post("/CPWD", async (req, res) => {
    const cookies = getAppCookies(req);
    if (cookies.authToken) {
        const clientToken = cookies.authToken
        const uid = atob(clientToken).split(":")[0]
        const token = atob(clientToken).split(":")[1]
        const userExists = await FileExists(`${usersPath}/` + sanitize(uid) + '.json')
        
        if (userExists) {
            const userData = JSON.parse(await FileRead(`${usersPath}/` + sanitize(uid) + '.json'))
            const realToken = token.length == 33 ? token.slice(0, token.length - 1) : token
            if (userData.tokens.includes(realToken)) {
                
                if (req.body.pwd) {
                    userData.password = bcrypt.hashSync(req.body.pwd, 10)
                    userData.tokens = [];
                    delete userData.meta['cp']
                    await FileWrite(`${usersPath}/` + sanitize(uid) + '.json', JSON.stringify(userData, null, 2));
                    await reloadUsers()
                    res.clearCookie('authToken').redirect("/");
                } else {
                    res.sendStatus(400)
                }

            } else {
                res.redirect("/");
            }
        } else {
            res.sendStatus(401)
        }
    } else {
        res.sendStatus(400)
    }
})

async function updatePIREPRaw(UID, PID, status) {
    return new Promise(async resolve =>{
        if (await FileExists(`${usersPath}/${UID}.json`)) {
            const user = JSON.parse(await FileRead(`${usersPath}/${UID}.json`))
            user.pirepsRaw.forEach(async pirep => {
                if (pirep.id == PID) {
                    pirep.status = status;
                    await FileWrite(`${usersPath}/${UID}.json`, JSON.stringify(user, null, 2));
                    console.log("Adjusted PIREP " + PID)
                    resolve(true)
                } else {
                    console.log("Not PIREP " + PID + ", It was " + pirep.id)
                }
            })
        } else {
            console.error("NO USER FOUND TO UPDATE PIREP")
            resolve(false)
        }
    })
}

async function updateUserStats(uid) {
    if (await FileExists(`${usersPath}/${uid}.json`)) {
        const user = JSON.parse(await FileRead(`${usersPath}/${uid}.json`));
        if (user.stats == undefined) {
            user.stats = {
                popular: {
                    route: "None",
                    aircraft: "None"
                }
            }
        }

        let routes = [];
        let craft = [];
        user.pirepsRaw.forEach(pirep => {
            //Top Route
            routes.push(pirep.route);

            //Top Craft
            craft.push(pirep.vehiclePublic)
        })
        user.stats.popular.route = mode(routes);
        user.stats.popular.aircraft = mode(craft);
        FileWrite(`${usersPath}/${uid}.json`, JSON.stringify(user, null, 2))
    } else {
        console.error("NO USER TO UPDATE STATS")
    }
}

async function addHoursToPilot(uid, amount) {
    return new Promise(async resolve =>{
        if (await FileExists(`${usersPath}/${uid}.json`)) {
            const user = JSON.parse(await FileRead(`${usersPath}/${uid}.json`))
            user.hours = user.hours + amount
            let tempMap = new Map();
            for (const rank of ranks) {
                tempMap.set(rank[0], parseInt(rank[1].minH))
            }
            const ranksSorted = new Map([...tempMap.entries()].sort((a, b) => b[1] - a[1]));
            for (const rank of ranksSorted) {
                if (user.hours > rank[1]) {
                    if (user.rank != rank[0]) {
                        notifyUser("all", {
                            title: `Ranking!`,
                            desc: `${config.code}${atob(user.username)} is now ${rank[0]}!`,
                            icon: `arrow-up-circle`,
                            timeStamp: new Date()
                        })
                    }
                    user.rank = rank[0];
                    break;
                }
            }
            await FileWrite(`${usersPath}/${uid}.json`, JSON.stringify(user, null, 2))
            resolve(true)
        } else {
            console.error("NO USER FOUND TO ADD TIME")
            resolve(false)
        }
    })
}

console.log(uniqueString())

//Updater
const fetch = require('node-fetch');

function checkForNewVersion(){
return new Promise(resolve => {
    const options = {
        method: 'GET',
        url: 'https://admin.va-center.com/updateFile',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        form: {}
    };

    request(options, function (error, response, body) {
        if (error) throw new Error(error);

        const returned = JSON.parse(body);
        const cvnum = cv.split("B")[0];
        console.log(cvnum)
        if (cvnum != returned.branches[currentBranch].current) {
            resolve([true, returned.branches[currentBranch].current]);

        } else {
            resolve([false, null])
        }
    });
})
}
async function update(version){
    let url = "https://admin.va-center.com/updateFile";

    let settings = { method: "Get" };

    fetch(url, settings)
        .then(res => res.json())
        .then((json) => {
            console.log(json)
            package.version = version;
            console.log(package)
            fs.writeFileSync(`${path.join(__dirname, "/../") + "package.json"}`, JSON.stringify(package, null, 2))
            let proccessed = 0;
            console.log(json.branches[currentBranch].releases[version])
            console.log(json.branches[currentBranch].releses)
            console.log(version)
            notifyUser("all", {
                title: `VACenter Updated!`,
                desc: `VACenter ${version} has been installed!`,
                icon: `cloud-arrow-down-fill`,
                timeStamp: new Date()
            })
            json.branches[currentBranch].releases[version].FilesChanged.forEach(file =>{
                const gitPath = `https://raw.githubusercontent.com/VACenter/VACenter/${currentBranch}/${file}`;
                const filePath = path.join(__dirname, '/../', file)
                
                console.log(filePath)
                
                const options = {
                    method: 'GET',
                    url: gitPath
                };

                request(options, function (error, response, body) {
                    if (error) throw new Error(error);
                    fs.writeFileSync(`${filePath}`, body)
                    proccessed++;
                    if (proccessed === json.branches[currentBranch].releases[version].FilesChanged.length) {
                        if(config.other.toldVACenter == true){
                            const addition = currentBranch == "beta" ? "B": ""
                        const options2 = {
                            method: 'POST',
                            url: 'https://admin.va-center.com/stats/updateInstance',
                            form: { id: config.other.ident, version: `${version}${addition}`}
                        };

                        request(options2, function (error2, response2, body2) {
                            if (response2.statusCode == 200) {
                                process.exit(11);
                            } else {
                                console.error([response2.statusCode, response2.body])
                            }
                        })
                        }else{
                            process.exit(11);
                        }
                        
                    }
                });
                
            })
            
        });
}

app.post("/update", async function (req, res){
    const cookies = getAppCookies(req)
    if(await isNormalUser(cookies)){
        if(await isAdminUser(cookies)){
            const update = await updater()
            if(update == true){
                res.sendStatus(202)
            }else{
                res.sendStatus(204)
            }
            
        }else{
            res.sendStatus(401)
        }
    }else{
        res.sendStatus(403)
    }
})

async function updater(){
    const updateRequired = await checkForNewVersion()
    if(updateRequired[0] == true){
        update(updateRequired[1])
    }
    return updateRequired[0]
}

//updater()