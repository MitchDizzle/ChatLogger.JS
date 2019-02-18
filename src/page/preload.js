const { ipcRenderer } = require('electron');
const moment = require('moment');
window.isElectron = true;
window.ipcRenderer = ipcRenderer;
window.moment = moment;
init();