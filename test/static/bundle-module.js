$_mod.installed("makeup-active-descendant$0.3.0", "custom-event-polyfill", "1.0.7");
$_mod.installed("makeup-active-descendant$0.3.0", "nodelist-foreach-polyfill", "1.2.0");
$_mod.main("/nodelist-foreach-polyfill$1.2.0", "");
$_mod.def("/nodelist-foreach-polyfill$1.2.0/index", function(require, exports, module, __filename, __dirname) { if (window.NodeList && !NodeList.prototype.forEach) {
    NodeList.prototype.forEach = function (callback, thisArg) {
        thisArg = thisArg || window;
        for (var i = 0; i < this.length; i++) {
            callback.call(thisArg, this[i], i, this);
        }
    };
}

});
$_mod.installed("makeup-active-descendant$0.3.0", "makeup-navigation-emitter", "0.3.0");
$_mod.installed("makeup-navigation-emitter$0.3.0", "custom-event-polyfill", "1.0.7");
$_mod.installed("makeup-navigation-emitter$0.3.0", "nodelist-foreach-polyfill", "1.2.0");
$_mod.installed("makeup-key-emitter$0.1.0", "custom-event-polyfill", "1.0.7");
$_mod.installed("makeup-exit-emitter$0.2.0", "custom-event-polyfill", "1.0.7");
$_mod.main("/nanoid$2.1.1", "");
$_mod.remap("/nanoid$2.1.1/index", "/nanoid$2.1.1/index.browser");
$_mod.builtin("process", "/process$0.11.10/browser");
$_mod.def("/process$0.11.10/browser", function(require, exports, module, __filename, __dirname) { // shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

});
$_mod.def("/nanoid$2.1.1/index.browser", function(require, exports, module, __filename, __dirname) { var process=require("process"); if (process.env.NODE_ENV !== 'production') {
  if (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') {
    throw new Error(
      'React Native does not have a built-in secure random generator. ' +
      'If you don’t need unpredictable IDs, you can use `nanoid/non-secure`. ' +
      'For secure ID install `expo-random` locally and use `nanoid/async`.'
    )
  }
  if (typeof self === 'undefined' || (!self.crypto && !self.msCrypto)) {
    throw new Error(
      'Your browser does not have secure random generator. ' +
      'If you don’t need unpredictable IDs, you can use nanoid/non-secure.'
    )
  }
}

var crypto = self.crypto || self.msCrypto

/*
 * This alphabet uses a-z A-Z 0-9 _- symbols.
 * Symbols order was changed for better gzip compression.
 */
var url = 'Uint8ArdomValuesObj012345679BCDEFGHIJKLMNPQRSTWXYZ_cfghkpqvwxyz-'

module.exports = function (size) {
  size = size || 21
  var id = ''
  var bytes = crypto.getRandomValues(new Uint8Array(size))
  while (0 < size--) {
    id += url[bytes[size] & 63]
  }
  return id
}

});
$_mod.installed("makeup-active-descendant$0.3.0", "makeup-next-id", "0.1.1");
$_mod.def("/makeup-active-descendant$0.3.0/index", function(require, exports, module, __filename, __dirname) { 'use strict';

function _typeof(obj) { if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

function _possibleConstructorReturn(self, call) { if (call && (_typeof(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized(self); }

function _assertThisInitialized(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

function _get(target, property, receiver) { if (typeof Reflect !== "undefined" && Reflect.get) { _get = Reflect.get; } else { _get = function _get(target, property, receiver) { var base = _superPropBase(target, property); if (!base) return; var desc = Object.getOwnPropertyDescriptor(base, property); if (desc.get) { return desc.get.call(receiver); } return desc.value; }; } return _get(target, property, receiver || target); }

function _superPropBase(object, property) { while (!Object.prototype.hasOwnProperty.call(object, property)) { object = _getPrototypeOf(object); if (object === null) break; } return object; }

function _getPrototypeOf(o) { _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf(o); }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf(subClass, superClass); }

function _setPrototypeOf(o, p) { _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf(o, p); }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

var NavigationEmitter = require('/makeup-navigation-emitter$0.3.0/index'/*'makeup-navigation-emitter'*/);

var nextID = require('/makeup-next-id$0.1.1/index'/*'makeup-next-id'*/);

var defaultOptions = {
  activeDescendantClassName: 'active-descendant',
  autoInit: -1,
  autoReset: -1,
  autoScroll: false,
  axis: 'both'
};

function onModelMutation() {
  var options = this._options;
  var modelIndex = this._navigationEmitter.model.index;
  this.filteredItems.forEach(function (item, index) {
    nextID(item);

    if (index !== modelIndex) {
      item.classList.remove(options.activeDescendantClassName);
    } else {
      item.classList.add(options.activeDescendantClassName);
    }
  });
}

function onModelChange(e) {
  var fromItem = this.filteredItems[e.detail.fromIndex];
  var toItem = this.filteredItems[e.detail.toIndex];

  if (fromItem) {
    fromItem.classList.remove(this._options.activeDescendantClassName);
  }

  if (toItem) {
    toItem.classList.add(this._options.activeDescendantClassName);

    this._focusEl.setAttribute('aria-activedescendant', toItem.id);

    if (this._config.autoScroll && this._containerEl) {
      this._containerEl.scrollTop = toItem.offsetTop - this._containerEl.offsetHeight / 2;
    }
  }

  this._el.dispatchEvent(new CustomEvent('activeDescendantChange', {
    detail: {
      fromIndex: e.detail.fromIndex,
      toIndex: e.detail.toIndex
    }
  }));
}

function onModelReset(e) {
  var toIndex = e.detail.toIndex;
  var activeClassName = this._options.activeDescendantClassName;
  this.filteredItems.forEach(function (el) {
    el.classList.remove(activeClassName);
  });

  if (toIndex > -1) {
    var itemEl = this.filteredItems[toIndex];
    itemEl.classList.add(activeClassName);

    this._focusEl.setAttribute('aria-activedescendant', itemEl.id);
  } else {
    this._focusEl.removeAttribute('aria-activedescendant');
  }
}

var ActiveDescendant =
/*#__PURE__*/
function () {
  function ActiveDescendant(el) {
    _classCallCheck(this, ActiveDescendant);

    this._el = el;
    this._onMutationListener = onModelMutation.bind(this);
    this._onChangeListener = onModelChange.bind(this);
    this._onResetListener = onModelReset.bind(this);

    this._el.addEventListener('navigationModelMutation', this._onMutationListener);

    this._el.addEventListener('navigationModelChange', this._onChangeListener);

    this._el.addEventListener('navigationModelReset', this._onResetListener);
  }

  _createClass(ActiveDescendant, [{
    key: "destroy",
    value: function destroy() {
      this._el.removeEventListener('navigationModelMutation', this._onMutationListener);

      this._el.removeEventListener('navigationModelChange', this._onChangeListener);

      this._el.removeEventListener('navigationModelReset', this._onResetListener);
    }
  }]);

  return ActiveDescendant;
}();

var LinearActiveDescendant =
/*#__PURE__*/
function (_ActiveDescendant) {
  _inherits(LinearActiveDescendant, _ActiveDescendant);

  function LinearActiveDescendant(el, focusEl, containerEl, itemSelector, selectedOptions) {
    var _this;

    _classCallCheck(this, LinearActiveDescendant);

    _this = _possibleConstructorReturn(this, _getPrototypeOf(LinearActiveDescendant).call(this, el));
    _this._options = _extends({}, defaultOptions, selectedOptions);
    _this._navigationEmitter = NavigationEmitter.createLinear(el, itemSelector, {
      autoInit: _this._options.autoInit,
      autoReset: _this._options.autoReset,
      axis: _this._options.axis
    });
    _this._focusEl = focusEl;
    _this._containerEl = containerEl;
    _this._itemSelector = itemSelector; // ensure container has an id

    nextID(containerEl); // if DOM hierarchy cannot be determined,
    // focus element must programatically 'own' the container of descendant items

    if (containerEl !== focusEl) {
      focusEl.setAttribute('aria-owns', containerEl.id);
    } // ensure each item has an id


    _this.items.forEach(function (itemEl) {
      nextID(itemEl);
    });

    if (_this._options.autoInit > -1) {
      var itemEl = _this.filteredItems[_this._options.autoInit];
      itemEl.classList.add(_this._options.activeDescendantClassName);

      _this._focusEl.setAttribute('aria-activedescendant', itemEl.id);
    }

    return _this;
  }

  _createClass(LinearActiveDescendant, [{
    key: "reset",
    value: function reset() {
      this._navigationEmitter.model.reset();
    }
  }, {
    key: "destroy",
    value: function destroy() {
      _get(_getPrototypeOf(LinearActiveDescendant.prototype), "destroy", this).call(this);

      this._navigationEmitter.destroy();
    }
  }, {
    key: "index",
    get: function get() {
      return this._navigationEmitter.model.index;
    },
    set: function set(newIndex) {
      this._navigationEmitter.model.index = newIndex;
    }
  }, {
    key: "filteredItems",
    get: function get() {
      return this._navigationEmitter.model.filteredItems;
    }
  }, {
    key: "items",
    get: function get() {
      return this._navigationEmitter.model.items;
    } // backwards compat

  }, {
    key: "_items",
    get: function get() {
      return this.items;
    }
  }, {
    key: "wrap",
    set: function set(newWrap) {
      this._navigationEmitter.model.options.wrap = newWrap;
    }
  }]);

  return LinearActiveDescendant;
}(ActiveDescendant);
/*
class GridActiveDescendant extends ActiveDescendant {
    constructor(el, focusEl, containerEl, rowSelector, cellSelector) {
        super(el);
    }
}
*/


function createLinear(el, focusEl, containerEl, itemSelector, selectedOptions) {
  return new LinearActiveDescendant(el, focusEl, containerEl, itemSelector, selectedOptions);
}

module.exports = {
  createLinear: createLinear
};

});