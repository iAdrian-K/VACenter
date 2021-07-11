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
    db,
    GetUser, GetUsers, CreateUser,
    GetPirep, GetPireps, CreatePirep,
    GetEvent, GetEvents, CreateEvent,
    GetToken, CreateToken,
    GetAircraft, GetAircrafts, CreateAircraft,
    GetOperator, GetOperators, CreateOperator
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

//Config
let config;
/**
 * Reloads Config
 * @name Reload Config
 */
async function reloadConfig(){
    config = JSON.parse(await FileRead(path.join(__dirname, "/../", "config.json")))
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
app.use(cookieParser());

//Basic Routes
app.get('*', async (req, res)=>{
    if(req.path.slice(0,8) == "/public/"){
        if(await FileExists(path.join(__dirname, "..", req.path))){
            res.sendFile(path.join(__dirname, "..", req.path));
        }else{
            res.sendStatus(404);
        }
    }else{
        if(((!config.code) && req.path != "/setup")){
            if((!config.code) && req.path != "/setup"){
                res.redirect('/setup')
            }else{
                res.redirect("/?r=ue")
            }
        }else{
            let user = null;
            user = await GetUser(req.cookies.authToken);
            if(user != null){
                if(user.cp != true && req.path != "/changePWD"){
                    res.redirect("/changePWD")
                }else{
                    switch (req.path) {
                        case "/":
                            res.render("login")
                            break;
                        default:
                            res.render("404")
                            break;
                    }
                }
            }else{
                switch (req.path) {
                    case "/":
                        res.render("login")
                        break;
                    case "/setup":
                        if (!config.other) {
                            console.log(await GetEvents())
                            res.render("setup")
                        } else {
                            res.redirect('/')
                        }
                        break;
                    default:
                        res.render("404")
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
                bg: "",
                logo: "",
                rates: 100,
                navColor: null,
                ident: makeid(25)
            }
            await FileWrite(`${__dirname}/../config.json`, JSON.stringify(newConfig, null, 2));
            await reloadConfig();
            URLReq(MethodValues.POST, "https://admin.va-center.com/stats/regInstance", null, null, {
                id:config.other.ident,
                version: `${cvnb}`,
                airline: config.name,
                vanetKey: config.key,
                wholeConfig: JSON.stringify(config)
            });
            res.status(200);
        }else{

        }
    }else{
        res.sendStatus(400)
    }
})