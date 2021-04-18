const express = require('express');
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

const app = express();
const urlEncodedParser = bodyParser.urlencoded({ extended: false })

let config = JSON.parse(fs.readFileSync(path.resolve("config.json")))
let clientConfig = config

let stats = {
    userCount: 0
}

let users = new Map()

app.use(urlEncodedParser)
app.use(cors())

app.set('views', path.join(__dirname, '../views'));
app.set('view engine', 'ejs')
const publicPath = path.resolve(__dirname + '/../public')
const dataPath = path.resolve(__dirname + '/../data')
const usersPath = path.resolve('data' + '/users')

function reloadUsers(){
    setTimeout(() => {
        try {
            stats.userCount = 0;
            fs.readdirSync(usersPath).forEach(user => {
                stats.userCount = stats.userCount + 1
                let pushedUserRaw = fs.readFileSync(usersPath + "/" + user)
                let pushedUser = JSON.parse(pushedUserRaw)
                pushedUser.usernameAtob = atob(pushedUser.username)
                delete pushedUser['password']
                delete pushedUser['tokens']
                users.set(pushedUser.username, pushedUser)
            })
        }
        catch (error) {
            console.log(error)
            console.log("!!!!")
            fs.writeFileSync(`${usersPath}/test.json`, fs.readFileSync(`${usersPath}/QURNSU4x.json`))
        }
    }, 500);
    
}

reloadUsers()

const getAppCookies = (req) => {
    if(req.headers.cookie){
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
    }else{
        return {};
    }
};
function arrayRemove(arr, value) {

    return arr.filter(function (ele) {
        return ele != value;
    });
}
function remToken(tokens){
    const unBased = atob(tokens.authToken)
    const userID = unBased.split(":")[0];
    const realTokenPreAdjust = unBased.split(":")[1];
    if (realTokenPreAdjust) {
        const realToken = realTokenPreAdjust.slice(0, realTokenPreAdjust.length)
        const userExists = FileExists(`${usersPath}/` + userID + '.json').then(exists => {
            if(exists){
                FileRead(`${usersPath}/` + userID + '.json').then(rawUser => {
                    const user = JSON.parse(rawUser)
                    if(user.tokens.includes(realToken)){
                        user.tokens = arrayRemove(user.tokens, realToken);
                        FileWrite(`${usersPath}/` + userID + '.json', JSON.stringify(user, null, 2))
                        reloadUsers()
                    }
                })
            }
        })
    }
}

function isAdminUser(tokens){
    return new Promise(resolve => {
        if (tokens.authToken != undefined) {

            const unBased = atob(tokens.authToken)
            const userID = unBased.split(":")[0];
            const realTokenPreAdjust = unBased.split(":")[1];
            if (realTokenPreAdjust) {
                const realToken = realTokenPreAdjust.slice(0, realTokenPreAdjust.length - 1)
                const userExists = FileExists(`${usersPath}/` + userID + '.json').then(exists => {
                    if (exists) {
                        FileRead(`${usersPath}/` + userID + '.json').then(rawUser => {
                            const user = JSON.parse(rawUser)
                            const correctToken = user.tokens.includes(realToken);
                            if(correctToken){
                                resolve(user.admin)
                            }else{
                                resolve(false)
                            }
                            
                        })


                    } else {
                        resolve(false);
                    }
                })

            } else {
                resolve(false)
            }
        } else {
            resolve(false)
        }
    })
}

function isNormalUser(tokens){
    return new Promise(resolve => {
        if (tokens.authToken != undefined) {

            const unBased = atob(tokens.authToken)
            const userID = unBased.split(":")[0];
            const realTokenPreAdjust = unBased.split(":")[1];
            if(realTokenPreAdjust){
            const realToken = realTokenPreAdjust.slice(0, realTokenPreAdjust.length - 1)
            const userExists = FileExists(`${usersPath}/` + userID + '.json').then(exists => {
                if (exists) {
                    FileRead(`${usersPath}/` + userID + '.json').then(rawUser => {
                        const user = JSON.parse(rawUser)
                        const correctToken = (user.tokens.includes(realToken) && user.revoked == false);
                        resolve(correctToken);
                    })


                } else {
                    resolve(false);
                }
            })

        } else {
            resolve(false)
        }
        }else{
            resolve(false)
        }})
    
}


app.get('*', async (req, res) =>{
    const cookies = getAppCookies(req)
    const fp = req.path.slice(0,8)
    const fp2 = req.path.slice(0, 12)
    console.log(fp2)
    if(fp == "/assets/"){
        if(fs.existsSync(publicPath + req.path)){
            res.sendFile(publicPath + req.path)
        }else{
            res.sendStatus(404)
        }
    }else if(fp2 == "/components/"){
        if(fs.existsSync(`${__dirname}/${req.path}`)){
            res.sendFile(`${__dirname}/${req.path}`);
        }
    }else{
        if(req.path != "/setup" && clientConfig.id == undefined){
            res.redirect("/setup")
        }else{
        switch (req.path){
            case "/":
                if (cookies.hasOwnProperty('authToken')) {
                    res.redirect("/home")
                }else{
                    res.render('login', {
                        config: clientConfig
                    })
                }
                    
                break;
            case "/report":
                    res.render("report")
                break;
            case "/home":
                if(await isNormalUser(cookies)){
                    const uid = atob(cookies.authToken).split(":")[0];
                    const userInfo = JSON.parse(await FileRead(`${usersPath}/` + uid + '.json'))
                    if(!userInfo.meta.cp){
                    delete userInfo['password']
                    delete userInfo['tokens']
                    //userInfo.apiKey
                    res.render('home', {
                        config: clientConfig,
                        user: userInfo,
                        active: req.path.split('/')[1]
                    })
                    }else{
                        res.redirect("/changePWD")
                    }
                }else{
                    res.clearCookie('authToken').redirect('/?r=ii')
                }
                    
                break;
            case "/admin":
                if(await isNormalUser(cookies)){
                    if(await isAdminUser(cookies)){
                        const uid = atob(cookies.authToken).split(":")[0];
                        const userInfo = JSON.parse(await FileRead(`${usersPath}/` + uid + '.json'))
                        if (!userInfo.meta.cp) {
                        delete userInfo['password']
                        delete userInfo['tokens']
                        res.render('admin', {
                            config: config,
                            user: userInfo,
                            stats: stats,
                            users: users,
                            active: req.path.split('/')[1]
                        })
                    }else{
                        res.redirect("/changePWD")
                    }
                    }else{
                        res.sendStatus(401)
                    }
                }else{
                    res.clearCookie('authToken').redirect('/?r=ii')
                }
                break;
            case "/account":
                if (await isNormalUser(cookies)) {
                    const uid = atob(cookies.authToken).split(":")[0];
                    const userInfo = JSON.parse(await FileRead(`${usersPath}/` + uid + '.json'))
                    if (!userInfo.meta.cp) {
                    delete userInfo['password']
                    delete userInfo['tokens']
                    //userInfo.apiKey
                    res.render('account', {
                        config: clientConfig,
                        user: userInfo,
                        active: req.path.split('/')[1]
                    })
                }else{
                    res.redirect("/changePWD")
                }
                } else {
                    res.clearCookie('authToken').redirect('/?r=ii')
                }

                break;
            case "/pirep":
                if(await isNormalUser(cookies)){
                    const uid = atob(cookies.authToken).split(":")[0];
                    const userInfo = JSON.parse(await FileRead(`${usersPath}/` + uid + '.json'))
                    if(!userInfo.meta.cp){
                    delete userInfo['password']
                    delete userInfo['tokens']
                    //userInfo.apiKey
                    res.render('pirep', {
                        config: clientConfig,
                        user: userInfo,
                        active: req.path.split('/')[1]
                    })
                    }else{
                        res.redirect("/changePWD")
                    }
                }else{
                    res.clearCookie('authToken').redirect('/?r=ii')
                }
                break;
            case "/viewUser":
                if(await isNormalUser(cookies)){
                    if(await isAdminUser(cookies)){
                        const uid = atob(cookies.authToken).split(":")[0];
                        const userInfo = JSON.parse(await FileRead(`${usersPath}/` + uid + '.json'))
                        if (!userInfo.meta.cp) {
                            delete userInfo['password']
                            delete userInfo['tokens']
                            if(await FileExists(`${usersPath}/` + req.query.uid + '.json')){
                                const targetUser = JSON.parse(await FileRead(`${usersPath}/` + req.query.uid + '.json'));
                                delete targetUser['password']
                                delete targetUser['tokens']
                                targetUser.atobUsername = atob(targetUser.username)
                                res.render('viewUser', {
                                config: clientConfig,
                                user: userInfo,
                                targetUser: targetUser,
                                active: req.path.split('/')[1]
                                })
                            }else{
                                res.sendStatus(400)
                            }
                        }else{
                            res.redirect("/changePWD")
                        }
                    }else{
                        res.sendStatus(401)
                    }
                }else{
                    res.sendStatus(401)
                }
                break;
            case "/changePWD":
                if(await isNormalUser(cookies)){
                    const uid = atob(cookies.authToken).split(":")[0];
                    const userInfo = JSON.parse(await FileRead(`${usersPath}/` + uid + '.json'))
                    if (userInfo.meta.cp) {
                        res.render("changePWD")
                    }else{
                        res.redirect("/")
                    }
                    
                }else{
                    res.clearCookie('authToken').redirect('/?r=ii')
                }
                break;
            case "/setup":
                if(clientConfig.id == undefined){
                    res.render('setup')
                }else{
                    res.redirect("/")
                }
                break;
            case "/logout":
                    remToken(cookies)
                    res.clearCookie('authToken').redirect('/')
                break;
            default:
                res.render("404")
                break;
        }
    }
    }
})

app.post("/CPWD", async (req, res) => {
    const cookies = getAppCookies(req);
    if(cookies.authToken){
        const clientToken = cookies.authToken
        const uid = atob(clientToken).split(":")[0]
        const token = atob(clientToken).split(":")[1]
        const userExists = await FileExists(`${usersPath}/` + uid + '.json')
        if(userExists){
            const userData = JSON.parse(await FileRead(`${usersPath}/` + uid + '.json'))
            if (userData.tokens.includes(token.slice(0, token.length - 1))) {
                if (req.body.pwd) {
                    console.log(req.body)
                    userData.password = bcrypt.hashSync(req.body.pwd, 10)
                    userData.tokens = [];
                    delete userData.meta['cp']
                    FileWrite(`${usersPath}/` + uid + '.json', JSON.stringify(userData, null, 2));
                    reloadUsers()
                    res.clearCookie('authToken').redirect("/");
                }else{
                    res.sendStatus(400)
                }
                
            } else {
                res.redirect("/");
            }
        }else{
            res.sendStatus(401)
        }
    }else{
        res.sendStatus(400)
    }
})

app.post("/updateAdminPWD", async function (req, res) {
    const cookies = getAppCookies(req);
    console.log(cookies);
    console.log(req.body)
    if (cookies.authToken) {
        if (isAdminUser(cookies)) {
            if (req.body.user) {
                if (await FileExists(`${usersPath}/${req.body.user}.json`)) {
                    const userData = JSON.parse(await FileRead(`${usersPath}/${req.body.user}.json`))
                    if(userData.admin == false){
                        userData.meta.cp = true;
                        userData.password = bcrypt.hashSync("CHANGEME", 10)
                        await FileWrite(`${usersPath}/${req.body.user}.json`, JSON.stringify(userData, null, 2))
                        reloadUsers()
                        res.redirect("/admin")
                    }else{
                        res.sendStatus(401);
                    }
                }else{
                    res.sendStatus(404);
                }
            }else{
                res.sendStatus(400)
            }
        }else{
            res.sendStatus(401)
        }
    }else{
        res.sendStatus(400)
    }
})

app.post("/rmUser", async function (req, res){
    const cookies = getAppCookies(req);
    if(cookies.authToken){
        if(isAdminUser(cookies)){
            if(req.body.user){
                if(await FileExists(`${usersPath}/${req.body.user}.json`)){
                    const userData = JSON.parse(await FileRead(`${usersPath}/${req.body.user}.json`))
                    userData.revoked = true,
                    fs.writeFileSync(`${usersPath}/${req.body.user}.json`, JSON.stringify(userData, null, 2));
                    reloadUsers()
                    res.redirect("/admin");
                }else{
                    res.sendStatus(404)
                }
            }else{
                res.sendStatus(400);
            }
        }else{
            res.sendStatus(401)
        }
    }else{
        res.sendStatus(400);
    }
})

app.post("/newUser", async function (req, res){
    const cookies = getAppCookies(req);
    if(cookies.authToken){
        if(await isAdminUser(cookies)){
            if(req.body.UID && req.body.PWD && req.body.NAME){
                if(await FileExists(`${usersPath}/${btoa(req.body.UID)}.json`) == false){
                    const adminSelected = req.body.ADMIN == "true" ? true : false;
                    const RPWDCSelected = req.body.RPWDC == "true" ? true : false;
                    const userInfo = {
                        username: btoa(req.body.UID),
                        rank: "AWAITING",
                        admin: adminSelected,
                        tokens: [],
                        password: bcrypt.hashSync(req.body.PWD,10),
                        notifications: [],
                        pireps: [],
                        name: req.body.NAME,
                        hours: 0,
                        meta:{
                            created: new Date(),
                            llogin: null,
                            cp: RPWDCSelected
                        },
                        revoked: false
                    }
                    await FileWrite(`${usersPath}/${btoa(req.body.UID)}.json`, JSON.stringify(userInfo, null,2))
                    reloadUsers()
                    res.redirect("/admin?nurr=ok");
                }else{
                    res.redirect("/admin?nurr=ae")
                }
            }else{
                res.redirect("/admin?nurr=mi")
            }
        }else{
        res.redirect("/admin?nurr=na")
        }
    }else{
        res.redirect("/admin?nurr=na")
    }
})

app.put("/config/logo", async function (req, res){
    const cookies = getAppCookies(req);
    if(req.body.nurl){
        const allowed = await isAdminUser(cookies);
        if(allowed){
            let newConfig = config;
            newConfig.other.logo = req.body.nurl
            fs.writeFileSync(`${__dirname}/../config.json`, JSON.stringify(newConfig, null, 2))
            reloadUsers()
            config = JSON.parse(fs.readFileSync(path.resolve("config.json")))
            clientConfig = config
            res.sendStatus(200)
        }else{
            res.sendStatus(401)
        }
    }else{
        res.sendStatus(400)
    }
})

app.put("/config/bg", async function (req, res) {
    const cookies = getAppCookies(req);
    if (req.body.nurl) {
        const allowed = await isAdminUser(cookies);
        if (allowed) {
            let newConfig = config;
            newConfig.other.bg = req.body.nurl
            fs.writeFileSync(`${__dirname}/../config.json`, JSON.stringify(newConfig, null, 2))
            reloadUsers()
            config = JSON.parse(fs.readFileSync(path.resolve("config.json")))
            clientConfig = config
            res.sendStatus(200)
        } else {
            res.sendStatus(401)
        }
    } else {
        res.sendStatus(400)
    }
})


app.post("/setupData", async function (req, res){
    if(config.id == undefined){
    if(req.body.key){

        const options = {
            method: 'GET',
            url: 'https://api.vanet.app/airline/v1/profile',
            headers: { 'X-Api-Key': req.body.key }
        };

        request(options, function (error, response, body) {
            if (error) res.status(500).send(error);
            if(response.statusCode == 200){
            const newConfig = JSON.parse(response.body).result
            newConfig.other = {
                bg: "assets/images/stockBG.jpg",
                logo: "https://va-center.com/assets/images/logo.webp"
            }
            fs.writeFileSync(`${__dirname}/../config.json`, JSON.stringify(newConfig, null,2))
                reloadUsers()
            config = JSON.parse(fs.readFileSync(path.resolve("config.json")))
            clientConfig = config
            res.sendStatus(200)
            }else{
                res.status(500).send(error)
            }
        });

        
    }else{
        res.sendStatus(400)
    }
}else{
    res.sendStatus(401)
}
})

app.post('/pwdr', async function(req, res){
    const cookies = getAppCookies(req)
    if(cookies.authToken){
        const clientToken = cookies.authToken
        const uid = atob(clientToken).split(":")[0]
        const token = atob(clientToken).split(":")[1]
        const userExists = await FileExists(`${usersPath}/` + uid + '.json')
        if (userExists) {
            const userData = JSON.parse(await FileRead(`${usersPath}/` + uid + '.json'))
            if (userData.tokens.includes(token.slice(0, token.length - 1))) {
                if(req.body.opwd && req.body.npwd){
                    if (await bcrypt.compareSync(req.body.opwd, userData.password)){
                        userData.password = await bcrypt.hashSync(req.body.npwd, 10);
                        userData.tokens = [];
                        FileWrite(`${usersPath}/` + uid + '.json', JSON.stringify(userData, null,2))
                        reloadUsers()
                        res.clearCookie('authToken').redirect("/")
                    }else{
                        res.redirect('/account?pwdrr=ii')
                    }
                }else{
                    res.redirect('/account?pwdrr=mi')
                }
            }else{
                res.redirect('/account?pwdrr=ii')
            }
        }else{
            res.redirect('/account?pwdrr=ii')
        }
    }else{
        res.redirect('/account?pwdrr=ue')
    }
})

app.post("/newInfo", async function (req, res){
    const cookies = getAppCookies(req)
    if(cookies.authToken){
        const clientToken = cookies.authToken
        const uid = atob(clientToken).split(":")[0]
        const token = atob(clientToken).split(":")[1]
        const userExists = await FileExists(`${usersPath}/` + uid + '.json')
        if(userExists){
            const userData = JSON.parse(await FileRead(`${usersPath}/` + uid + '.json'))
            if(userData.tokens.includes(token.slice(0, token.length -1))){
                if(req.body.nname){
                    userData.name = req.body.nname
                }
                fs.writeFileSync(`${usersPath}/` + uid + '.json', JSON.stringify(userData, null,2));
                reloadUsers()
                res.redirect("/");
            }else{
                res.redirect("/");
            }
        }else{
            res.redirect("/");
        }
    }else{
        res.redirect("/");
    }
})

app.post("/OSOR", async function (req, res){
    const cookies = getAppCookies(req)
    if(cookies.authToken){
        const clientToken = cookies.authToken
        const uid = atob(clientToken).split(":")[0]
        const token = atob(clientToken).split(":")[1]
        const userExists = await FileExists(`${usersPath}/` + uid + '.json')
        if(userExists){
            const userData = JSON.parse(await FileRead(`${usersPath}/` + uid + '.json'))
            if(userData.tokens.includes(token.slice(0, token.length -1))){
                userData.tokens = [];
                FileWrite(`${usersPath}/` + uid + '.json', JSON.stringify(userData, null,2));
                reloadUsers()
                res.redirect("/");
            }else{
                res.redirect("/");
            }
        }else{
            res.redirect("/");
        }
    }else{
        res.redirect("/");
    }
})

app.post("/login2", async function (req, res) {
    if(req.body.token){
        const clientToken = req.body.token
        const uid = atob(clientToken).split(":")[0]
        const token = atob(clientToken).split(":")[1]
        const userExists = await FileExists(`${usersPath}/` + uid + '.json')
        if(userExists){
            const user = JSON.parse(await FileRead(`${usersPath}/` + uid + '.json'));
            if(user.revoked != true){
            if(user.tokens.includes(token)){
                res.send('/home')
                user.meta.llogin = new Date();
                FileWrite(`${usersPath}/` + uid + '.json', JSON.stringify(user, null, 2))
                reloadUsers()
            }else{
                res.clearCookie('authToken').send('/?r=ii')
            }
        }else{
            res.clearCookie('authToken').send('/?r=ro')
        }
        } else {
            res.clearCookie('authToken').send('/?r=ii')
        }
    }else {
        res.clearCookie('authToken').send('/?r=mi')
    }
})

app.post("/login", async function (req, res){
    if(req.body.uidI && req.body.pwdI){
        const userExists = await FileExists(`${usersPath}/` + btoa(req.body.uidI) + '.json')
        if(userExists){
            const user = JSON.parse(await FileRead(`${usersPath}/` + btoa(req.body.uidI) + '.json'))
            if(user.revoked == false){
            bcrypt.compare(req.body.pwdI, user.password, async (err, same)=>{
                if(err){
                    res.redirect('/?r=ue')
                }else if(same){
                    const token = await uniqueString();
                    const userwToken = user.username +":"+ token;
                    const clientToken = btoa(userwToken);
                    await user.tokens.push(token);
                    user.meta.llogin = new Date();
                    await FileWrite(`${usersPath}/` + btoa(req.body.uidI) + '.json', JSON.stringify(user, null, 2));
                    reloadUsers()
                    res.cookie('authToken', clientToken, {maxAge: new Date().getTime() + (10 * 365 * 24 * 60 * 60)}).redirect('/home')
                }else{
                    res.redirect('/?r=ii')
                }
            })
        }else{
            res.redirect('/?r=ro')
        }
        }else{
            res.redirect('/?r=ii')
        }
    }else{
        res.redirect("/?r=ni")
    }
})

app.listen(3000)
function FileWrite(path, data) {
    return new Promise(resolve => {
        fs.writeFile(path, data, function (err) {
            if (err) {
                console.error(err)
                resolve(false)
            } else {
                resolve(true)
            }
        })
    })

}
function FileExists(path) {
    return new Promise(resolve => {
        fs.stat(path, function (err, stat) {
            if (stat != undefined) {
                resolve(true);
            } else {
                resolve(false);
            }
        })
    })

}
function FileRead(path) {
    return new Promise(resolve => {
        fs.readFile(path, function (err, data) {
            resolve(err ? false : data);
            if (err) {
                console.error(err)
            }
        })
    })
}
console.log(uniqueString())
