
const fs = require('fs');
const moment = require('moment');
const SteamUser = require('steam-user');
const readline = require('readline');
const path = require('path');
var endOfLine = require('os').EOL;

var client = new SteamUser();
var appPath = "";
var loginDataFile = './logindata.json';
var mainLoginData = {};
var loginPrompt;
var sgPrompt;
module.exports = {
  setAppPath: function (path) {
    appPath = path;
  },
  getLogFolder: function () {
    return config.logDirectory;
  },
  getConfig: function () {
    return config;
  },
  setConfig: function (newConfig) {
    config = newConfig;
    saveConfig();
  },
  getSteamClient: function () {
    return client;
  },
  getLoginData: function () {
    return mainLoginData;
  },
  setLoginPrompt: function (loginFunction) {
    loginPrompt = loginFunction;
  },
  setSteamGuardPrompt: function (steamguardFunction) {
    sgPrompt = steamguardFunction;
  },
  run: function (path) {
    runApp();
  },
  login: function (newLoginData) {
    loginToSteam(newLoginData);
  }
};

//Default config.
var config = {
  "logDirectory":"./logs",
  "fileFormat":"{SteamID} - {Nickname}.txt",
  "messageFormat":"[{Time}] {Name}: {Message}",
  "invalidCharReplacement":"_",
  "seperationString":"───────────────────{Date}───────────────────",
  "dateFormat":"L",
  "timeFormat":"LT"
};

var steamUserName;
var logData = {};
var logDataFile = "logData.json";
function runApp() {
    getConfig();

    logData = {};
    logDataFile = path.join(appPath, "logData.json");
    getLogData();

    if(fs.existsSync(loginDataFile)) {
        fs.readFile(loginDataFile, (err, data) => {  
            if(err) {
                throw err;
            }
            try {
                loginToSteam(JSON.parse(data));
            } catch (e) {
                loginToSteam(null);
            }
        });
    } else {
        loginToSteam(null);
    }
}

function loginToSteam(loginData) {
    mainLoginData = loginData;
    if(loginData !== null) {
        steamUserName = loginData.username;
        if('key' in loginData) {
            client.logOn({
                "accountName": loginData.username,
                "rememberPassword": "true",
                "loginKey": loginData.key
            });
        } else {
            client.logOn({
                "accountName": steamUserName,
                "password": loginData.password,
                "rememberPassword": "true"
            });
        }
    } else {
        loginPrompt();
        /*const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        rl.question('Steam Username: ', (value) => {
            steamUserName = value;
            rl.question('Steam Password: ', (value) => {
                rl.close();
            });
        });*/
    }
}

client.on('steamGuard', function(domain, callback) {
	console.log("Steam Guard code needed from email ending in " + domain);
	sgPrompt(callback);
});

client.on('loggedOn', function(details) {
	console.log("Logged into Steam as " + client.steamID.getSteam3RenderedID());
});

client.on('loginKey', function(key) {
	console.log("loginKey: " + key);
    var loginData = {};
    loginData.username = steamUserName;
    loginData.key = key;
    fs.writeFileSync(loginDataFile, JSON.stringify(loginData));
});

client.on('error', function(e) {
	// Some error occurred during logon
	console.log(e);
});

client.on('licenses', function(licenses) {
	console.log("Your account owns " + licenses.length + " license" + (licenses.length == 1 ? '' : 's') + ".");
});

client.chat.on('friendMessage', function(message) {
    console.log(userChat(message.steamid_friend, message.steamid_friend, message));
});

client.chat.on('friendMessageEcho', function(message) {
    console.log(userChat(message.steamid_friend, client.steamID, message));
});

function userChat(friendSteam, sender, message) {
    var formattedMessage = formatMessage(sender, message);
    var steam64 = friendSteam.getSteamID64();
    var friendName = getFriendName(steam64);
    var fileName = getChatIdFile(friendSteam).replace(/[/\\?%*:|"<>]/g, config.invalidCharReplacement);
    //Update Logdata also.
    var isSame = false;
    if(steam64 in logData) {
        if('lastMessage' in logData[steam64]) {
            isSame = moment(logData[steam64].lastMessage).isSame(message.server_timestamp, 'day');
        }
        if('logFile' in logData[steam64]) {
            if(logData[steam64].logFile !== fileName) {
                if(fs.existsSync(loginDataFile)) {
                    //Rename old file before appending text message, only if something in the filename changed.
                    fs.renameSync(path.join(config.logDirectory, logData[steam64].logFile), config.logDirectory + "/" + fileName);
                }
            }
        }
    } else {
        logData[steam64] = {};
    }
    logData[steam64].lastMessage = message.server_timestamp;
    if(friendName !== null) {
        logData[steam64].name = friendName;
    }
    logData[steam64].profile = "http://steamcommunity.com/profiles/" + steam64;
    logData[steam64].logFile = fileName;
    fs.writeFileSync(logDataFile, JSON.stringify(logData, null, 2));
    
    var appendLine = "";
    if(!isSame) {
        appendLine = config.seperationString + endOfLine;
        appendLine = appendLine.replace('{Date}', moment(message.server_timestamp).format(config.dateFormat));
    }
    fs.appendFile(path.join(config.logDirectory, fileName), appendLine + formattedMessage + endOfLine, function (err) {
        if (err) throw err;
    });
    
    //return "- " + getFriendName(sender) + ": " + message.message;
    return formattedMessage;
}

function getFriendName(steamid64) {
    if(steamid64 === null || steamid64 === client.steamID.getSteamID64()) {
        return client.accountInfo.name;
    }
    if(steamid64 in client.users) {
        return client.users[steamid64].player_name;
    }
    return null;
}

function getFriendNickName(steamid64) {
    if(steamid64 in client.myNicknames) {
        return client.myNicknames[steamid64];
    }
    return getFriendName(steamid64);
}

function formatMessage(user, message) {
    return formatDynamicString(config.messageFormat, moment(message.server_timestamp), message.message, user);
}

function formatDynamicString(formatString, timeMoment, message, user) {
    var steam64 = user.getSteamID64();
    var formattedMessage = "" + formatString;
    var formatArgs = {
        '{Date}':timeMoment.format(config.dateFormat),
        '{Time}':timeMoment.format(config.timeFormat),
        '{MyName}':getFriendName(null),
        '{MySteamID}':client.steamID.getSteam3RenderedID(),
        '{MySteamID64}':client.steamID.getSteamID64(),
        '{SteamID}':user.getSteam3RenderedID(),
        '{SteamID64}':steam64,
        '{Nickname}':getFriendNickName(steam64),
        '{Name}':getFriendName(steam64),
        '{Message}':message
    };
    Object.keys(formatArgs).forEach(function (key) {
        if(formattedMessage.includes(key)) {
            formattedMessage = formattedMessage.replace(key, formatArgs[key]);
        }
    });
    return formattedMessage;
}

function getChatIdFile(user) {
    return formatDynamicString(config.fileFormat, moment(), '<Message Unknown>', user);
}

function getLogData() {
    if(fs.existsSync(logDataFile)) {
        fs.readFile(logDataFile, (err, data) => {
            if(err) {
                throw err;
            }
            try {
                logData = JSON.parse(data);
            } catch (e) {
                //Do nothing I guess?
            }
        });
    }
}

function getConfig() {
    var configFile = path.join(appPath, "config.json");
    if(fs.existsSync(configFile)) {
        fs.readFile(configFile, (err, data) => {
            if(err) {
                throw err;
            }
            try {
                config = JSON.parse(data);
                if(!fs.existsSync(config.logDirectory)) {
                    fs.mkdirSync(config.logDirectory, {recursive: true});
                }
            } catch (e) {
                //Do nothing I guess?
            }
        });
    } else {
        config.logDirectory = path.join(appPath, "logs");
    }
}

function saveConfig() {
    var configFile = path.join(appPath, "config.json");
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
}