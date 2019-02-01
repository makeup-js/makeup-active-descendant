$_mod.installed("makeup-active-descendant$0.0.3", "makeup-navigation-emitter", "0.0.3");
$_mod.main("/makeup-navigation-emitter$0.0.3", "");
$_mod.installed("makeup-navigation-emitter$0.0.3", "custom-event-polyfill", "0.3.0");
$_mod.main("/custom-event-polyfill$0.3.0", "custom-event-polyfill");
$_mod.def("/custom-event-polyfill$0.3.0/custom-event-polyfill", function(require, exports, module, __filename, __dirname) { // Polyfill for creating CustomEvents on IE9/10/11

// code pulled from:
// https://github.com/d4tocchini/customevent-polyfill
// https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent#Polyfill

try {
    var ce = new window.CustomEvent('test');
    ce.preventDefault();
    if (ce.defaultPrevented !== true) {
        // IE has problems with .preventDefault() on custom events
        // http://stackoverflow.com/questions/23349191
        throw new Error('Could not prevent default');
    }
} catch(e) {
  var CustomEvent = function(event, params) {
    var evt, origPrevent;
    params = params || {
      bubbles: false,
      cancelable: false,
      detail: undefined
    };

    evt = document.createEvent("CustomEvent");
    evt.initCustomEvent(event, params.bubbles, params.cancelable, params.detail);
    origPrevent = evt.preventDefault;
    evt.preventDefault = function () {
      origPrevent.call(this);
      try {
        Object.defineProperty(this, 'defaultPrevented', {
          get: function () {
            return true;
          }
        });
      } catch(e) {
        this.defaultPrevented = true;
      }
    };
    return evt;
  };

  CustomEvent.prototype = window.Event.prototype;
  window.CustomEvent = CustomEvent; // expose definition to window
}

});
$_mod.def("/makeup-navigation-emitter$0.0.3/util", function(require, exports, module, __filename, __dirname) { "use strict";

function nodeListToArray(nodeList) {
    return Array.prototype.slice.call(nodeList);
}

module.exports = {
    nodeListToArray: nodeListToArray
};

});
$_mod.installed("makeup-navigation-emitter$0.0.3", "makeup-key-emitter", "0.0.2");
$_mod.main("/makeup-key-emitter$0.0.2", "");
$_mod.installed("makeup-key-emitter$0.0.2", "custom-event-polyfill", "0.3.0");
$_mod.def("/makeup-key-emitter$0.0.2/util", function(require, exports, module, __filename, __dirname) { 'use strict';

/*
    IE uses a different naming scheme for KeyboardEvent.key so we map the keyCode instead
    https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key
 */

var keyCodeToKeyMap = {
    '13': 'Enter',
    '27': 'Escape',
    '32': 'Spacebar',
    '33': 'PageUp',
    '34': 'PageDown',
    '35': 'End',
    '36': 'Home',
    '37': 'ArrowLeft',
    '38': 'ArrowUp',
    '39': 'ArrowRight',
    '40': 'ArrowDown'
};

function uncapitalizeFirstLetter(str) {
    return str.charAt(0).toLowerCase() + str.slice(1);
}

module.exports = {
    keyCodeToKeyMap: keyCodeToKeyMap,
    uncapitalizeFirstLetter: uncapitalizeFirstLetter
};

});
$_mod.def("/makeup-key-emitter$0.0.2/index", function(require, exports, module, __filename, __dirname) { 'use strict';

// requires CustomEvent polyfill for IE9+
// https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent/CustomEvent

var util = require('/makeup-key-emitter$0.0.2/util'/*'./util.js'*/);

function onKeyDownOrUp(evt, el, keyEventType) {
    if (!evt.shiftKey) {
        var key = util.keyCodeToKeyMap[evt.keyCode];

        switch (key) {
            case 'Enter':
            case 'Escape':
            case 'Spacebar':
            case 'PageUp':
            case 'PageDown':
            case 'End':
            case 'Home':
            case 'ArrowLeft':
            case 'ArrowUp':
            case 'ArrowRight':
            case 'ArrowDown':
                el.dispatchEvent(new CustomEvent(util.uncapitalizeFirstLetter(key + 'Key' + keyEventType), {
                    detail: evt,
                    bubbles: true
                }));
                break;
            default:
                return;
        }
    }
}

function onKeyDown(e) {
    onKeyDownOrUp(e, this, "Down");
}

function onKeyUp(e) {
    onKeyDownOrUp(e, this, "Up");
}

function addKeyDown(el) {
    el.addEventListener('keydown', onKeyDown);
}

function addKeyUp(el) {
    el.addEventListener('keyup', onKeyUp);
}

function removeKeyDown(el) {
    el.removeEventListener('keydown', onKeyDown);
}

function removeKeyUp(el) {
    el.removeEventListener('keyup', onKeyUp);
}

function add(el) {
    addKeyDown(el);
    addKeyUp(el);
}

function remove(el) {
    removeKeyDown(el);
    removeKeyUp(el);
}

module.exports = {
    addKeyDown: addKeyDown,
    addKeyUp: addKeyUp,
    removeKeyDown: removeKeyDown,
    removeKeyUp: removeKeyUp,
    add: add,
    remove: remove
};

});
$_mod.installed("makeup-navigation-emitter$0.0.3", "makeup-exit-emitter", "0.0.2");
$_mod.main("/makeup-exit-emitter$0.0.2", "");
$_mod.installed("makeup-exit-emitter$0.0.2", "custom-event-polyfill", "0.3.0");
$_mod.def("/makeup-exit-emitter$0.0.2/index", function(require, exports, module, __filename, __dirname) { 'use strict';

// requires CustomEvent polyfill for IE9+
// https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent/CustomEvent

function onFocusOrMouseOut(evt, el, type) {
    if (el.contains(evt.relatedTarget) === false) {
        el.dispatchEvent(new CustomEvent(type + 'Exit', {
            detail: {
                toElement: evt.relatedTarget,
                fromElement: evt.target
            },
            bubbles: false // mirror the native mouseleave event
        }));
    }
}

function onFocusOut(e) {
    onFocusOrMouseOut(e, this, 'focus');
}

function onMouseOut(e) {
    onFocusOrMouseOut(e, this, 'mouse');
}

function addFocusExit(el) {
    el.addEventListener('focusout', onFocusOut);
}

function removeFocusExit(el) {
    el.removeEventListener('focusout', onFocusOut);
}

function addMouseExit(el) {
    el.addEventListener('mouseout', onMouseOut);
}

function removeMouseExit(el) {
    el.removeEventListener('mouseout', onMouseOut);
}

function add(el) {
    addFocusExit(el);
    addMouseExit(el);
}

function remove(el) {
    removeFocusExit(el);
    removeMouseExit(el);
}

module.exports = {
    addFocusExit: addFocusExit,
    addMouseExit: addMouseExit,
    removeFocusExit: removeFocusExit,
    removeMouseExit: removeMouseExit,
    add: add,
    remove: remove
};

});
$_mod.def("/makeup-navigation-emitter$0.0.3/index", function(require, exports, module, __filename, __dirname) { 'use strict';

// requires Object.assign polyfill or transform for IE
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign#Polyfill

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Util = require('/makeup-navigation-emitter$0.0.3/util'/*'./util.js'*/);
var KeyEmitter = require('/makeup-key-emitter$0.0.2/index'/*'makeup-key-emitter'*/);
var ExitEmitter = require('/makeup-exit-emitter$0.0.2/index'/*'makeup-exit-emitter'*/);
var dataSetKey = 'data-makeup-index';

var defaultOptions = {
    autoInit: 0,
    autoReset: null,
    wrap: false
};

function setData(els) {
    els.forEach(function (el, index) {
        el.setAttribute(dataSetKey, index);
    });
}

function onKeyPrev() {
    if (!this.atStart()) {
        this.index--;
    } else if (this.options.wrap) {
        this.index = this.items.length - 1;
    }
}

function onKeyNext() {
    if (!this.atEnd()) {
        this.index++;
    } else if (this.options.wrap) {
        this.index = 0;
    }
}

function onClick(e) {
    var indexData = e.target.dataset.makeupIndex;
    if (indexData !== undefined) {
        this.index = indexData;
    }
}

function onKeyHome() {
    this.index = 0;
}

function onKeyEnd() {
    this.index = this.items.length;
}

function onFocusExit() {
    if (this.options.autoReset !== null) {
        this.index = this.options.autoReset;
    }
}

function onMutation() {
    this.items = Util.nodeListToArray(this._el.querySelectorAll(this._itemSelector));
    setData(this.items);

    this._el.dispatchEvent(new CustomEvent('navigationModelMutation'));
}

var NavigationModel = function NavigationModel(el, itemSelector, selectedOptions) {
    _classCallCheck(this, NavigationModel);

    this.options = _extends({}, defaultOptions, selectedOptions);
    this._el = el;
    this._itemSelector = itemSelector;
    this.items = Util.nodeListToArray(el.querySelectorAll(itemSelector));
};

var LinearNavigationModel = function (_NavigationModel) {
    _inherits(LinearNavigationModel, _NavigationModel);

    function LinearNavigationModel(el, itemSelector, selectedOptions) {
        _classCallCheck(this, LinearNavigationModel);

        var _this = _possibleConstructorReturn(this, (LinearNavigationModel.__proto__ || Object.getPrototypeOf(LinearNavigationModel)).call(this, el, itemSelector, selectedOptions));

        if (_this.options.autoInit !== null) {
            _this._index = _this.options.autoInit;
            _this._el.dispatchEvent(new CustomEvent('navigationModelInit', {
                detail: {
                    toIndex: _this.options.autoInit
                },
                bubbles: false
            }));
        }
        return _this;
    }

    _createClass(LinearNavigationModel, [{
        key: 'atEnd',
        value: function atEnd() {
            return this.index === this.items.length - 1;
        }
    }, {
        key: 'atStart',
        value: function atStart() {
            return this.index <= 0;
        }
    }, {
        key: 'index',
        get: function get() {
            return this._index;
        },
        set: function set(newIndex) {
            if (newIndex !== this.index) {
                this._el.dispatchEvent(new CustomEvent('navigationModelChange', {
                    detail: {
                        toIndex: newIndex,
                        fromIndex: this.index
                    },
                    bubbles: false
                }));
                this._index = newIndex;
            }
        }
    }]);

    return LinearNavigationModel;
}(NavigationModel);

// 2D Grid Model will go here

/*
class GridModel extends NavigationModel {
    constructor(el, rowSelector, colSelector) {
        super();
        this._coords = null;
    }
}
*/

var NavigationEmitter = function () {
    function NavigationEmitter(el, model) {
        _classCallCheck(this, NavigationEmitter);

        this.model = model;

        this._keyPrevListener = onKeyPrev.bind(model);
        this._keyNextListener = onKeyNext.bind(model);
        this._keyHomeListener = onKeyHome.bind(model);
        this._keyEndListener = onKeyEnd.bind(model);
        this._clickListener = onClick.bind(model);
        this._focusExitListener = onFocusExit.bind(model);
        this._observer = new MutationObserver(onMutation.bind(model));

        setData(model.items);

        KeyEmitter.addKeyDown(el);
        ExitEmitter.addFocusExit(el);

        el.addEventListener('arrowLeftKeyDown', this._keyPrevListener);
        el.addEventListener('arrowRightKeyDown', this._keyNextListener);
        el.addEventListener('arrowUpKeyDown', this._keyPrevListener);
        el.addEventListener('arrowDownKeyDown', this._keyNextListener);
        el.addEventListener('homeKeyDown', this._keyHomeListener);
        el.addEventListener('endKeyDown', this._keyEndListener);
        el.addEventListener('click', this._clickListener);
        el.addEventListener('focusExit', this._focusExitListener);

        this._observer.observe(el, { childList: true, subtree: true });
    }

    _createClass(NavigationEmitter, null, [{
        key: 'createLinear',
        value: function createLinear(el, itemSelector, selectedOptions) {
            var model = new LinearNavigationModel(el, itemSelector, selectedOptions);

            return new NavigationEmitter(el, model);
        }

        /*
        static createGrid(el, rowSelector, colSelector, selectedOptions) {
            return null;
        }
        */

    }]);

    return NavigationEmitter;
}();

module.exports = NavigationEmitter;

});
$_mod.installed("makeup-active-descendant$0.0.3", "makeup-next-id", "0.0.1");
$_mod.main("/makeup-next-id$0.0.1", "");
$_mod.def("/makeup-next-id$0.0.1/index", function(require, exports, module, __filename, __dirname) { 'use strict';

var sequenceMap = {};
var defaultPrefix = 'nid';

module.exports = function (el) {
    var prefix = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : defaultPrefix;

    // prevent empty string
    var _prefix = prefix === '' ? defaultPrefix : prefix;

    // initialise prefix in sequence map if necessary
    sequenceMap[_prefix] = sequenceMap[_prefix] || 0;

    if (!el.id) {
        el.setAttribute('id', _prefix + '-' + sequenceMap[_prefix]++);
    }
};

});
$_mod.def("/makeup-active-descendant$0.0.3/util", function(require, exports, module, __filename, __dirname) { "use strict";

function nodeListToArray(nodeList) {
    return Array.prototype.slice.call(nodeList);
}

module.exports = {
    nodeListToArray: nodeListToArray
};

});
$_mod.def("/makeup-active-descendant$0.0.3/index", function(require, exports, module, __filename, __dirname) { 'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var NavigationEmitter = require('/makeup-navigation-emitter$0.0.3/index'/*'makeup-navigation-emitter'*/);
var nextID = require('/makeup-next-id$0.0.1/index'/*'makeup-next-id'*/);
var Util = require('/makeup-active-descendant$0.0.3/util'/*'./util.js'*/);

var defaultOptions = {
    activeDescendantClassName: 'active-descendant'
};

function onModelMutation() {
    var modelIndex = this._navigationEmitter.model.index;

    this._items = Util.nodeListToArray(this._el.querySelectorAll(this._itemSelector));

    this._items.forEach(function (item, index) {
        if (index !== modelIndex) {
            item.classList.remove(this._options.activeDescendantClassName);
        } else {
            item.classList.add(this._options.activeDescendantClassName);
        }
    });
}

function onModelChange(e) {
    var fromItem = this._items[e.detail.fromIndex];
    var toItem = this._items[e.detail.toIndex];

    if (fromItem) {
        fromItem.classList.remove(this._options.activeDescendantClassName);
    }

    if (toItem) {
        toItem.classList.add(this._options.activeDescendantClassName);
        this._focusEl.setAttribute('aria-activedescendant', toItem.id);
    }

    this._el.dispatchEvent(new CustomEvent('activeDescendantChange', {
        detail: {
            toIndex: e.detail.toIndex,
            fromIndex: e.detail.fromIndex
        }
    }));
}

var ActiveDescendant = function ActiveDescendant(el) {
    _classCallCheck(this, ActiveDescendant);

    this._el = el;
    this._onMutationListener = onModelMutation.bind(this);
    this._onChangeListener = onModelChange.bind(this);

    el.addEventListener('navigationModelMutation', this._onMutationListener);
    el.addEventListener('navigationModelChange', this._onChangeListener);
};

var LinearActiveDescendant = function (_ActiveDescendant) {
    _inherits(LinearActiveDescendant, _ActiveDescendant);

    function LinearActiveDescendant(el, focusEl, ownedEl, itemSelector, selectedOptions) {
        _classCallCheck(this, LinearActiveDescendant);

        var _this = _possibleConstructorReturn(this, (LinearActiveDescendant.__proto__ || Object.getPrototypeOf(LinearActiveDescendant)).call(this, el));

        _this._options = _extends({}, defaultOptions, selectedOptions);

        _this._navigationEmitter = NavigationEmitter.createLinear(el, itemSelector, { autoInit: -1, autoReset: -1 });

        _this._focusEl = focusEl;
        _this._ownedEl = ownedEl;
        _this._itemSelector = itemSelector;

        // ensure container has an id
        nextID(ownedEl);

        // focus element must programatically 'own' the container of descendant items
        focusEl.setAttribute('aria-owns', ownedEl.id);

        // cache the array of items that will be navigated
        _this._items = Util.nodeListToArray(ownedEl.querySelectorAll(itemSelector));

        // ensure each item has an id
        _this._items.forEach(function (itemEl) {
            nextID(itemEl);
        });
        return _this;
    }

    _createClass(LinearActiveDescendant, [{
        key: 'wrap',
        set: function set(newWrap) {
            this._navigationEmitter.model.options.wrap = newWrap;
        }
    }]);

    return LinearActiveDescendant;
}(ActiveDescendant);

/*
class GridActiveDescendant extends ActiveDescendant {
    constructor(el, focusEl, ownedEl, rowSelector, cellSelector) {
        super(el);
    }
}
*/

function createLinear(el, focusEl, ownedEl, itemSelector, selectedOptions) {
    return new LinearActiveDescendant(el, focusEl, ownedEl, itemSelector, selectedOptions);
}

module.exports = {
    createLinear: createLinear
};

});