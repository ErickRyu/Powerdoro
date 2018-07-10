module.exports = function(platform, trayBounds, windowWidth, externalDisplayY) {
    // Center window horizontally below the tray icon
    const x = Math.round(trayBounds.x + (trayBounds.width / 2) - (windowWidth / 2));
    // Position window 4 pixels vertically below the tray icon
    let y = 0;
    if (platform == 'darwin') {
        y = externalDisplayY;
        y += Math.round(trayBounds.y + trayBounds.height + 3);
    }
    else {
        y = externalDisplayY;
        y += trayBounds.y - (3 + 120); //Todo: Extract constant and replace to trayWindow's height
    }
    return { x: x, y: y };
}
