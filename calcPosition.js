module.exports = function(calcRelativeY, trayBounds, windowWidth, externalDisplayY) {
    // Center window horizontally below the tray icon
    const x = Math.round(trayBounds.x + (trayBounds.width / 2) - (windowWidth / 2));
    return { x: x, y: externalDisplayY + calcRelativeY(trayBounds) };
}
