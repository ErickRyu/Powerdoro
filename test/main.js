'use strict'

const assert = require('assert');
const getPrettyTime = require('../getPrettyTime');


describe('getPrettyTime()', function() {
    it('changes 0 ms to 00:00', function() {
        assert.equal(getPrettyTime(0), '00:00');
    })

    it('changes 1000 ms to 00:01', function() {
        assert.equal(getPrettyTime(1000), '00:01');
    })

    it('changes 59499 ms to 00:59', function() {
        assert.equal(getPrettyTime(59499), '00:59');
    })

    it('changes 59500 ms to 01:00', function() {
        assert.equal(getPrettyTime(59500), '01:00');
    })
})
