//@ts-check

//Dependancies
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const express = require('express');
var bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
require('dotenv').config()

//Versioning
let branch = "beta"
let cvn = require("./../package.json").version;
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



//Parts
const {FileWrite, FileRead, FileExists, FileRemove} = require('./fileFunctions.js')
const {JSONReq, URLReq, MethodValues} = require("./urlreqs")
const { 
    db, GetPPURL,
    GetUser, GetUsers, CreateUser,
    GetPirep, GetPireps, CreatePirep,
    GetEvent, GetEvents, CreateEvent,
    GetToken, CreateToken,
    GetAircraft, GetAircrafts, CreateAircraft,
    GetOperator, GetOperators, CreateOperator,
    GetRoute, GetRoutes, CreateRoute
    } = require("./db")
const _tplengine = require('./defaultpagevar');
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

//Config
let config;
/**
 * Reloads Config
 * @name Reload Config
 */
function reloadConfig(){
    return new Promise(async (resolve, error) => {
        config = JSON.parse(await FileRead(`${__dirname}/../config.json`));
        console.log(config)
        resolve(true);
    })
    
}
reloadConfig()


//App
const app = express();
app.set('view engine', "ejs");
app.set('views', path.join(__dirname, '/../views'));
app.engine('ejs', _tplengine);
app.listen(process.env.PORT);
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
//app.use(cookieParser());

//Util Funcs
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
            const UID = await GetToken(cookies.authToken)
            if (UID) {
                const user = await GetUser(UID);
                if (user) {
                    resolve(user);
                } else {
                    resolve(false);
                }
            } else {
                resolve(false);
            }
        }else{
            resolve(false);
        }
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
            const user = await checkForUser(cookies);
            if(changePWD == true && req.path != "/changePWD"){
                res.redirect('/changePWD');
            }else{
                switch(req.path){
                    case "/":
                        if(user){
                            res.redirect("/home");
                        }else{
                        res.render("login")
                        }
                        break;
                    case "/home":
                        res.render("home")
                        break;
                    case "/report":
                        res.render("report")
                        break;
                    case "/setup":
                        if(config.other){
                            res.redirect("/")
                        }else{
                            res.render("setup")
                        }
                        break;
                    default:
                        res.render("404");
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
        console.log(1)
        const Req = await URLReq(MethodValues.GET, "https://api.vanet.app/airline/v1/profile", { 'X-Api-Key': req.body.key}, null, null)
        console.log(2)
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