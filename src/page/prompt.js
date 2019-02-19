const moment = window.moment;
const ipcRenderer = window.ipcRenderer;
var promptId = null;

ready(() => {
    promptId = document.location.hash.replace('#', '');
    
    
    
    
    //Hide the rest.
    var contentElements = document.getElementsByClassName("contentSelector");
    if(contentElements.length > 0) {
        for(var i = 0; i < contentElements.length; i++) {
            var element = contentElements[i];
            if(element.id !== promptId) {
                document.getElementById(element.id).style.display = "none";
            }
        }
    }
});

document.getElementById("btnLogin").addEventListener('click', (event) => { login(); });
document.getElementById("btnGCAccept").addEventListener('click', (event) => { gcAccept() });

function login() {
    var username = document.getElementById("username").value;
    var password = document.getElementById("password").value;
    //Check if username and password is valid and not blank.
    if(isBlank(username) || isBlank(password)) {
        return;
    }
    if(ipcRenderer) {
        ipcRenderer.send('loginDetails', {username:username,password:password});
    }
    window.close();
}

function gcAccept() {
    var guardCode = document.getElementById("guardCode").value;
    //Check if username and password is valid and not blank.
    if(isBlank(guardCode)) {
        return;
    }
    if(ipcRenderer) {
        ipcRenderer.send('steamGuardCode', guardCode);
    }
    window.close();
}

function isBlank(str) {
    return (!str || /^\s*$/.test(str));
}

function ready(callback) {
    if(typeof document === 'undefined') {
        throw new Error('document-ready only runs in the browser');
    }
    var state = document.readyState;
    if(state === 'complete' || state === 'interactive') {
        return setTimeout(callback, 0);
    }
    
    document.addEventListener('DOMContentLoaded', function onLoad() {
        callback();
    });
}