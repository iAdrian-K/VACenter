//Dependancies
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const express = require('express')
require('dotenv').config()

//App
const app = express();
app.listen(process.env.PORT)