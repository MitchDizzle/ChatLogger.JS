
const fs = require('fs');
const moment = require('moment');
const SteamUser = require('steam-user');
const readline = require('readline');
const path = require('path');
var endOfLine = require('os').EOL;

var client = new SteamUser();
var steamUserName;
var appPath = ".";
//Default login prompts for running through console.
var loginPrompt = function () {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    rl.question('Steam Username: ', (value) => {
        steamUserName = value;
        rl.question('Steam Password: ', (value) => {
            loginToSteam({username:steamUserName,password:value});
            rl.close();
        });
    });
};
var sgPrompt = function (callback) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    rl.question('SteamGuard Code: ', (value) => {
        callback(value);
    });
};

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
  },
  logout: function () {
    client.logOff();
    loginToSteam(null);
  }
};

//Default config.
var config = {
  "logDirectory":"./logs",
  "fileFormat":"{SteamID} - {Nickname}.txt",
  "messageFormat":"[{Time}] {BothNames}: {Message}",
  "invalidCharReplacement":"_",
  "seperationString":"───────────────────{Date}───────────────────",
  "bothNameFormat":"{Name} ({Nickname})",
  "dateFormat":"L",
  "timeFormat":"LT"
};

var logData = {};
var logDataFile = "logData.json";
var loginDataFile = 'logindata.json';
var configFile = 'config.json';
function runApp() {
    var logdataDir = path.join(appPath, "logdata");
    createDirIfNotExists(logdataDir);
    logData = {};
    logDataFile = path.join(logdataDir, "logData.json");
    loginDataFile = path.join(logdataDir, "logindata.json");
    configFile = path.join(logdataDir, "config.json");
    getConfig();
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
    if(loginData !== null) {
        steamUserName = loginData.username;
        if('key' in loginData) {
            client.logOn({
                "accountName": loginData.username,
                "rememberPassword": true,
                "loginKey": loginData.key
            });
        } else {
            client.logOn({
                "accountName": steamUserName,
                "password": loginData.password,
                "rememberPassword": true
            });
        }
    } else {
        loginPrompt();
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

client.on('error', function(err) {
	// Some error occurred during logon
    if(err.eresult === 5) {
        console.log("Invalid Password or loginKey, reprompting login.");
        loginToSteam(null);
    } else {
        console.log(e);
    }
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
    var newFilePath = path.join(config.logDirectory, fileName);
    //Update Logdata also.
    var isSame = false;
    if(steam64 in logData) {
        if('lastMessage' in logData[steam64]) {
            isSame = moment(logData[steam64].lastMessage).isSame(message.server_timestamp, 'day');
        }
        if('logFile' in logData[steam64]) {
            if(logData[steam64].logFile !== fileName) {
                var oldLogFile = path.join(config.logDirectory, logData[steam64].logFile);
                if(fs.existsSync(oldLogFile)) {
                    //Rename old file before appending text message, only if something in the filename changed.
                    if(fs.existsSync(newFilePath)) {
                        // If the new file name is already taken then append .old to avoid conflicts.
                        fs.renameSync(oldLogFile, newFilePath + ".old");
                    } else {
                        fs.renameSync(oldLogFile, newFilePath);
                    }
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

function getFriendNickName(steamid64, returnFriendName) {
    if(steamid64 in client.myNicknames) {
        return client.myNicknames[steamid64];
    } else if(returnFriendName) {
        return getFriendName(steamid64);
    }
    return null;
}

function formatMessage(user, message) {
    return formatDynamicString(config.messageFormat, moment(message.server_timestamp), message.message, user);
}

function formatDynamicString(formatString, timeMoment, message, user) {
    var steam64 = user.getSteamID64();
    var formattedMessage = "" + formatString;
    var friendName = getFriendName(steam64);
    var friendNick = getFriendNickName(steam64, false);
    var bothNameFormat = friendName;
    if(friendNick !== null) {
        bothNameFormat = ("" + config.bothNameFormat).replace("{Nickname}", friendNick).replace("{Name}", friendName);
    }
    var formatArgs = {
        '{Date}':timeMoment.format(config.dateFormat),
        '{Time}':timeMoment.format(config.timeFormat),
        '{MyName}':getFriendName(null),
        '{MySteamID}':client.steamID.getSteam3RenderedID(),
        '{MySteamID2}':client.steamID.getSteam2RenderedID(),
        '{MySteamID64}':client.steamID.getSteamID64(),
        '{SteamID}':user.getSteam3RenderedID(),
        '{SteamID2}':user.getSteam2RenderedID(),
        '{SteamID64}':steam64,
        '{Nickname}':getFriendNickName(steam64, true),
        '{Name}':getFriendName(steam64),
        '{BothNames}':bothNameFormat,
        '{Message}':message_no_bbcode,
        '{MessageBB}':message
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
    if(fs.existsSync(configFile)) {
        fs.readFile(configFile, (err, data) => {
            if(err) {
                throw err;
            }
            try {
                var loadedConfig = JSON.parse(data);
                var changedConfig = false;
                Object.keys(config).forEach(function (key) {
                    if(!(key in loadedConfig)) {
                        //Add anything new in the default config to the saved config.
                        loadedConfig[key] = config[key];
                        changedConfig = true;
                    }
                });
                config = loadedConfig;
                if(changedConfig) {
                    saveConfig();
                }
                createDirIfNotExists(config.logDirectory);
            } catch (e) {
                //Do nothing I guess?
            }
        });
    } else {
        config.logDirectory = path.join(appPath, "logdata", "logs");
        createDirIfNotExists(config.logDirectory);
        saveConfig();
    }
}

function saveConfig() {
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
}

function createDirIfNotExists(directory) {
    if(!fs.existsSync(directory)) {
        fs.mkdirSync(directory, {recursive: true});
    }
}