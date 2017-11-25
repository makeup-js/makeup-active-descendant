'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var NavigationEmitter = require('makeup-navigation-emitter');
var nextID = require('makeup-next-id');
var Util = require('./util.js');

function onModelMutation() {
    this._items = Util.nodeListToArray(this._el.querySelectorAll(this._itemSelector));
    this.updateView();
}

function onModelChange(e) {
    var fromItem = this.items[e.detail.fromIndex];
    var toItem = this.items[e.detail.toIndex];

    if (fromItem) {
        fromItem.classList.remove('active-descendant');
    }

    if (toItem) {
        toItem.classList.add('active-descendant');
        this._focusEl.setAttribute('aria-activedescendant', toItem.id);
    }

    this._el.dispatchEvent(new CustomEvent('activeDescendantChange', {
        detail: {
            toIndex: e.detail.toIndex,
            fromIndex: e.detail.fromIndex
        }
    }));
}

function onUpdateEachItem(item, index) {
    if (index !== this._navigationEmitter.model.index) {
        item.classList.remove('active-descendant');
    } else {
        item.classList.add('active-descendant');
    }
}

var ActiveDescendant = function ActiveDescendant(el) {
    _classCallCheck(this, ActiveDescendant);

    this._el = el;
    this.onMutationListener = onModelMutation.bind(this);
    this.onChangeListener = onModelChange.bind(this);

    el.addEventListener('navigationModelMutation', this.onMutationListener);
    el.addEventListener('navigationModelChange', this.onChangeListener);
};

var LinearActiveDescendant = function (_ActiveDescendant) {
    _inherits(LinearActiveDescendant, _ActiveDescendant);

    function LinearActiveDescendant(el, focusEl, ownedEl, itemSelector) {
        _classCallCheck(this, LinearActiveDescendant);

        var _this = _possibleConstructorReturn(this, (LinearActiveDescendant.__proto__ || Object.getPrototypeOf(LinearActiveDescendant)).call(this, el));

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
        _this.items.forEach(function (itemEl) {
            nextID(itemEl);
        });
        return _this;
    }

    _createClass(LinearActiveDescendant, [{
        key: 'updateView',
        value: function updateView() {
            this.items.forEach(onUpdateEachItem.bind(this));
        }
    }, {
        key: 'items',
        get: function get() {
            return this._items;
        }
    }, {
        key: 'index',
        set: function set(newIndex) {
            this._navigationEmitter.model.index = newIndex;
            this.updateView();
        }
    }, {
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

function createLinear(el, focusEl, ownedEl, itemSelector) {
    return new LinearActiveDescendant(el, focusEl, ownedEl, itemSelector);
}

module.exports = {
    createLinear: createLinear
};
