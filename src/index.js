'use strict';

const NavigationEmitter = require('makeup-navigation-emitter');
const nextID = require('makeup-next-id');
const Util = require('./util.js');

const defaultOptions = {
    activeDescendantClassName: 'active-descendant',
    autoInit: -1,
    autoReset: -1
};

function onModelMutation() {
    const options = this._options;
    const modelIndex = this._navigationEmitter.model.index;

    this._items = Util.nodeListToArray(this._el.querySelectorAll(this._itemSelector));

    this._items.forEach(function(item, index) {
        if (index !== modelIndex) {
            item.classList.remove(options.activeDescendantClassName);
        } else {
            item.classList.add(options.activeDescendantClassName);
        }
    });
}

function onModelChange(e) {
    const fromItem = this._items[e.detail.fromIndex];
    const toItem = this._items[e.detail.toIndex];

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
    const activeClassName = this._options.activeDescendantClassName;

    this._items.forEach(function(el) {
        el.classList.remove(activeClassName);
        el.removeAttribute('aria-selected');
    });

    if (this._options.autoReset > -1) {
        const itemEl = this._items[this._options.autoReset];

        itemEl.classList.add(this._options.activeDescendantClassName);
        itemEl.setAttribute('aria-selected', 'true');
        this._focusEl.setAttribute('aria-activedescendant', itemEl.id);
    } else {
        this._focusEl.removeAttribute('aria-activedescendant');
    }
}

class ActiveDescendant {
    constructor(el) {
        this._el = el;
        this._onMutationListener = onModelMutation.bind(this);
        this._onChangeListener = onModelChange.bind(this);
        this._onResetListener = onModelReset.bind(this);

        this._el.addEventListener('navigationModelMutation', this._onMutationListener);
        this._el.addEventListener('navigationModelChange', this._onChangeListener);
        this._el.addEventListener('navigationModelReset', this._onResetListener);
    }

    destroy() {
        this._el.removeEventListener('navigationModelMutation', this._onMutationListener);
        this._el.removeEventListener('navigationModelChange', this._onChangeListener);
        this._el.removeEventListener('navigationModelReset', this._onResetListener);
    }
}

class LinearActiveDescendant extends ActiveDescendant {
    constructor(el, focusEl, ownedEl, itemSelector, selectedOptions) {
        super(el);

        this._options = Object.assign({}, defaultOptions, selectedOptions);

        this._navigationEmitter = NavigationEmitter.createLinear(el, itemSelector, {
            autoInit: this._options.autoInit,
            autoReset: this._options.autoReset
        });

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

        if (this._options.autoInit > -1) {
            const itemEl = this._items[this._options.autoInit];

            itemEl.classList.add(this._options.activeDescendantClassName);
            itemEl.setAttribute('aria-selected', 'true');
            this._focusEl.setAttribute('aria-activedescendant', itemEl.id);
        }
    }

    set _items(items) {
        return items;
    }

    get _items() {
        return this._items.forEach(function(itemEl) {
            if (!document.body.contains(itemEl)) console.warn("The owned element was removed!");
            return itemEl;
        });
    }

    set _ownedEl(el) {
        return el;
    }

    get _ownedEl() {
        if (!document.body.contains(this._ownedEl)) console.warn("The owned element was removed!");
        return this._ownedEl;
    }

    set wrap(newWrap) {
        this._navigationEmitter.model.options.wrap = newWrap;
    }

    destroy() {
        super.destroy();
        this._navigationEmitter.destroy();
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
