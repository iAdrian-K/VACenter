//@ts-check

//Dependancies
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const express = require('express');
var bodyParser = require('body-parser')
require('dotenv').config()

//Parts
const {FileWrite, FileRead, FileExists, FileRemove} = require('./fileFunctions.js')
const {JSONReq, URLReq, MethodValues} = require("./urlreqs")
const { db, GetUser, GetUsers, CreateUser, GetPirep, GetPireps, CreatePirep, GetEvent, GetEvents, CreateEvent } = require("./db")
const _tplengine = require('./defaultpagevar');
/**
 * @typedef {import('./types.js').user} User
 */


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
            }
        }else{
        switch(req.path){
            case "/":
                res.render("login")
                break;
            case "/setup":
                console.log(await GetEvents())
                res.render("setup")
                break;
            default:
                res.render("404")
                break;
        }
        }
    }
})

//login
app.post("/login", async (req,res) =>{
    if(req.body.user && req.body.pwd){
        const userArr = await GetUser(req.body.id);
        if (userArr.length == 1){
            const user = userArr[0];
            if(bcrypt.compareSync(req.body.password, user.password) == true){
                //
            }else{
                res.redirect('/login?r=ie');
            }
        }else{
            res.redirect('/login?r=ie')
        }
    }else{
        res.sendStatus(404)
    }
})