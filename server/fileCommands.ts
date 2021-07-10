//@ts-ignore
const fs = require('fs');

//@ts-ignore
function ReadFile(filename: string){
    return new Promise(resolve =>{
        fs.readFile(filename,(err, data) =>{
            if(err){
                resolve(false);
            }else{
                resolve(data);
            }
        })
    })
}
//@ts-ignore
function WriteFile(filename: string, data: any) {
    return new Promise(resolve => {
        fs.access(filename, fs.F_OK, (err) => {
            if (err) {
                resolve(false);
            } else {
                resolve(true);
            }
        })
    })
}
//@ts-ignore
function ExistsFile(filename: string, data: any) {
    return new Promise(resolve => {
        fs.writeFile(filename, data, (err) => {
            if (err) {
                resolve(false);
            } else {
                resolve(true);
            }
        })
    })
}
//@ts-ignore
function RemoveFile(filename: string) {
    return new Promise(resolve => {
        fs.unlink(filename, (err) => {
            if (err) {
                resolve(false);
            } else {
                resolve(true);
            }
        })
    })
}

module.exports = {ReadFile, WriteFile, ExistsFile, RemoveFile}