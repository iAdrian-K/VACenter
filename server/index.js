//@ts-check

//Dependancies
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const express = require('express')
require('dotenv').config()

//Parts
const {FileWrite, FileRead, FileExists, FileRemove} = require('./fileFunctions.js')
const {JSONReq, URLReq, MethodValues} = require("./urlreqs")
const _tplengine = require('./defaultpagevar');


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
                res.render("setup")
                break;
            default:
                res.render("404")
                break;
        }
        }
    }
})