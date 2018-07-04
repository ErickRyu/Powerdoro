const electron = require('electron')
const {app, BrowserWindow, Menu, Tray, ipcMain} = require('electron')
const moment = require('moment')
const momentDurationFormatSetup = require('moment-duration-format')
const fs = require('fs')

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.

let mainWindow, tray, trayWindow = null
let min, sec, ms
let intervalObj


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
    mainWindow.loadFile('index.html')

    mainWindow.setClosable(false);

    // Emitted when the window is closed.
    mainWindow.on('closed', function () {
        mainWindow = null
    })
}


function getPrettyTime(ms){
    return moment.duration(ms, 'milliseconds').format('mm:ss', {trim: false})
}


function startTimer(min, sec){
    ms = ((min * 60) + sec) * 1000
    tray.setTitle( getPrettyTime(ms))
    intervalObj = setInterval(()=>{
        ms -= 1000
        tray.setTitle( getPrettyTime(ms) )
        trayWindow.webContents.send('time-update', getPrettyTime(ms))
        if(ms <= 0){ // Todo: Refactoring duplicated stop timer action
            trayWindow.webContents.send('stoped-timer', 'stop')
            clearTimeout(intervalObj)
            createBlockConcentrationWindow()
        }

    }, 1000)
}



const createTray = () => {
    tray = new Tray('appicon.png')
    tray.on('click', function (event) {
        toggleWindow()
    })
}


const getTrayWindowPosition= () => {
    const windowBounds = trayWindow.getBounds()
    const trayBounds = tray.getBounds()
    const externalDisplay = getExternalDisplayThreashold();

    // Center window horizontally below the tray icon
    const x = Math.round(trayBounds.x + (trayBounds.width / 2) - (windowBounds.width / 2))

    // Position window 4 pixels vertically below the tray icon
    const y = externalDisplay.y + Math.round(trayBounds.y + trayBounds.height + 3)

    console.log(x, y)
    return {x: x, y: y}
}


// Creates window & specifies its values
const createTrayWindow = () => {
    trayWindow = new BrowserWindow({
        width: 220,
        height: 120,
        show: false,
        frame: false,
        fullscreenable: false,
        resizable: false,
        transparent: true,
        movable: false,

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
    const position = getTrayWindowPosition()
    trayWindow.setPosition(position.x, position.y, false)
    trayWindow.show()
    trayWindow.focus()
}


ipcMain.on('asynchronous-message', (event, arg) => {
    startTimer(arg, 0)
    trayWindow.hide();
})


ipcMain.on('retrospect-message', (event, arg) => {
    fs.appendFile('retrospect.txt', arg + '\n', (err)=>{
        if(err){
            console.log(err)
            throw err
        }
    })
    mainWindow.setClosable(true)
    mainWindow.close()

})


ipcMain.on('stop-message', (event, arg) => {
    trayWindow.webContents.send('stoped-timer', 'stop')
    clearTimeout(intervalObj)
    tray.setTitle( '00:00' )
})


app.dock.hide()


app.on('ready', ()=>{
    createTray()
    createTrayWindow()
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
        createBlockConcentrationWindow()
    }
})
