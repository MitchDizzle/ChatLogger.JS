const {app, BrowserWindow, ipcMain, Tray, Menu, shell, dialog} = require('electron');
const prompt = require('electron-prompt');
const path = require('path');

let tray = undefined;
let window = undefined;
var force_quit = false;

const chatLogger = require('./app.js');
chatLogger.setAppPath(app.getAppPath());
chatLogger.setLoginPrompt(function () {
    var loginData = {};
    prompt({
        title: 'Steam Login Username',
        label: 'Username:',
        value: '',
        height: 150,
        inputAttrs: {
            type: 'text'
        }
    }).then((username) => {
        if(username === null) {
            app.quit();
        } else {
            loginData.username = username;
            prompt({
                title: 'Steam Login Password',
                label: 'Password:',
                value: '',
                height: 150,
                inputAttrs: {
                    type: 'password'
                }
            }).then((password) => {
                if(password === null) {
                    app.quit();
                } else {
                    loginData.password = password;
                    chatLogger.login(loginData);
                }
            }).catch(console.error);
        }
    }).catch(console.error);
    
});
chatLogger.setSteamGuardPrompt(function (callback) {
    prompt({
        title: 'Steam Guard Code',
        label: 'Code:',
        value: '',
        height: 150,
        inputAttrs: {
            type: 'text'
        }
    }).then((gaurdcode) => {
        if(gaurdcode === null) {
            app.quit();
        } else {
            callback(gaurdcode)
        }
    }).catch(console.error);
});
var logConfig = {};

// Don't show the app in the doc
//app.dock.hide()

app.on('ready', () => {
    createTray();
    createWindow();
    chatLogger.run();
});

// Quit the app when the window is closed
app.on('window-all-closed', () => {
  app.quit();
});

const createTray = () => {
  tray = new Tray(path.join(__dirname, 'app.ico'));
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Settings', click() { toggleWindow() } },
    { label: 'Logs', click() { shell.openItem(chatLogger.getLogFolder()); } },
    { label: 'Exit', click() { force_quit = true; app.quit(); } }
  ]);
  tray.setToolTip('ChatLogger.JS');
  tray.setContextMenu(contextMenu);
};

const createWindow = () => {
  window = new BrowserWindow({
    width: 430,
    height: 530,
    show: false,
    frame: true,
    alwaysOnTop: true,
    center: true,
    fullscreenable: false,
    resizable: false,
    transparent: false
  });
  window.setMenu(null);
  var indexPath = path.join(app.getAppPath(), "app/index.html");
  window.loadFile(indexPath);
  window.on('close', function(e){
    if(!force_quit) {
      e.preventDefault();
      window.hide();
    }
  });
  window.on('closed', () => {
    window = null;
  });
  /*window.on('blur', () => {
    if(!window.webContents.isDevToolsOpened()) {
      window.hide();
    }
  });*/
};

const toggleWindow = () => {
  if(window.isVisible()) {
    window.hide();
  } else {
    showWindow();
  }
};

const showWindow = () => {
    //Update fields
    var logConfig = chatLogger.getConfig();
    window.webContents.send('updateConfigValues', logConfig);
    //window.setPosition(0, 0, false);
    window.center();
    window.show();
    window.focus();
};

ipcMain.on('update-config', (event, config) => {
    chatLogger.setConfig(config);
});

ipcMain.on('browseDirectory', (event) => {
    dialog.showOpenDialog(window, {
        properties: ['openDirectory']
    }, (filePaths, bookmarks) => {
        window.webContents.send('updateDirectoryValue', filePaths[0]);
    });
});