module.exports = function(calcRelativeY, trayBounds, windowWidth, externalDisplayY) {
    return {
        x: Math.round(trayBounds.x + (trayBounds.width / 2) - (windowWidth / 2)),
        y: externalDisplayY + calcRelativeY(trayBounds),
     };
}
