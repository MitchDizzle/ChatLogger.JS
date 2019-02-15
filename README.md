# ChatLogger.JS
A Node.js base Steam chat logger which will store logs of all chats under your Steam account.

This script has an Electron body which allows you to run the script like an application, either through unpacking it yourself or through a provided installer.

This application will create a taskbar tray icon which can be used to exit the application, open the configured log folder, and open the settings window.

# Downloading/Installing
This script uses electron-forge to generate an installer and a release for windows. You do not need to run the installer as the entire application is within a zip archive. The installer will also create a shortcut on your desktop for easier use.

# Config/Data Files
The main app uses [node-steam-user](https://github.com/DoctorMcKay/node-steam-user) in order to run an instance of a login to listen to sending and recieving messages and save them to configuarable files. When the app is first executed it will create a config file for editing, if you're using the gui you shouldn't have to worry about this file.

The time formatting options use's moment.js to format the timestamp. [Moment's display format documentation.](https://momentjs.com/docs/#/displaying/)

`logindata.json` will store your username and login key (not your password) in order to automatically log into steam after launching the application again.

`logData.json` will store information and the where abouts of the chat logs. It will store the profile link, name, and last recieved timestamp of past chat messages. This is needed since the log file names are not absolute and can change, this file allows the app to still append to the correct log file.

`config.json` contains the saved settings of the chat logger, feel free to edit this however you should restart 


# Compiling
First step is [installing Node.JS](https://nodejs.org/en/).

Once that is installed go ahead and download the source or checkout the source via git.

Open command prompt within the project's directory and execute these commands:
```shell
npm install
npm run make
```
If you'd rather just compile the application without making an installer use `npm run package`.


# Server Script
This app allows you to run the node.js directly on a linux server. (For Windows just follow the install guide.)

First step would be installing node.js on your linux server. There should be plenty of tutorials out there. [(Installing Node.js via package manager)](https://nodejs.org/en/download/package-manager/)

Second step would be downloading and uploading this script (download the source).

Then execute these commands:
```shell
npm install --only=prod
node ./src/chatlogger.js
```
The script will start, create the config file under `./logdata/config.json` and ask you for login details.

If edit the config be aware that the application will require a restart before using the changes.

To continuously run this application I recommend using [forever](https://www.npmjs.com/package/forever) to run the script as a background application.
Example of my setup:
```shell
npm install forever -g
# Make sure you start the script in the right directory for simplicity.
cd ChatLogger.JS

forever start -a -o out.log -e err.log src/chatlogger.js
```
It is possible to accidently start multiple instances so make sure your instance is stopped completely before starting another.
