const electron = require('electron');
const {app, BrowserWindow, Menu, Tray} = require('electron');
const moment = require('moment')
const momentDurationFormatSetup = require('moment-duration-format')

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.

let mainWindow, tray = null

function createWindow () {
    // Create the browser window.
    var electronScreen = electron.screen
    var displays = electronScreen.getAllDisplays()
    var externalDisplay = null
    for (var i in displays) {
        if (displays[i].bounds.x != 0 || displays[i].bounds.y != 0) {
            externalDisplay = displays[i]
            break;
        }
    }

    let xThreshold = 0
    let yThreshold = 0
    if (externalDisplay) {
        xThreshold = externalDisplay.bounds.x
        yThreshold = externalDisplay.bounds.y
    }
    let setting = {
        x: xThreshold,
        y: yThreshold,
        fullscreen: true,
        frame:false,
        alwaysOnTop: true,
        movable: false,
    }
    mainWindow = new BrowserWindow(setting)
    mainWindow.loadFile('index.html')

    mainWindow.setClosable(false);
    setTimeout(()=>{mainWindow.setClosable(true)}, 3000);

    // Emitted when the window is closed.
    mainWindow.on('closed', function () {
        mainWindow = null
    })
}


function startTimer(){
    let min = 3
    let sec = min * 60
    sec = 5
    let ms = sec * 1000
    tray.setTitle( moment.duration(ms, 'milliseconds').format('mm:ss', {trim: false}))
    const intervalObj = setInterval(()=>{
        ms -= 1000
        tray.setTitle( moment.duration(ms, 'milliseconds').format('mm:ss', {trim: false}))

        if(ms <= 0){
            clearTimeout(intervalObj)
            tray.setTitle('Timer')
        }

    }, 1000)
}

app.on('ready', ()=>{
    tray = new Tray('./appicon.png')
    tray.setTitle('Timer')
    const template = [
        {label: 'start 5 sec', click(){startTimer()}}
    ]
    const contextMenu = Menu.buildFromTemplate(template)
    tray.setToolTip('This is my app')
    tray.setContextMenu(contextMenu)
})

// Quit when all windows are closed.
app.on('window-all-closed', function () {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', function () {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) {
        createWindow()
    }
})
