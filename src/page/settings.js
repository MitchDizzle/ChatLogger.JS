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

document.getElementById("btnBrowse").addEventListener('click', (event) => { browseClick(); });
document.getElementById("btnSave").addEventListener('click', (event) => { saveConfig(); });
document.getElementById("btnLogout").addEventListener('click', (event) => { logOut(); });

var elements = document.getElementsByClassName("preview");
for(var i = 0; i < elements.length; i++) {
    var input = document.getElementById(elements[i].id.replace('PreviewTime', '').replace('Preview', ''));
    input.addEventListener('input', updatePreviewEvent);
    input.addEventListener('propertychange', updatePreviewEvent);
}

ipcRenderer.on('updateConfigValues', function (event, logConfig) {
    config = logConfig;
    previewUpdateList = [];
    Object.keys(logConfig).forEach(function (key) {
        var elem = document.getElementById(key);
        if(elem !== null) {
            elem.value = logConfig[key];
            updatePreview(elem);
        }
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
        let element = document.getElementById(key)
        if(element !== null) {
            newConfig[key] = element.value
        }
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
    // Need to some how get this formatter to either use the chatlogger.js formatDynamicString() without needing to be logged into the session.
    var formattedMessage = "" + formatString;
    var timeMoment = moment();
    var friendNick = "Mitch";
    var friendName = "Mitchell";
    var bothNames = ("" + config.bothNameFormat).replace("{Nickname}", friendNick).replace("{Name}", friendName);
    var formatArgs = {
        '{Date}':timeMoment.format(config.dateFormat),
        '{Time}':timeMoment.format(config.timeFormat),
        '{MyName}':"Me",
        '{MySteamID}':"[U:1:XXXX]",
        '{MySteamID2}':"STEAM_1:0:AAAA",
        '{MySteamID64}':"URCOMMUNITYID",
        '{SteamID}':"[U:1:YYYY]",
        '{SteamID2}':"STEAM_1:0:BBBB",
        '{SteamID64}':"COMMUNITYID",
        '{Nickname}':"Mitch",
        '{Name}':"Mitchell",
        '{BothNames}':bothNames,
        '{Message}':"Hey!",
        '{MessageBB}':"[emoticon]steamhappy[/emoticon]"
    };
    Object.keys(formatArgs).forEach(function (key) {
        if(formattedMessage.includes(key)) {
            formattedMessage = formattedMessage.replace(key, formatArgs[key]);
        }
    });
    return formattedMessage;
}