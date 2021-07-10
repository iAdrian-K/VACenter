const sqlite3 = require('sqlite3').verbose();

//Database
//@ts-ignore
let db = new sqlite3.Database('./database.db', (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to the database.');
});

//@ts-ignore
function GetUser(username: string) {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.each(`SELECT * FROM users WHERE username = ?`, [username], (err, row) => {
                if (err) {
                    error(err.message);
                }
                resolve(row);
            });
        });
    });
}

//@ts-ignore
function GetUsers() {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.all(`SELECT * FROM users`, (err, rows) => {
                if (err) {
                    error(err.message);
                }
                resolve(rows);
            });
        });
    });
}

//@ts-ignore
function CreateUser(username, rank, admin: boolean, password, display, hours: number, created, llogin, cp: boolean, revoked: boolean){
    db.run(`INSERT INTO users(username, rank, admin, password, display, hours, created, llogin, cp, revoked) 
            VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
            [username, rank, admin, password, display, hours, created, llogin, cp, revoked],
            function(err) {
                return err
            }
    )
}


//@ts-ignore
function GetPirep(id: string) {
    return new Promise((resolve,error) => {
        db.serialize(() => {
            db.each(`SELECT * FROM pireps WHERE id = ?`, [id], (err, row) => {
                if (err) {
                    error(err.message);
                }
                resolve(row);
            });
        });
    });
}

//@ts-ignore
function GetPireps() {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.all(`SELECT * FROM pireps`, (err, rows) => {
                if (err) {
                    error(err.message);
                }
                resolve(rows);
            });
        });
    });
}

//@ts-ignore
function CreatePirep(username, rank, admin: boolean, password, display, hours: number, created, llogin, cp: boolean, revoked: boolean){
    db.run(`INSERT INTO users(username, rank, admin, password, display, hours, created, llogin, cp, revoked) 
            VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
            [username, rank, admin, password, display, hours, created, llogin, cp, revoked],
            function(err) {
                return err
            }
    )
}

module.exports = {db, GetUser, GetUsers, CreateUser, GetPirep, GetPireps, CreatePirep};