const {ipcRenderer} = require('electron')
//console.log(ipcRenderer.sendSync('synchronous-message', 'ping')) // "pong"이 출력됩니다.

ipcRenderer.on('asynchronous-reply', (event, arg) => {
    console.log(arg) // "pong"이 출력됩니다.
})

function sendTime(evnet){
    event.preventDefault()
    let time = document.getElementById('time').value;

    ipcRenderer.send('asynchronous-message', time)
}

