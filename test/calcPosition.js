'use strict';

const assert = require('assert');

const calcPosition = require('../calcPosition');


describe('calcPosition()', function() {
    it('calculates on Windows', function() {
        const position = calcPosition((trayBounds) => trayBounds.y - (3 + 120), { x: 3158, y: 880, width: 41, height: 40 }, 221, 0);

        assert.equal(position.x, 3068);
        assert.equal(position.y, 757);
    })

    it('calculates on Mac', function() {
        const position = calcPosition((trayBounds) => Math.round(trayBounds.y + trayBounds.height + 3), { x: 625, y: 0, width: 38, height: 22 }, 220, 0);

        assert.equal(position.x, 534);
        assert.equal(position.y, 25);
    })
})
