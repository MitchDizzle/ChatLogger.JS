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

const cmdArguments = () => {
    var argObj = {};
    process.argv.forEach(function (val, index, array) {
        if(val === "-dev") {
            argObj.dev = true;
        }
    });
    return argObj;
};

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
    
    
    chatLogger.setAppPath(app.getAppPath());
    chatLogger.setLoginPrompt(function () {
        electronPrompt({
            title: 'Steam Login',
            label: 'logindetails',
            height: 165,
            width: 425
        }).then((loginData) => {
            if(loginData) {
                chatLogger.login(loginData);
            } else {
                forceQuit();
            }
        }).catch(function(err) {
            console.log(err);
            forceQuit();
        });
    });

    chatLogger.setSteamGuardPrompt(function (callback) {
        electronPrompt({
            title: 'Steam Guard Code',
            label: 'steamguarddetails',
            height: 115,
            width: 240
        }).then((data) => {
            if(data && data.guardCode) {
                callback(data.guardCode);
            } else {
                forceQuit();
            }
        }).catch(function(err) {
            console.log(err);
            forceQuit();
        });
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
        { label: 'Devtools', visible:(cmdArguments.dev===true), click() { window.webContents.openDevTools({mode:'detach'}); } },
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
        width: 465,
        height: 600,
        show: false,
        frame: true,
        alwaysOnTop: false,
        center: true,
        fullscreenable: false,
        resizable: false,
        transparent: false,
        title: "ChatLogger.JS - v" + app.getVersion(),
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
    window.on('ready-to-show', () => {
        updateWindowConfig();
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
    app.setLoginItemSettings({
        openAtLogin: true,
        path: process.execPath
    });
};

const showWindow = () => {
    //Update fields
    updateWindowConfig();
    window.center();
    window.show();
    window.focus();
};

const updateWindowConfig = () => {
    window.webContents.send('updateConfigValues', chatLogger.getConfig());
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
        if(filePaths && filePaths.length > 0) {
            window.webContents.send('updateDirectoryValue', filePaths[0]);
        }
    });
});


function electronPrompt(options, parentWindow) {
	return new Promise((resolve, reject) => {
		const id = `${new Date().getTime()}-${Math.random()}`;

		const opts = Object.assign(
			{
				width: 370,
				height: 130,
				resizable: false,
				title: 'Prompt',
				label: null,
				alwaysOnTop: true,
			},
			options || {}
		);
        
        if(opts.label === null) {
            return reject(new Error('"label" must be defined'));
        }

		let promptWindow = new BrowserWindow({
			width: opts.width,
			height: opts.height,
			resizable: opts.resizable,
			parent: parentWindow,
			skipTaskbar: false,
			alwaysOnTop: opts.alwaysOnTop,
			useContentSize: true,
			modal: Boolean(parentWindow),
			title: opts.title,
            webPreferences: {
                preload: path.join(__dirname, 'page', 'preload.js'),
                nodeIntegration: false,
                contextIsolation: false
            }
		});

		promptWindow.setMenu(null);

		const getOptionsListener = event => {
			event.returnValue = JSON.stringify(opts);
		};

		const cleanup = () => {
			if (promptWindow) {
				promptWindow.close();
				promptWindow = null;
			}
		};

		const postDataListener = (event, value) => {
			resolve(value);
			event.returnValue = null;
			cleanup();
		};

		const unresponsiveListener = () => {
			reject(new Error('Window was unresponsive'));
			cleanup();
		};

		const errorListener = (event, message) => {
			reject(new Error(message));
			event.returnValue = null;
			cleanup();
		};

		ipcMain.on('prompt-get-options:' + id, getOptionsListener);
		ipcMain.on('prompt-post-data:' + id, postDataListener);
		ipcMain.on('prompt-error:' + id, errorListener);
		promptWindow.on('unresponsive', unresponsiveListener);

		promptWindow.on('closed', () => {
			ipcMain.removeListener('prompt-get-options:' + id, getOptionsListener);
			ipcMain.removeListener('prompt-post-data:' + id, postDataListener);
			ipcMain.removeListener('prompt-error:' + id, postDataListener);
			resolve(null);
		});

		promptWindow.loadFile(path.join(__dirname, 'page', 'prompts', opts.label+'.html'), {hash:id});
	});
}