const getAppCookies = () => {
    // We extract the raw cookies from the request headers
    const rawCookies = document.cookie.split('; ');
    // rawCookies = ['myapp=secretcookie, 'analytics_cookie=beacon;']

    const parsedCookies = {};
    rawCookies.forEach(rawCookie => {
        const parsedCookie = rawCookie.split('=');
        // parsedCookie = ['myapp', 'secretcookie'], ['analytics_cookie', 'beacon']
        parsedCookies[parsedCookie[0]] = parsedCookie[1];
    });
    return parsedCookies;
};


function checkPrevLogin(){
    const cookies = getAppCookies();
    if(cookies.hasOwnProperty('authToken')){
        const data = `token=${cookies.authToken}`;

        const xhr = new XMLHttpRequest();
        xhr.withCredentials = true;

        xhr.addEventListener("readystatechange", function () {
            if (this.readyState === this.DONE) {
                    window.location.href= this.responseText;
            }
        });

        xhr.open("POST", "/login2");
        xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");

        xhr.send(data);
    }
}
const urlParams = new URLSearchParams(window.location.search);

if(urlParams.has('r')){
    switch (urlParams.get('r')) {
        case "ni":
            swal("Oh no!", "You didn't enter a piece of information!", 'error').then(() =>{
                window.location.href = "/"
            })
            break;
        case "ro":
            swal("Oh no!", "This account has been revoked by an administrator!", 'error').then(() => {
                window.location.href = "/"
            })
            break;
        case "ii":
            swal("Oh no!", "The information you entered was incorrect!", 'error').then(() => {
                window.location.href = "/"
            })
            break;
        case "ue":
            swal("Oh no!", "There was an unknown error!", 'error').then(() => {
                window.location.href = "/"
            })
            break;
        default:
            break;
    }
}
function applyAction(enabled, link){
    if(enabled){

    }else{
        swal({
            title: "Application",
            text: "This VA does not have this feature enabled, contact them to learn how to apply.",
            icon: 'info'
        })
    }
}

function resetAction(enabled){
    if(enabled){
        
    }else{
        swal({
            title: "Reset Password",
            text: "This VA does not allow passwords to be reset here. Contact an Admin to have them reset it for you.",
            icon: "error"
        })
    }
}