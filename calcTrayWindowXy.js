'use strict';

module.exports = (relativeY, trayBounds, windowWidth, externalDisplayY) => ({
    x: Math.round(trayBounds.x + (trayBounds.width / 2) - (windowWidth / 2)),
    y: externalDisplayY + relativeY,
 });
