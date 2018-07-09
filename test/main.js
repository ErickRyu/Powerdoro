'use strict'

const assert = require('assert');
const getPrettyTime = require('../getPrettyTime');


describe('getPrettyTime()', function() {
    it('returns a formatted string', function() {
        assert.equal(getPrettyTime(1000), '00:01');
    })
})
