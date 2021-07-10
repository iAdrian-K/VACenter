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
            swal("Oh no!", "You didn't enter a piece of information!", 'error')
            break;
        case "ro":
            swal("Oh no!", "This account has been revoked by an administrator!", 'error')
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