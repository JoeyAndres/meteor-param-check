'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; // XXX docs

// Things we explicitly do NOT support:
//    - heterogenous arrays

var _underscore = require('underscore');

var _underscore2 = _interopRequireDefault(_underscore);

var _ejson = require('ejson');

var _ejson2 = _interopRequireDefault(_ejson);

var _CheckError = require('./CheckError');

var _CheckError2 = _interopRequireDefault(_CheckError);

var _isPlainObject = require('./isPlainObject');

var _isPlainObject2 = _interopRequireDefault(_isPlainObject);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var currentArgumentChecker = {
  // TODO: Deal with fiber.
  getOrNullIfOutsideFiber: function getOrNullIfOutsideFiber() {
    return false;
  }
};

/**
 * @summary Check that a value matches a [pattern](#matchpatterns).
 * If the value does not match the pattern, throw a `Match.Error`.
 *
 * Particularly useful to assert that arguments to a function have the right
 * types and structure.
 * @locus Anywhere
 * @param {Any} value The value to check
 * @param {MatchPattern} pattern The pattern to match
 * `value` against
 */
var check = exports.check = function (value, pattern) {
  // Record that check got called, if somebody cared.
  //
  // We use getOrNullIfOutsideFiber so that it's OK to call check()
  // from non-Fiber server contexts; the downside is that if you forget to
  // bindEnvironment on some random callback in your method/publisher,
  // it might not find the argumentChecker and you'll get an error about
  // not checking an argument that it looks like you're checking (instead
  // of just getting a "Node code must run in a Fiber" error).
  var argChecker = currentArgumentChecker.getOrNullIfOutsideFiber();
  if (argChecker) argChecker.checking(value);
  var result = testSubtree(value, pattern);
  if (result) {
    var err = new Match.Error(result.message);
    if (result.path) {
      err.message += " in field " + result.path;
      err.path = result.path;
    }
    throw err;
  }
};

/**
 * @namespace Match
 * @summary The namespace for all Match types and methods.
 */
var Match = exports.Match = {
  Optional: function Optional(pattern) {
    return new _Optional(pattern);
  },
  Maybe: function Maybe(pattern) {
    return new _Maybe(pattern);
  },
  OneOf: function OneOf() /*arguments*/{
    return new _OneOf(_underscore2.default.toArray(arguments));
  },
  Any: ['__any__'],
  Where: function Where(condition) {
    return new _Where(condition);
  },
  ObjectIncluding: function ObjectIncluding(pattern) {
    return new _ObjectIncluding(pattern);
  },
  ObjectWithValues: function ObjectWithValues(pattern) {
    return new _ObjectWithValues(pattern);
  },
  // Matches only signed 32-bit integers
  Integer: ['__integer__'],

  // XXX matchers should know how to describe themselves for errors
  Error: _CheckError2.default,

  // Tests to see if value matches pattern. Unlike check, it merely returns true
  // or false (unless an error other than Match.Error was thrown). It does not
  // interact with _failIfArgumentsAreNotAllChecked.
  // XXX maybe also implement a Match.match which returns more information about
  //     failures but without using exception handling or doing what check()
  //     does with _failIfArgumentsAreNotAllChecked and Meteor.Error conversion
  //
  // TODO(jandres): _failIfArgumentsAreNotAllChecked is currently not supported,
  //                until CHECK-4

  /**
   * @summary Returns true if the value matches the pattern.
   * @locus Anywhere
   * @param {Any} value The value to check
   * @param {MatchPattern} pattern The pattern to match `value` against
   */
  test: function test(value, pattern) {
    return !testSubtree(value, pattern);
  }
};

var _Optional = function _Optional(pattern) {
  this.pattern = pattern;
};

var _Maybe = function _Maybe(pattern) {
  this.pattern = pattern;
};

var _OneOf = function _OneOf(choices) {
  if (_underscore2.default.isEmpty(choices)) throw new Error("Must provide at least one choice to Match.OneOf");
  this.choices = choices;
};

var _Where = function _Where(condition) {
  this.condition = condition;
};

var _ObjectIncluding = function _ObjectIncluding(pattern) {
  this.pattern = pattern;
};

var _ObjectWithValues = function _ObjectWithValues(pattern) {
  this.pattern = pattern;
};

var stringForErrorMessage = function stringForErrorMessage(value, options) {
  options = options || {};

  if (value === null) return "null";

  if (options.onlyShowType) {
    return typeof value === 'undefined' ? 'undefined' : _typeof(value);
  }

  // Your average non-object things.  Saves from doing the try/catch below for.
  if ((typeof value === 'undefined' ? 'undefined' : _typeof(value)) !== "object") {
    return _ejson2.default.stringify(value);
  }

  try {
    // Find objects with circular references since EJSON doesn't support them yet (Issue #4778 + Unaccepted PR)
    // If the native stringify is going to choke, EJSON.stringify is going to choke too.
    JSON.stringify(value);
  } catch (stringifyError) {
    if (stringifyError.name === "TypeError") {
      return typeof value === 'undefined' ? 'undefined' : _typeof(value);
    }
  }

  return _ejson2.default.stringify(value);
};

var typeofChecks = [[String, "string"], [Number, "number"], [Boolean, "boolean"],
// While we don't allow undefined/function in EJSON, this is good for optional
// arguments with OneOf.
[Function, "function"], [undefined, "undefined"]];

// Return `false` if it matches. Otherwise, return an object with a `message` and a `path` field.
var testSubtree = function testSubtree(value, pattern) {
  // Match anything!
  if (pattern === Match.Any) return false;

  // Basic atomic types.
  // Do not match boxed objects (e.g. String, Boolean)
  for (var i = 0; i < typeofChecks.length; ++i) {
    if (pattern === typeofChecks[i][0]) {
      if ((typeof value === 'undefined' ? 'undefined' : _typeof(value)) === typeofChecks[i][1]) return false;
      return {
        message: "Expected " + typeofChecks[i][1] + ", got " + stringForErrorMessage(value, { onlyShowType: true }),
        path: ""
      };
    }
  }

  if (pattern === null) {
    if (value === null) {
      return false;
    }
    return {
      message: "Expected null, got " + stringForErrorMessage(value),
      path: ""
    };
  }

  // Strings, numbers, and booleans match literally. Goes well with Match.OneOf.
  if (typeof pattern === "string" || typeof pattern === "number" || typeof pattern === "boolean") {
    if (value === pattern) return false;
    return {
      message: "Expected " + pattern + ", got " + stringForErrorMessage(value),
      path: ""
    };
  }

  // Match.Integer is special type encoded with array
  if (pattern === Match.Integer) {
    // There is no consistent and reliable way to check if variable is a 64-bit
    // integer. One of the popular solutions is to get reminder of division by 1
    // but this method fails on really large floats with big precision.
    // E.g.: 1.348192308491824e+23 % 1 === 0 in V8
    // Bitwise operators work consistantly but always cast variable to 32-bit
    // signed integer according to JavaScript specs.
    if (typeof value === "number" && (value | 0) === value) return false;
    return {
      message: "Expected Integer, got " + stringForErrorMessage(value),
      path: ""
    };
  }

  // "Object" is shorthand for Match.ObjectIncluding({});
  if (pattern === Object) pattern = Match.ObjectIncluding({});

  // Array (checked AFTER Any, which is implemented as an Array).
  if (pattern instanceof Array) {
    if (pattern.length !== 1) {
      return {
        message: "Bad pattern: arrays must have one type element" + stringForErrorMessage(pattern),
        path: ""
      };
    }
    if (!_underscore2.default.isArray(value) && !_underscore2.default.isArguments(value)) {
      return {
        message: "Expected array, got " + stringForErrorMessage(value),
        path: ""
      };
    }

    for (var i = 0, length = value.length; i < length; i++) {
      var result = testSubtree(value[i], pattern[0]);
      if (result) {
        result.path = _prependPath(i, result.path);
        return result;
      }
    }
    return false;
  }

  // Arbitrary validation checks. The condition can return false or throw a
  // Match.Error (ie, it can internally use check()) to fail.
  if (pattern instanceof _Where) {
    var result;
    try {
      result = pattern.condition(value);
    } catch (err) {
      if (!(err instanceof Match.Error)) throw err;
      return {
        message: err.message,
        path: err.path
      };
    }
    if (result) return false;
    // XXX this error is terrible
    return {
      message: "Failed Match.Where validation",
      path: ""
    };
  }

  if (pattern instanceof _Maybe) {
    pattern = Match.OneOf(undefined, null, pattern.pattern);
  } else if (pattern instanceof _Optional) {
    pattern = Match.OneOf(undefined, pattern.pattern);
  }

  if (pattern instanceof _OneOf) {
    for (var i = 0; i < pattern.choices.length; ++i) {
      var result = testSubtree(value, pattern.choices[i]);
      if (!result) {
        // No error? Yay, return.
        return false;
      }
      // Match errors just mean try another choice.
    }
    // XXX this error is terrible
    return {
      message: "Failed Match.OneOf, Match.Maybe or Match.Optional validation",
      path: ""
    };
  }

  // A function that isn't something we special-case is assumed to be a
  // constructor.
  if (pattern instanceof Function) {
    if (value instanceof pattern) return false;
    return {
      message: "Expected " + (pattern.name || "particular constructor"),
      path: ""
    };
  }

  var unknownKeysAllowed = false;
  var unknownKeyPattern;
  if (pattern instanceof _ObjectIncluding) {
    unknownKeysAllowed = true;
    pattern = pattern.pattern;
  }
  if (pattern instanceof _ObjectWithValues) {
    unknownKeysAllowed = true;
    unknownKeyPattern = [pattern.pattern];
    pattern = {}; // no required keys
  }

  if ((typeof pattern === 'undefined' ? 'undefined' : _typeof(pattern)) !== "object") {
    return {
      message: "Bad pattern: unknown pattern type",
      path: ""
    };
  }

  // An object, with required and optional keys. Note that this does NOT do
  // structural matches against objects of special types that happen to match
  // the pattern: this really needs to be a plain old {Object}!
  if ((typeof value === 'undefined' ? 'undefined' : _typeof(value)) !== 'object') {
    return {
      message: "Expected object, got " + (typeof value === 'undefined' ? 'undefined' : _typeof(value)),
      path: ""
    };
  }
  if (value === null) {
    return {
      message: "Expected object, got null",
      path: ""
    };
  }
  if (!(0, _isPlainObject2.default)(value)) {
    return {
      message: "Expected plain object",
      path: ""
    };
  }

  var requiredPatterns = {};
  var optionalPatterns = {};
  _underscore2.default.each(pattern, function (subPattern, key) {
    if (subPattern instanceof _Optional || subPattern instanceof _Maybe) optionalPatterns[key] = subPattern.pattern;else requiredPatterns[key] = subPattern;
  });

  //XXX: replace with underscore's _.allKeys if Meteor updates underscore to 1.8+ (or lodash)
  var allKeys = function allKeys(obj) {
    var keys = [];
    if (_underscore2.default.isObject(obj)) {
      for (var key in obj) {
        keys.push(key);
      }
    }
    return keys;
  };

  for (var keys = allKeys(value), i = 0, length = keys.length; i < length; i++) {
    var key = keys[i];
    var subValue = value[key];
    if (_underscore2.default.has(requiredPatterns, key)) {
      var result = testSubtree(subValue, requiredPatterns[key]);
      if (result) {
        result.path = _prependPath(key, result.path);
        return result;
      }
      delete requiredPatterns[key];
    } else if (_underscore2.default.has(optionalPatterns, key)) {
      var result = testSubtree(subValue, optionalPatterns[key]);
      if (result) {
        result.path = _prependPath(key, result.path);
        return result;
      }
    } else {
      if (!unknownKeysAllowed) {
        return {
          message: "Unknown key",
          path: key
        };
      }
      if (unknownKeyPattern) {
        var result = testSubtree(subValue, unknownKeyPattern[0]);
        if (result) {
          result.path = _prependPath(key, result.path);
          return result;
        }
      }
    }
  }

  var keys = _underscore2.default.keys(requiredPatterns);
  if (keys.length) {
    return {
      message: "Missing key '" + keys[0] + "'",
      path: ""
    };
  }
};

var ArgumentChecker = function ArgumentChecker(args, description) {
  var self = this;
  // Make a SHALLOW copy of the arguments. (We'll be doing identity checks
  // against its contents.)
  self.args = _underscore2.default.clone(args);
  // Since the common case will be to check arguments in order, and we splice
  // out arguments when we check them, make it so we splice out from the end
  // rather than the beginning.
  self.args.reverse();
  self.description = description;
};

_underscore2.default.extend(ArgumentChecker.prototype, {
  checking: function checking(value) {
    var self = this;
    if (self._checkingOneValue(value)) return;
    // Allow check(arguments, [String]) or check(arguments.slice(1), [String])
    // or check([foo, bar], [String]) to count... but only if value wasn't
    // itself an argument.
    if (_underscore2.default.isArray(value) || _underscore2.default.isArguments(value)) {
      _underscore2.default.each(value, _underscore2.default.bind(self._checkingOneValue, self));
    }
  },
  _checkingOneValue: function _checkingOneValue(value) {
    var self = this;
    for (var i = 0; i < self.args.length; ++i) {
      // Is this value one of the arguments? (This can have a false positive if
      // the argument is an interned primitive, but it's still a good enough
      // check.)
      // (NaN is not === to itself, so we have to check specially.)
      if (value === self.args[i] || _underscore2.default.isNaN(value) && _underscore2.default.isNaN(self.args[i])) {
        self.args.splice(i, 1);
        return true;
      }
    }
    return false;
  },
  throwUnlessAllArgumentsHaveBeenChecked: function throwUnlessAllArgumentsHaveBeenChecked() {
    var self = this;
    if (!_underscore2.default.isEmpty(self.args)) throw new Error("Did not check() all arguments during " + self.description);
  }
});

var _jsKeywords = ["do", "if", "in", "for", "let", "new", "try", "var", "case", "else", "enum", "eval", "false", "null", "this", "true", "void", "with", "break", "catch", "class", "const", "super", "throw", "while", "yield", "delete", "export", "import", "public", "return", "static", "switch", "typeof", "default", "extends", "finally", "package", "private", "continue", "debugger", "function", "arguments", "interface", "protected", "implements", "instanceof"];

// Assumes the base of path is already escaped properly
// returns key + base
var _prependPath = function _prependPath(key, base) {
  if (typeof key === "number" || key.match(/^[0-9]+$/)) key = "[" + key + "]";else if (!key.match(/^[a-z_$][0-9a-z_$]*$/i) || _underscore2.default.contains(_jsKeywords, key)) key = JSON.stringify([key]);

  if (base && base[0] !== "[") return key + '.' + base;
  return key + base;
};