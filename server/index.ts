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
app.set('view', viewPath)
app.listen(process.env.port, ()=>{
    console.log("Listening on " + process.env.port);
});