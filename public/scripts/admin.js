function makeid(length) {
    var result = [];
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result.push(characters.charAt(Math.floor(Math.random() *
            charactersLength)));
    }
    return result.join('');
}

function modifyLogo(){
    console.log(document.getElementById('clogoprevval').value)
    const data = `nurl=${encodeURIComponent(document.getElementById('clogoprevval').value)}`;

    const xhr = new XMLHttpRequest();
    xhr.withCredentials = true;

    xhr.addEventListener("readystatechange", function () {
        if (this.readyState === this.DONE) {
            if (this.status == 200) {
                swal("Hooray!", "The logo was updated successfully!", 'success')
            } else if (response.status == 400) {
                swal("Oh no!", "The was an error!", 'error')
            }
            else if (response.status == 401) {
                swal("Oh no!", "The was an error! You are not authorised to do that.", 'error')
            }
        }
    });

    xhr.open("PUT", "/config/logo");
    xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");

    xhr.send(data);
}

function modifyBG() {
    console.log(document.getElementById('cbgprevval').value)
    const data = `nurl=${encodeURIComponent(document.getElementById('cbgprevval').value)}`;

    const xhr = new XMLHttpRequest();
    xhr.withCredentials = true;

    xhr.addEventListener("readystatechange", function () {
        if (this.readyState === this.DONE) {
            if (this.status == 200) {
                swal("Hooray!", "The background was updated successfully!", 'success');
                setTimeout(() => {
                    window.location.reload()
                }, 2500);
            } else if (response.status == 400) {
                swal("Oh no!", "The was an error!", 'error')
            }
            else if (response.status == 401) {
                swal("Oh no!", "The was an error! You are not authorised to do that.", 'error')
            }
        }
    });

    xhr.open("PUT", "/config/bg");
    xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");

    xhr.send(data);
}

document.getElementById('clogoprevval').addEventListener('input', (event) => {
    console.log("1")
    const result = document.querySelector('#clogoprev');
    result.src = event.target.value;
});

document.getElementById('cbgprevval').addEventListener('input', (event) => {
    console.log("1")
    const result = document.querySelector('#cbgprev');
    result.src = event.target.value;
});

const urlParams = new URLSearchParams(window.location.search);

if(urlParams.has("nurr")){
    switch(urlParams.get("nurr")){
        case "mi":
            swal("Oh no!","There was some missing information!", "error")
            break;
        case "na":
            swal("Oh no!", "You aren't allowed to perform this action!", "error")
            break;
        case "ae":
            swal("Oh no!", "This user already exists!", "error")
            break;
        case "ue":
            swal("Oh no!", "There was an unknown error!", "error")
            break;
        case "ok":
            swal("Hooray!", "The user was added", "success")
            break;
        default:
            break;
    }
}

if (urlParams.has('pwdrr')) {
    switch (urlParams.get('pwdrr')) {
        case "mi":
            swal("Oh no!", "You didn't enter a piece of information!", 'error')
            break;
        case "ii":
            swal("Oh no!", "The information you entered was incorrect!", 'error')
            break;
        case "ue":
            swal("Oh no!", "There was an unknown error!", 'error')
            break;
        default:
            break;
    }
}

function openNewUserDialog(){
    document.getElementById('newUserDialog').style.display = "block";
}
function closeNU() {
    document.getElementById('newUserDialog').style.display = "none";
}


function randomPWDGen(){
    document.getElementById('pwdGener').value = makeid(10)
}