const {ipcRenderer} = require('electron')


function sendTime(evnet){
    event.preventDefault()
    let time = document.getElementById('time').value;

    ipcRenderer.send('asynchronous-message', time)
}

