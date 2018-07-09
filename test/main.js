'use strict'

const assert = require('assert');
const getPrettyTime = require('../getPrettyTime');


describe('getPrettyTime()', function() {
    it('changes 1000 ms to 00:01', function() {
        assert.equal(getPrettyTime(1000), '00:01');
    })
})
