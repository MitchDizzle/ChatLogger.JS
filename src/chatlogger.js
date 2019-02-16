
const fs = require('fs');
const moment = require('moment');
const SteamUser = require('steam-user');
const readline = require('readline');
const path = require('path');
const SteamID = require('steamid');
const keytar = require('keytar');
var endOfLine = require('os').EOL;

var client = new SteamUser({
    "machineIdType":"PersistentRandom"
});
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
var configFile = 'config.json';
var scriptFileName = path.basename(__filename);
function runApp() {
    var logdataDir = path.join(appPath, "logdata");
    createDirIfNotExists(logdataDir);
    logData = {};
    logDataFile = path.join(logdataDir, "logData.json");
    configFile = path.join(logdataDir, "config.json");
    getConfig();
    getLogData();

    loginToSteam({}); //Attempt login with stored username + key.
}

function loginToSteam(loginData) {
    if(loginData !== null) {
        if('username' in loginData) { 
            steamUserName = loginData.username;
            if('password' in loginData) {
                //Fresh username and password given
                client.logOn({
                    "accountName": loginData.username,
                    "password": loginData.password,
                    "rememberPassword": true
                });
            } else if('key' in loginData) {
                client.logOn({
                    "accountName": loginData.username,
                    "loginKey": loginData.key,
                    "rememberPassword": true
                });
            }
            return;
        }
        //Get username from keytar
        keytar.getPassword(scriptFileName, "username").then(
            (result) => {
                if(result) {
                    steamUserName = result;
                    keytar.getPassword(scriptFileName, "loginKey").then(
                        (result) => {
                            if(result) {
                                loginToSteam({username:steamUserName,key:result});
                            } else {
                                //Password not found login prompt time.
                                loginToSteam(null);
                            }
                        },
                        (err) => {
                            log.error(err);
                        }
                    );
                } else {
                    //Username not found login prompt time.
                    loginToSteam(null);
                }
            },
            (err) => {
                log.error(err);
            }
        );
        return;
    }
    loginPrompt();
}

client.on('steamGuard', function(domain, callback) {
	console.log("Steam Guard code needed from email ending in " + domain);
	sgPrompt(callback);
});

client.on('loggedOn', function(details) {
	console.log("Logged into Steam as " + client.steamID.getSteam3RenderedID());
    client.setPersona("Online");
});

client.on('loginKey', function(key) {
    // Save the key.
    keytar.setPassword(scriptFileName, "username", steamUserName);
    keytar.setPassword(scriptFileName, "loginKey", key);
    console.log("Login key stored.");
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
    //Check if it's a command bbcode, usually these don't get printed in plain text.
    if(message.message_bbcode_parsed && message.message_bbcode_parsed.length === 1 && typeof message.message_bbcode_parsed[0] === "object" && "content" in message.message_bbcode_parsed[0] && message.message_bbcode_parsed[0].content && message.message_bbcode_parsed[0].content.length === 0) {
        //Convert single bbcode into readable text.
        message.message_no_bbcode = changeBBCodeToMessage(message.message_bbcode_parsed[0]);
        if(message.message_no_bbcode === null) {
            //Something went wrong, set it back.
            message.message_no_bbcode = message.message;
        }
    }
    
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
        //return client.chats[steamid64].name;
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
    return formatDynamicString(config.messageFormat, moment(message.server_timestamp), message, user);
}

const bbTagsFormat = {
    "random":"/random {min}-{max}: {result}",
    "flip":"/flip: {upperCase({result})}",
    "tradeoffer":"Trade Offer From: {aidToCommunity({sender})}"
};
//Maybe I'll expand on these types of variable scopes to include an external js into the app for others to add onto.
const functionReg = /{(.+)\((.*)\)}/gi;
const conversionFuncs = {
    "aidToCommunity": function(accountId) {
        return SteamID.fromIndividualAccountID(parseInt(accountId));
    },
    "upperCase": function(argument) {
        return argument.toUpperCase();
    }
};

function changeBBCodeToMessage(messbb) {
    if(messbb.tag in bbTagsFormat) {
        var formattedMessage = "" + bbTagsFormat[messbb.tag];
        if('attrs' in messbb) {
            Object.keys(messbb.attrs).forEach(function (key) {
                let tempKey = "{" + key + "}";
                if(formattedMessage.includes(tempKey)) {
                    formattedMessage = formattedMessage.replace(tempKey, messbb.attrs[key]);
                }
            });
            //If there are any replacements left 
            if(formattedMessage.includes("{") && formattedMessage.includes("}")) {
                formattedMessage = formattedMessage.replace(functionReg, function(str, funcName, funcArg, offset, s) {
                    if(funcName in conversionFuncs) {
                        return conversionFuncs[funcName](funcArg);
                    }
                    return str; //If the function name isn't matching to our object map then we ignore it.
                });
            }
        }
        return formattedMessage;
    }
    return null;
}

function formatDynamicString(formatString, timeMoment, message, user) {
    var steam64 = user.getSteamID64();
    var formattedMessage = "" + formatString;
    var friendName = getFriendName(steam64);
    var friendNick = getFriendNickName(steam64);
    var bothNameFormat = friendName;
    if(friendNick !== friendName) {
        bothNameFormat = ("" + config.bothNameFormat);
    }
    var formatArgs = {
        '{BothNames}': bothNameFormat, //First so the variables it contains can be replaced properly.
        '{Date}': timeMoment.format(config.dateFormat),
        '{Time}': timeMoment.format(config.timeFormat),
        '{MyName}': getFriendName(null),
        '{MySteamID}': client.steamID.getSteam3RenderedID(),
        '{MySteamID2}': client.steamID.getSteam2RenderedID(),
        '{MySteamID64}': client.steamID.getSteamID64(),
        '{SteamID}': user.getSteam3RenderedID(),
        '{SteamID2}': user.getSteam2RenderedID(),
        '{SteamID64}': steam64,
        '{Nickname}': friendNick,
        '{Name}': friendName,
        '{Message}': message.message_no_bbcode,
        '{MessageBB}': message.message
    };
    Object.keys(formatArgs).forEach(function (key) {
        if(formattedMessage.includes(key)) {
            formattedMessage = formattedMessage.replace(key, formatArgs[key]);
        }
    });
    return formattedMessage;
}

function getChatIdFile(user) {
    return formatDynamicString(config.fileFormat, moment(), {message:'<Message Unknown>',message_no_bbcode:''}, user);
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