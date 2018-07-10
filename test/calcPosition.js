'use strict';

const assert = require('assert');

const calcPosition = require('../calcPosition');


describe('calcPosition()', function() {
    it('calculates on Windows', function() {
        const position = calcPosition('win32', { x: 3158, y: 880, width: 41, height: 40 }, 221, 0);

        assert.equal(position.x, 3068);
        assert.equal(position.y, 757);
    })

    it('calculates on Mac', function() {
        const position = calcPosition('darwin', { x: 625, y: 0, width: 38, height: 22 }, 220, 0);

        assert.equal(position.x, 534);
        assert.equal(position.y, 25);
    })
})
