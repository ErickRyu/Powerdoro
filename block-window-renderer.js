'use strict';

const {ipcRenderer} = require('electron')


function sendRetrospect(event){
    let retrospect = document.getElementById('retrospect').value;
    ipcRenderer.send('retrospect-message', retrospect)
}

