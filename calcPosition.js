module.exports = function(calcRelativeY, trayBounds, windowWidth, externalDisplayY) {
    // Center window horizontally below the tray icon
    const x = Math.round(trayBounds.x + (trayBounds.width / 2) - (windowWidth / 2));
    // Position window 4 pixels vertically below the tray icon
    const y = externalDisplayY + calcRelativeY(trayBounds);
    return { x: x, y: y };
}
