const moment = window.moment;
const ipcRenderer = window.ipcRenderer;
var config = {};
var previewUpdateList = [];

document.addEventListener("keydown", function (e) {
    if (e.which === 123) {
        require('remote').getCurrentWindow().toggleDevTools();
    } else if (e.which === 116) {
        location.reload();
    }
});

document.getElementById("btnSave").addEventListener('click', (event) => { saveConfig(); });
document.getElementById("btnLogout").addEventListener('click', (event) => { logOut(); });

var elements = document.getElementsByClassName("preview");
for(var i = 0; i < elements.length; i++) {
    var input = document.getElementById(elements[i].id.replace('PreviewTime', '').replace('Preview', ''));
    input.addEventListener('input', updatePreviewEvent);
    input.addEventListener('propertychange', updatePreviewEvent);
}

ipcRenderer.on('updateConfigValues', function (event,logConfig) {
    config = logConfig;
    previewUpdateList = [];
    Object.keys(logConfig).forEach(function (key) {
        var elem = document.getElementById(key)
        elem.value = logConfig[key];
        updatePreview(elem);
    });
});
ipcRenderer.on('updateDirectoryValue', function (event, directory) {
    document.getElementById('logDirectory').value = directory;
});

function browseClick() {
    ipcRenderer.send('browseDirectory');
}

function logOut() {
    ipcRenderer.send('logOut');
}

function saveConfig() {
    var newConfig = {};
    Object.keys(config).forEach(function (key) {
        newConfig[key] = document.getElementById(key).value
    });
    ipcRenderer.send('update-config', newConfig);
}

function updatePreviewEvent(event) {
    updatePreview(event.target);
}
function updatePreview(element) {
    if(element.parentElement === null) {
        return;
    }
    var x = element.parentElement.getElementsByClassName('preview')[0];
    console.log(x);
    if(x !== null && x !== undefined && x.id !== undefined && x.id.includes(element.id)) {
        if(x.id.includes("Time")) {
            x.innerHTML = moment().format(element.value);
        } else {
            x.innerHTML = formatPreview(element.value);
        }
    }
}

/*function updatePreviewTime(element) {
    var x = document.getElementById(element.id+"Preview");
    if(x !== null) {
        x.innerHTML = moment().format(element.value);
    }
}*/

function formatPreview(formatString) {
    var formattedMessage = "" + formatString;
    var timeMoment = moment();
    var formatArgs = {
        '{Date}':timeMoment.format(config.dateFormat),
        '{Time}':timeMoment.format(config.timeFormat),
        '{MyName}':"Me",
        '{MySteamID}':"[U:1:XXXX]",
        '{MySteamID64}':"AAAAAAA",
        '{SteamID}':"[U:1:YYYY]",
        '{SteamID64}':"BBBBBBB",
        '{Nickname}':"Mitch",
        '{Name}':"Mitchell",
        '{Message}':"Hey!"
    };
    Object.keys(formatArgs).forEach(function (key) {
        if(formattedMessage.includes(key)) {
            formattedMessage = formattedMessage.replace(key, formatArgs[key]);
        }
    });
    return formattedMessage;
}