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
ipcRenderer.on('time-update', (event, arg) =>{ // Todo: Refactoring dupicated get element and consider using Jquery
    document.getElementById('time').value = arg
    document.getElementById('time').disabled = true
    document.getElementById('submit_btn').disabled = true
})

ipcRenderer.on('stoped-timer', (event, arg) =>{
    document.getElementById('time').value = ''
    document.getElementById('time').disabled = false
    document.getElementById('submit_btn').disabled = false
    document.getElementById('time').focus()
})
