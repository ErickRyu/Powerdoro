'use strict';

const assert = require('assert');
const updateTray = require('../updateTray');

describe('updateTray()', function() {
  it('calls tray.setTitle()', function() {
    updateTray({ setTitle: (...params) => this.params = params }, { send: () => {} }, 0);

    assert.equal(this.params[0], '00:00');
  })

  it('calls webContents.send()', function() {
    updateTray({ setTitle: () => {} }, { send: (...params) => this.params = params }, 0);

    assert.equal(this.params[0], 'time-update');
    assert.equal(this.params[1], '00:00');
  })
})
