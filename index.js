'use strict';

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

var NavigationEmitter = require('makeup-navigation-emitter');

var nextID = require('makeup-next-id');

var defaultOptions = {
  activeDescendantClassName: 'active-descendant',
  autoInit: -1,
  autoReset: -1
};

function onModelMutation() {
  var options = this._options;
  var modelIndex = this._navigationEmitter.model.index;

  this._items.forEach(function (item, index) {
    if (index !== modelIndex) {
      item.classList.remove(options.activeDescendantClassName);
    } else {
      item.classList.add(options.activeDescendantClassName);
    }
  });
}

function onModelChange(e) {
  var fromItem = this._items[e.detail.fromIndex];
  var toItem = this._items[e.detail.toIndex];

  if (fromItem) {
    fromItem.classList.remove(this._options.activeDescendantClassName);
    fromItem.removeAttribute('aria-selected');
  }

  if (toItem) {
    toItem.classList.add(this._options.activeDescendantClassName);
    toItem.setAttribute('aria-selected', 'true');

    this._focusEl.setAttribute('aria-activedescendant', toItem.id);
  }

  this._el.dispatchEvent(new CustomEvent('activeDescendantChange', {
    detail: {
      fromIndex: e.detail.fromIndex,
      toIndex: e.detail.toIndex
    }
  }));
}

function onModelReset() {
  var activeClassName = this._options.activeDescendantClassName;

  this._items.forEach(function (el) {
    el.classList.remove(activeClassName);
    el.removeAttribute('aria-selected');
  });

  if (this._options.autoReset > -1) {
    var itemEl = this._items[this._options.autoReset];
    itemEl.classList.add(this._options.activeDescendantClassName);
    itemEl.setAttribute('aria-selected', 'true');

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

  function LinearActiveDescendant(el, focusEl, ownedEl, itemSelector, selectedOptions) {
    var _this;

    _classCallCheck(this, LinearActiveDescendant);

    _this = _possibleConstructorReturn(this, _getPrototypeOf(LinearActiveDescendant).call(this, el));
    _this._options = _extends({}, defaultOptions, selectedOptions);
    _this._navigationEmitter = NavigationEmitter.createLinear(el, itemSelector, {
      autoInit: _this._options.autoInit,
      autoReset: _this._options.autoReset
    });
    _this._focusEl = focusEl;
    _this._ownedEl = ownedEl;
    _this._itemSelector = itemSelector; // ensure container has an id

    nextID(ownedEl); // focus element must programatically 'own' the container of descendant items

    focusEl.setAttribute('aria-owns', ownedEl.id); // ensure each item has an id

    _this._items.forEach(function (itemEl) {
      nextID(itemEl);
    });

    if (_this._options.autoInit > -1) {
      var itemEl = _this._items[_this._options.autoInit];
      itemEl.classList.add(_this._options.activeDescendantClassName);
      itemEl.setAttribute('aria-selected', 'true');

      _this._focusEl.setAttribute('aria-activedescendant', itemEl.id);
    }

    return _this;
  }

  _createClass(LinearActiveDescendant, [{
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
    key: "_items",
    get: function get() {
      return this._ownedEl.querySelectorAll(this._itemSelector);
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
