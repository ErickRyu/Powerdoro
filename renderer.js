const {ipcRenderer} = require('electron')


function sendTime(event){
    event.preventDefault()
    let time = document.getElementById('time').value;

    ipcRenderer.send('asynchronous-message', time)
}

function sendRetrospect(event){
    let retrospect = document.getElementById('retrospect').value;
    ipcRenderer.send('retrospect-message', retrospect)
}

function stopTimer(){
    ipcRenderer.send('stop-message', 'stop')

}
