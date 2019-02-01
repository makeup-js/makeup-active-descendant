'use strict';

const NavigationEmitter = require('makeup-navigation-emitter');
const nextID = require('makeup-next-id');
const Util = require('./util.js');

const defaultOptions = {
    activeDescendantClassName: 'active-descendant'
};

function onModelMutation() {
    const modelIndex = this._navigationEmitter.model.index;

    this._items = Util.nodeListToArray(this._el.querySelectorAll(this._itemSelector));

    this._items.forEach(function(item, index) {
        if (index !== modelIndex) {
            item.classList.remove(this._options.activeDescendantClassName);
        } else {
            item.classList.add(this._options.activeDescendantClassName);
        }
    });
}

function onModelChange(e) {
    const fromItem = this._items[e.detail.fromIndex];
    const toItem = this._items[e.detail.toIndex];

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

class ActiveDescendant {
    constructor(el) {
        this._el = el;
        this._onMutationListener = onModelMutation.bind(this);
        this._onChangeListener = onModelChange.bind(this);

        el.addEventListener('navigationModelMutation', this._onMutationListener);
        el.addEventListener('navigationModelChange', this._onChangeListener);
    }
}

class LinearActiveDescendant extends ActiveDescendant {
    constructor(el, focusEl, ownedEl, itemSelector, selectedOptions) {
        super(el);

        this._options = Object.assign({}, defaultOptions, selectedOptions);

        this._navigationEmitter = NavigationEmitter.createLinear(el, itemSelector, { autoInit: -1, autoReset: -1 });

        this._focusEl = focusEl;
        this._ownedEl = ownedEl;
        this._itemSelector = itemSelector;

        // ensure container has an id
        nextID(ownedEl);

        // focus element must programatically 'own' the container of descendant items
        focusEl.setAttribute('aria-owns', ownedEl.id);

        // cache the array of items that will be navigated
        this._items = Util.nodeListToArray(ownedEl.querySelectorAll(itemSelector));

        // ensure each item has an id
        this._items.forEach(function(itemEl) {
            nextID(itemEl);
        });
    }

    set wrap(newWrap) {
        this._navigationEmitter.model.options.wrap = newWrap;
    }
}

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
    createLinear
};
