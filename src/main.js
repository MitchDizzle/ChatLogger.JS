const {app, BrowserWindow, ipcMain, Tray, nativeImage, Menu, shell, dialog} = require('electron');
const path = require('path');

let tray = undefined;
let window = undefined;
let force_quit = false;

const forceQuit = () => {
    force_quit = true;
    app.quit();
};

if(require('electron-squirrel-startup')) { // eslint-disable-line global-require
    forceQuit();
}
// Quit the app when the window is closed
app.on('window-all-closed', () => {
    forceQuit();
});

const gotTheLock = app.requestSingleInstanceLock();

const chatLogger = require('./chatlogger');

if(!gotTheLock) {
    forceQuit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // Someone tried to run a second instance, we should focus our window.
        if(window) {
            if(window.isMinimized()) {
                window.restore();
            }
            window.focus();
        }
    });
    
    app.on('ready', () => {
        createWindow();
        createTray();
        chatLogger.run();
    });
    
    const prompt = require('electron-prompt');
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
                forceQuit();
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
                        forceQuit();
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
                forceQuit();
            } else {
                callback(gaurdcode)
            }
        }).catch(console.error);
    });
}

const logOut = () => {
    chatLogger.logout();
    window.hide();
}

const createTray = () => {
    tray = new Tray(path.join(__dirname, 'icons', 'app.ico'));
    const contextMenu = Menu.buildFromTemplate([
        { label: 'Settings', click() { toggleWindow(); } },
        { label: 'Start with Windows', click() { startWithWindows(); } },
        { label: 'Devtools', click() { window.webContents.openDevTools({mode: 'detach'}); } },
        { type:'separator' },
        { label: 'Log Folder', click() { shell.openItem(chatLogger.getLogFolder()); } },
        { type:'separator' },
        { label: 'Logout', click() { logOut(); } },
        { label: 'Exit', click() { forceQuit(); } }
    ]);
    tray.setToolTip('ChatLogger.JS');
    tray.setContextMenu(contextMenu);
};

const createWindow = () => {
    window = new BrowserWindow({
        width: 450,
        //height: 560,
        show: false,
        frame: true,
        alwaysOnTop: false,
        center: true,
        fullscreenable: false,
        resizable: false,
        transparent: false,
        webPreferences: {
            preload: path.join(__dirname, 'page', 'preload.js'),
            nodeIntegration: false,
            contextIsolation: false
        },
        icon: path.join(__dirname, 'icons', 'app.ico')
    });
    window.setMenu(null); //window.removeMenu();
    window.loadFile(path.join(__dirname, 'page', 'settings.html'));
    
    window.on('close', function(e){
        if(!force_quit) {
            e.preventDefault();
            window.hide();
        }
    });
    window.on('closed', () => {
        window = null;
    });
};

const toggleWindow = () => {
    if(window.isVisible()) {
        window.hide();
    } else {
        showWindow();
    }
};

const startWithWindows = () => {
    const exeName = path.basename(process.execPath);
    app.setLoginItemSettings({
        openAtLogin: true,
        path: exeName
    });
};

const showWindow = () => {
    //Update fields
    window.webContents.send('updateConfigValues', chatLogger.getConfig());
    window.center();
    window.show();
    window.focus();
};

ipcMain.on('logOut', (event) => {
    logOut();
});

ipcMain.on('update-config', (event, config) => {
    chatLogger.setConfig(config);
});

ipcMain.on('browseDirectory', (event) => {
    dialog.showOpenDialog(window, {
        properties: ['openDirectory']
    }, (filePaths, bookmarks) => {
        if(filePaths.length > 0) {
            window.webContents.send('updateDirectoryValue', filePaths[0]);
        }
    });
});