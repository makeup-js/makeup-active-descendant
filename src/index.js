'use strict';

const NavigationEmitter = require('makeup-navigation-emitter');
const nextID = require('makeup-next-id');
const Util = require('./util.js');

function onModelMutation() {
    this._items = Util.nodeListToArray(this._el.querySelectorAll(this._itemSelector));
    this.updateView();
}

function onModelChange(e) {
    const fromItem = this.items[e.detail.fromIndex];
    const toItem = this.items[e.detail.toIndex];

    if (fromItem) {
        fromItem.classList.remove('active-descendant');
    }
    toItem.classList.add('active-descendant');

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

class ActiveDescendant {
    constructor(el) {
        this._el = el;
        this.onMutationListener = onModelMutation.bind(this);
        this.onChangeListener = onModelChange.bind(this);

        el.addEventListener('navigationModelMutation', this.onMutationListener);
        el.addEventListener('navigationModelChange', this.onChangeListener);
    }
}

class LinearActiveDescendant extends ActiveDescendant {
    constructor(el, focusEl, ownedEl, itemSelector) {
        super(el);

        this._navigationEmitter = NavigationEmitter.createLinear(el, itemSelector);

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
        this.items.forEach(function(itemEl) {
            nextID(itemEl);
        });
    }

    updateView() {
        this.items.forEach(onUpdateEachItem.bind(this));
    }

    get items() {
        return this._items;
    }

    set index(newIndex) {
        this._navigationEmitter.model.index = newIndex;
        this.updateView();
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

function createLinear(el, focusEl, ownedEl, itemSelector) {
    return new LinearActiveDescendant(el, focusEl, ownedEl, itemSelector);
}

module.exports = {
    createLinear
};
