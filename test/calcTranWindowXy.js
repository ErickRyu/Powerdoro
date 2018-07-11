'use strict';

const calcTrayWindowXy = require('../calcTrayWindowXy');
const assert = require('assert');

describe('calcTrayWindowXy()', function() {
    it('calculates x and y', function() {
        const position = calcTrayWindowXy(111, { x: 625, y: 0, width: 38, height: 22 }, 220, 25);

        assert.equal(position.x, 534);
        assert.equal(position.y, 136);
    })
})
