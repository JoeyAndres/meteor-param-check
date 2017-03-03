"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var CheckError = function CheckError(msg) {
  _classCallCheck(this, CheckError);

  this.message = "Match error: " + msg;

  Error.captureStackTrace(this);
};

exports.default = CheckError;