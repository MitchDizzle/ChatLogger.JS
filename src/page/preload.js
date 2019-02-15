const { ipcRenderer } = require('electron');
const moment = require('moment');
function init() {
    // add global variables to your web page
    window.isElectron = true;
    window.ipcRenderer = ipcRenderer;
    window.moment = moment;
}

init();