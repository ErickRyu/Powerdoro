const calcTrayWindowXy = require('./calcTrayWindowXy');;

module.exports = (calcRelativeY, trayBounds, windowWidth, externalDisplayY) => calcTrayWindowXy(calcRelativeY(trayBounds), trayBounds, windowWidth, externalDisplayY);
