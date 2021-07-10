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
function GetUser(username) {
    return new Promise(resolve => {
        db.serialize(() => {
            db.each(`SELECT * FROM users WHERE username = ?`, (err, row) => {
                if (err) {
                    console.error(err.message);
                }
                console.log(row);
                console.log(123);
            });
        });
    });
}
module.exports = { db, GetUser };
