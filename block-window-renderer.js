'use strict';

const {ipcRenderer} = require('electron')


function sendRetrospect(event){
  let retrospect = document.getElementById('retrospect').value;
  ipcRenderer.send('retrospect-message', retrospect)
}

ipcRenderer.on('block-time-update', (event, arg) =>{ // Todo: Refactoring dupicated get element and consider using Jquery
  document.getElementById('time').value = arg
  document.getElementById('time').disabled = true
  document.getElementById('submit_btn').disabled = true
})
