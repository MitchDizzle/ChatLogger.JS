const moment = window.moment;
const ipcRenderer = window.ipcRenderer;
var config = {};
var previewUpdateList = [];
var changesHaveBeenMade = false;
document.addEventListener("keydown", function (e) {
    if (e.which === 123) {
        require('remote').getCurrentWindow().toggleDevTools();
    } else if (e.which === 116) {
        location.reload();
    }
});

document.getElementById("btnBrowse").addEventListener('click', (event) => { browseClick(); });
document.getElementById("btnSave").addEventListener('click', (event) => { saveConfig(); });
document.getElementById("btnSaveClose").addEventListener('click', (event) => { saveConfig(); window.close() });
document.getElementById("btnLogout").addEventListener('click', (event) => { logOut(); });

var tabs = document.getElementsByClassName("tablinks");
if(tabs.length > 0) {
    for(var i = 0; i < tabs.length; i++) {
        var tab = tabs[i];
        tab.addEventListener('click', changeTab);
    }
}

var elements = document.getElementsByClassName("preview");
for(var i = 0; i < elements.length; i++) {
    var input = document.getElementById(elements[i].id.replace('PreviewTime', '').replace('Preview', ''));
    input.addEventListener('input', updatePreviewEvent);
    input.addEventListener('propertychange', updatePreviewEvent);
}

if(ipcRenderer) {
    ipcRenderer.on('updateConfigValues', function (event, logConfig) {
        setChangesHaveBeenMade(false);
        config = logConfig;
        previewUpdateList = [];
        Object.keys(logConfig).forEach(function (key) {
            var elem = document.getElementById(key);
            if(elem !== null) {
                elem.value = logConfig[key];
                updatePreview(elem);
            }
        });
        selectSettingsTab();
    });
    ipcRenderer.on('updateDirectoryValue', function (event, directory) {
        document.getElementById('logDirectory').value = directory;
    });
}

function browseClick() {
    ipcRenderer.send('browseDirectory');
}

function logOut() {
    ipcRenderer.send('logOut');
}

function setChangesHaveBeenMade(hasChanges) {
    var changesText = document.getElementById('changesText');
    if(changesText) {
        if(hasChanges) {
            changesText.innerHTML = "unsaved changes";
        } else {
            changesText.innerHTML = "";
        }
    }
    changesHaveBeenMade = hasChanges;
}

function saveConfig() {
    var changesText = document.getElementById('changesText');
    if(changesText) {
        changesText.innerHTML = "Saved!";
    }
    if(changesHaveBeenMade) {
        var newConfig = {};
        Object.keys(config).forEach(function (key) {
            let element = document.getElementById(key)
            if(element !== null) {
                newConfig[key] = element.value
            }
        });
        ipcRenderer.send('update-config', newConfig);
    }
}

function updatePreviewEvent(event) {
    setChangesHaveBeenMade(true);
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

function selectSettingsTab() {
    var settingsTab = document.getElementById("btnTabSettings");
    if(settingsTab) {
        changeTab({currentTarget:settingsTab});
    }
}

function changeTab(event) {
    //event.target
    var i, tabcontent, tablinks;

    // Get all elements with class="tabcontent" and hide them
    tabcontent = document.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }

    // Get all elements with class="tablinks" and remove the class "active"
    tablinks = document.getElementsByClassName("tablinks");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }

    // Show the current tab, and add an "active" class to the button that opened the tab
    tabcontent = document.getElementById(event.currentTarget.name);
    tabcontent.style.display = "flex";
    event.currentTarget.className += " active";
}

function formatPreview(formatString) {
    // Need to some how get this formatter to either use the chatlogger.js formatDynamicString() without needing to be logged into the session.
    var formattedMessage = "" + formatString;
    var timeMoment = moment();
    var friendNick = "Mitch";
    var friendName = "Mitchell";
    var bothNames = ("" + config.bothNameFormat);
    var formatArgs = {
        '{BothNames}':bothNames,
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

function includeHTML() {
  var z, i, elmnt, file, xhttp;
  /* Loop through a collection of all HTML elements: */
  z = document.getElementsByTagName("*");
  for (i = 0; i < z.length; i++) {
    elmnt = z[i];
    /*search for elements with a certain atrribute:*/
    file = elmnt.getAttribute("w3-include-html");
    if (file) {
      /* Make an HTTP request using the attribute value as the file name: */
      xhttp = new XMLHttpRequest();
      xhttp.onreadystatechange = function() {
        if (this.readyState == 4) {
          if (this.status == 200) {elmnt.innerHTML = this.responseText;}
          if (this.status == 404) {elmnt.innerHTML = "Page not found.";}
          /* Remove the attribute, and call this function once more: */
          elmnt.removeAttribute("w3-include-html");
          includeHTML();
        }
      } 
      xhttp.open("GET", file, true);
      xhttp.send();
      /* Exit the function: */
      return;
    }
  }
}
includeHTML();