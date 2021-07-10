//Dependancies
const express = require('express');
const btoaData = require('btoa');
const atobData = require('atob');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
require('dotenv').config()

//Paths
const viewPath = path.join(__dirname, '/../views/')

//Express App
const app = express();
app.set('view engine', 'ejs');
app.set('views', viewPath)
app.listen(process.env.port, ()=>{
    console.log("Listening on " + process.env.port);
});

//Get
app.get('*', async(req, res)=>{
    if(req.path.slice(0,8)=="/public/"){
        if(fs.existsSync(`${__dirname}/../${req.path}`)){
            res.sendFile(`${__dirname}/../${req.path}`)
        }else{
            res.sendStatus(404);
        }
    }else{
        switch(req.path){
            case "/":
                res.render("login")
                break;
            default:
                res.render('404');
                break;
        }
    }
})