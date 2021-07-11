//@ts-check

//Dependancies
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const express = require('express')
require('dotenv').config()

//Parts
const {FileWrite, FileRead, FileExists, FileRemove} = require('./fileFunctions.js')

//App
const app = express();
app.set('view engine', "ejs");
app.set('views', path.join(__dirname, '/../views'));

app.listen(process.env.PORT);