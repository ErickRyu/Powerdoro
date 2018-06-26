const electron = require('electron');
const {app, BrowserWindow, Menu, Tray} = require('electron');
const moment = require('moment')
const momentDurationFormatSetup = require('moment-duration-format')

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.

let mainWindow, tray = null
let min, sec, ms
let intervalObj

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


function getPrettyTime(ms){
    return moment.duration(ms, 'milliseconds').format('mm:ss', {trim: false})
}

function startTimer(min, sec){
    ms = ((min * 60) + sec) * 1000
    tray.setTitle( getPrettyTime(ms))
    setStartTimerTray()
    intervalObj = setInterval(()=>{
        ms -= 1000
        tray.setTitle( getPrettyTime(ms) )

        if(ms <= 0){
            clearTimeout(intervalObj)
            setStopTimerTray()
            createWindow()
        }

    }, 1000)
}

function initTray(){
    tray = new Tray('./appicon.png')
    tray.setTitle('Timer')
    tray.setToolTip('This is my app')
    setTrayTemplate(startTimerTemplate)

}

const stopTimerTemplate = [
    {label: 'stoptimer', click(){
        clearTimeout(intervalObj)
        setStopTimerTray()
    }}
]
const startTimerTemplate = [
    {label: 'start 5 sec', click(){startTimer(0, 5)}},
    {label: 'start 10 min', click(){
        startTimer(10, 0)
    }},
]

function setStartTimerTray(){
    setTrayTemplate(stopTimerTemplate)
}

function setStopTimerTray(){ 
    tray.setTitle('Timer')
    setTrayTemplate(startTimerTemplate)
}

function setTrayTemplate(template){
    const contextMenu = Menu.buildFromTemplate(template)
    tray.setContextMenu(contextMenu)
}

app.on('ready', ()=>{
    initTray()
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
