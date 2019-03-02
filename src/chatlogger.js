
const fs = require('fs');
const moment = require('moment');
const SteamUser = require('steam-user');
const readline = require('readline');
const path = require('path');
const SteamID = require('steamid');
var endOfLine = require('os').EOL;

var keytar = null;
try {
    keytar = require('keytar');
} catch (e) {
    //Not using keytar.
}

var client = new SteamUser({
    "machineIdType":"PersistentRandom",
    "protocol": SteamUser.EConnectionProtocol.WebSocket,
});
var steamUserName;
var appPath = ".";
//Default config.
var config = {
  "logDirectory":"./logs",
  "fileFormat":"{SteamID64} - {Nickname}.txt",
  "messageFormat":"[{Time}] {BothNames}: {Message}",
  "invalidCharReplacement":"_",
  "seperationString":"──────────{Date}──────────",
  "bothNameFormat":"{Name} ({Nickname})",
  "dateFormat":"L",
  "timeFormat":"LT",
  "saveLoginData":false
};

var logData = {};
var logDataFile = "logData.json";
var configFile = 'config.json';
var scriptFileName = path.basename(__filename);
var logdataDir = './logdata';

//Default login prompts for running through console.
var loginPrompt = function () {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    rl.question('Steam Username: ', (value) => {
        steamUserName = value;
        rl.question('Steam Password: ', (value) => {
            loginToSteam({username:steamUserName,password:value,rememberPassword:config.saveLoginData});
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
  run: function () {
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

function runApp() {
    logdataDir = path.join(appPath, "logdata");
    createDirIfNotExists(logdataDir);
    logData = {};
    logDataFile = path.join(logdataDir, "logData.json");
    configFile = path.join(logdataDir, "config.json");
    getConfig(() => {
        loginToSteam({});
    });
    getLogData();
}

function loginToSteam(loginData) {
    if(loginData !== null) {
        if('username' in loginData) { 
            steamUserName = loginData.username;
            if('password' in loginData) {
                //Fresh username and password given
                let rememberPassword = config.saveLoginData;
                if('rememberPassword' in loginData) {
                    rememberPassword = loginData.rememberPassword;
                } else {
                    rememberPassword = false;
                }
                if(config.saveLoginData !== rememberPassword) {
                    config.saveLoginData = rememberPassword;
                    saveConfig();
                }
                client.logOn({
                    "accountName": loginData.username,
                    "password": loginData.password,
                    "rememberPassword": rememberPassword,
                    "logonID": 350
                });
                return;
            } else if('key' in loginData) {
                client.logOn({
                    "accountName": loginData.username,
                    "loginKey": loginData.key,
                    "rememberPassword": true,
                    "logonID": 350
                });
                return;
            }
        } else if(config.saveLoginData) {
            if(keytar) {
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
                                        console.log("Login key not found, reprompting.");
                                        loginToSteam(null);
                                    }
                                },
                                (err) => {
                                    log.error(err);
                                    loginToSteam(null);
                                }
                            );
                        } else {
                            //Username not found login prompt time.
                            console.log("Login key not found, reprompting.");
                            loginToSteam(null);
                        }
                    },
                    (err) => {
                        log.error(err);
                        loginToSteam(null);
                    }
                );
                return;
            } else {
                //keytar isn't provided, let's find from file.
                var loginDataFile = path.join(logdataDir, "loginData.json");
                if(fs.existsSync(loginDataFile)) {
                    fs.readFile(loginDataFile, (err, data) => {
                        if(err) {
                            throw err;
                        }
                        try {
                            loginToSteam(JSON.parse(data));
                        } catch (e) {
                            //Something went wrong, let's just have them login through prompt.
                            loginToSteam(null);
                        }
                    });
                    return;
                }
            }
        }
    }
    loginPrompt();
}

client.on('steamGuard', function(domain, callback) {
	console.log("Steam Guard code needed from email ending in " + domain);
	sgPrompt(callback);
});

client.on('loggedOn', function(details) {
	console.log("Logged into Steam as " + client.steamID.getSteam3RenderedID());
    client.setPersona(SteamUser.EPersonaState.Invisible);
});

client.on('loginKey', function(key) {
    // Save the key.
    if(config.saveLoginData) {
        if(keytar) {
            keytar.setPassword(scriptFileName, "username", steamUserName);
            keytar.setPassword(scriptFileName, "loginKey", key);
            console.log("Login key stored.");
        } else {
            fs.writeFileSync(path.join(logdataDir, "loginData.json"), JSON.stringify({key:key,username:steamUserName}, null, 2));
            console.log("Login key saved.");
        }
    }
});

client.on('error', function(err) {
	// Some error occurred during logon
    if(err.eresult === 5) {
        console.log("Invalid Password or loginKey, reprompting login.");
        loginToSteam(null);
        //Remove old instances of stored username/loginKey so we don't use bad creds next time.
        if(keytar) {
            keytar.deletePassword(scriptFileName, "username");
            keytar.deletePassword(scriptFileName, "loginKey");
        } else {
            var loginDataFile = path.join(logdataDir, "loginData.json");
            if(fs.existsSync(loginDataFile)) {
                fs.unlink(loginDataFile, function(err){
                    if(err) {
                        return console.log(err);
                    }
                });
            }
        }
    } else {
        console.log(err);
        fs.appendFile(path.join(logdataDir, "error.log"), (new Date()) + " : " + err.toString() + endOfLine, function (error) {
            if(error) {
                throw error;
            }
        });
    }
});

client.on('licenses', function(licenses) {
	console.log("Your account owns " + licenses.length + " license" + (licenses.length == 1 ? '' : 's') + ".");
});

client.chat.on('friendMessage', function(message) {
    userChat(message.steamid_friend, message.steamid_friend, message);
});

client.chat.on('friendMessageEcho', function(message) {
    userChat(message.steamid_friend, client.steamID, message);
});

var nonFriendNames = {};
function userChat(friendSteam, sender, message) {
    //Check if the player is on your friends list:
    var friendName = getFriendName(friendSteam.getSteamID64());
    if(friendName === null) {
        client.getPersonas([friendSteam], function(err, personas) {
            Object.keys(personas).forEach(function (sId) {
                var persona = personas[sId];
                nonFriendNames[sId] = persona ? persona.player_name : sId;
            });
            userChatEx(friendSteam, sender, message);
        });
        return;
    }
    userChatEx(friendSteam, sender, message);
}
function userChatEx(friendSteam, sender, message) {
    //Check if it's a command bbcode, usually these don't get printed in plain text.
    if(message.message_bbcode_parsed && message.message_bbcode_parsed.length === 1 && typeof message.message_bbcode_parsed[0] === "object" && "content" in message.message_bbcode_parsed[0] && message.message_bbcode_parsed[0].content && message.message_bbcode_parsed[0].content.length === 0) {
        //Convert single bbcode into readable text.
        message.message_no_bbcode = changeBBCodeToMessage(message.message_bbcode_parsed[0]);
        if(message.message_no_bbcode === null) {
            //Something went wrong, set it back.
            message.message_no_bbcode = message.message;
        }
    }
    var steam64 = friendSteam.getSteamID64();
    var formattedMessage = formatMessage(sender, message).replace(/(?:\n)/g, endOfLine);
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
    console.log(formattedMessage);
    return formattedMessage;
}

function getFriendName(steamid64) {
    if(steamid64 === null || steamid64 === client.steamID.getSteamID64()) {
        return client.accountInfo.name;
    }
    if(steamid64 in client.users) {
        return client.users[steamid64].player_name;
    }
    if(steamid64 in nonFriendNames) {
        //User isn't a friend but we've cached his name.
        return nonFriendNames[steamid64];
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

function getConfig(callback) {
    if(fs.existsSync(configFile)) {
        fs.readFile(configFile, (err, data) => {
            if(err) {
                throw err;
            }
            let loadedConfig = JSON.parse(data);
            let changedConfig = false;
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
            callback();
        });
    } else {
        config.logDirectory = path.join(appPath, "logdata", "logs");
        createDirIfNotExists(config.logDirectory);
        saveConfig();
        callback();
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