//Dependancies
const express = require('express');
const btoaData = require('btoa');
const atobData = require('atob');
const bcrypt = require('bcrypt');
//@ts-ignore
const fs = require('fs');
const path = require('path');
require('dotenv').config();
//Parts
//@ts-ignore
const { ReadFile, WriteFile, ExistsFile, RemoveFile } = require("./fileCommands");
//@ts-ignore
const { db, GetUser } = require("./db");
//Paths
const viewPath = path.join(__dirname, '/../views/');
//Express App
const app = express();
app.set('view engine', 'ejs');
app.set('views', viewPath);
app.listen(process.env.port, () => {
    console.log("Listening on " + process.env.port);
});
//Config
let config = {};
async function reloadConfig() {
    const rawConfig = await ReadFile(`${__dirname}/../config.json`);
    //@ts-ignore
    config = JSON.parse(rawConfig);
    console.log(config);
}
reloadConfig();
//Get
app.get('*', async (req, res) => {
    if (req.path.slice(0, 8) == "/public/") {
        if (fs.existsSync(path.join(__dirname, "..", req.path))) {
            res.sendFile(path.join(__dirname, "..", req.path));
        }
        else {
            res.sendStatus(404);
        }
    }
    else {
        switch (req.path) {
            case "/":
                res.render("login", {
                    config: config
                });
                break;
            default:
                res.render('404', {
                    config: config
                });
                break;
        }
    }
});
