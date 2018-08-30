'use strict';

const electron = require('electron')
const {app, BrowserWindow, Tray, ipcMain} = require('electron')
const fs = require('fs')
const path = require('path');
const homedir = require('os').homedir();
const updateTray = require('./updateTray');
const calcTrayWindowXy = require('./calcTrayWindowXy');
const AutoLaunch = require('auto-launch');
const moment = require('moment');
const getPrettyTime = require('./getPrettyTime');

const ONE_MILLISEC = 1000;
// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.

let mainWindow, tray, trayWindow = null
let intervalObj
let min
let startedTime, stopedTime;

var AutoLauncher = new AutoLaunch({
    name: 'powerdoro',
    path: '/Applications/powerdoro.app',
})
AutoLauncher.enable();


function getExternalDisplayThreashold(){
    var electronScreen = electron.screen
    var displays = electronScreen.getAllDisplays()
    var externalDisplay = null
    for (var i in displays) {
        if (displays[i].bounds.x != 0 || displays[i].bounds.y != 0) {
            externalDisplay = displays[i]
            break
        }
    }

    return externalDisplay?  {x: externalDisplay.bounds.x, y: externalDisplay.bounds.y} : {x: 0, y:0}
}


function createBlockConcentrationWindow () {
    let displayThreashold = getExternalDisplayThreashold()

    let xThreshold = displayThreashold.x
    let yThreshold = displayThreashold.y

    let setting = {
        x: xThreshold,
        y: yThreshold,
        fullscreen: true,
        frame:false,
        alwaysOnTop: true,
        movable: false,
    }
    mainWindow = new BrowserWindow(setting)
    let mainWindowPath = path.join(__dirname, 'index.html')
    mainWindow.loadFile(mainWindowPath)

    mainWindow.setClosable(false);

    // Emitted when the window is closed.
    mainWindow.on('closed', function () {
        mainWindow = null
    })
}


function stopTimer(){
  stopedTime = moment().format('HH:mm');
  trayWindow.webContents.send('stoped-timer', 'stop')
  clearTimeout(intervalObj)
  createBlockConcentrationWindow()
}


function startTimer(min, sec){
    startedTime = moment().format('HH:mm');
    let ms = ((min * 60) + sec) * ONE_MILLISEC
    ms = Math.ceil(ms / ONE_MILLISEC) * ONE_MILLISEC; // Round up by one millisecond
    updateTray(tray, trayWindow.webContents, ms);
    intervalObj = setInterval(()=>{
        ms -= ONE_MILLISEC
        updateTray(tray, trayWindow.webContents, ms);
        if(ms <= 0){ // Todo: Refactoring duplicated stop timer action
          stopTimer()
       }

    }, ONE_MILLISEC)
}



const createTray = () => {
    let iconPath = path.join(__dirname, 'appicon.png')
    tray = new Tray(iconPath)
    tray.on('click', function (event) {
        toggleWindow()
    })
}

const platforms = {
    darwin: {
        calcRelativeY: (trayBounds) => Math.round(trayBounds.y + trayBounds.height + 3),
        hide: (app) => app.dock.hide(),
        quit: (app) => app.quit(),
    },
    win32: {
        calcRelativeY: (trayBounds) => trayBounds.y - (3 + 120), //Todo: Extract constant and replace to trayWindow's height
        hide: (app) => {},
        quit: (app) => {},
    }
};


// Creates window & specifies its values
const createTrayWindow = () => {
    trayWindow = new BrowserWindow({
        width: 220,
        height: 160,
        show: false,
        frame: false,
        fullscreenable: false,
        resizable: false,
        transparent: true,
        movable: false,
        closable: false,
        'node-integration': false
    })
    // This is where the index.html file is loaded into the window
    trayWindow.loadURL('file://' + __dirname + '/menu.html');

    // Hide the window when it loses focus
    trayWindow.on('blur', () => {
        if (!trayWindow.webContents.isDevToolsOpened()) {
            trayWindow.hide()
        }
    })
}


const toggleWindow = () => {
    if (trayWindow.isVisible()) {
        trayWindow.hide()
    } else {
        showTrayWindow()
    }
}


const showTrayWindow = () => {
    const position = calcTrayWindowXy(
        platforms[process.platform].calcRelativeY(tray.getBounds()),
        tray.getBounds(),
        trayWindow.getBounds().width,
        getExternalDisplayThreashold().y
    );

    trayWindow.setPosition(position.x, position.y, false)
    trayWindow.show()
    trayWindow.focus()
}


ipcMain.on('asynchronous-message', (event, arg) => {
    min = arg
    startTimer(arg, 0)
    trayWindow.hide();
})


var appendRetrospect = function(retrospect) {
    let retroDirPath = path.join(homedir + '/Desktop/retrospect/')
    if(!fs.existsSync(retroDirPath)){
      fs.mkdir(retroDirPath)
    }
    let retroPath = path.join(retroDirPath + moment().format('YYYY_MM_DD') + '.txt') //Todo: Refacor with es5 syntax
    
    let ms = ((min * 60) + 0 ) * ONE_MILLISEC
    ms = Math.ceil(ms / ONE_MILLISEC) * ONE_MILLISEC; // Round up by one millisecond
    let prettyTime = getPrettyTime(ms)
    
    let history = `[${startedTime}-${stopedTime}] [${prettyTime}] : ${retrospect}`
    fs.appendFile(retroPath, history + '\n', (err)=>{
        if(err){
            console.log(err)
            throw err
        }
    })
    mainWindow.setClosable(true)
    mainWindow.close()
}

ipcMain.on('retrospect-message', (event, arg) => {
  appendRetrospect(arg)
})


ipcMain.on('stop-message', (event, arg) => {
  stopTimer()
  tray.setTitle( '00:00' )
})


ipcMain.on('exit-app', (event, arg) =>{
      app.exit()
})


platforms[process.platform].hide(app);


app.on('ready', ()=>{
    createTray()
    createTrayWindow()
})


// Quit when all windows are closed.
app.on('window-all-closed', function () {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    platforms[process.platform].quit(app);
})


app.on('activate', function () {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) {
        createBlockConcentrationWindow()
    }
})
