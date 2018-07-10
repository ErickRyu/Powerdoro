'use strict';

const assert = require('assert');

const calcPosition = require('../calcPosition');


describe('calcPosition()', function() {
    it('calculates on Windows', function() {
        const position = calcPosition('win32', { x: 3158, y: 880, width: 41, height: 40 }, 221, 0);

        assert.equal(position.x, 3068);
        assert.equal(position.y, 757);
    })
})
