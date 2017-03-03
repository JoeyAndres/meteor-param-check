'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Match = exports.check = undefined;

require('babel-core/register');

require('babel-plugin-external-helpers');

var _match = require('./match');

exports.check = _match.check;
exports.Match = _match.Match;