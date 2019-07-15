'use strict';

const NavigationEmitter = require('makeup-navigation-emitter');
const nextID = require('makeup-next-id');

const defaultOptions = {
    activeDescendantClassName: 'active-descendant',
    autoInit: -1,
    autoReset: -1,
    axis: 'both',
    useAriaSelected: false
};

function onModelMutation() {
    const options = this._options;
    const modelIndex = this._navigationEmitter.model.index;

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
        if (this._options.useAriaSelected === true) {
            fromItem.removeAttribute('aria-selected');
        }
    }

    if (toItem) {
        toItem.classList.add(this._options.activeDescendantClassName);
        if (this._options.useAriaSelected === true) {
            toItem.setAttribute('aria-selected', 'true');
        }
        this._focusEl.setAttribute('aria-activedescendant', toItem.id);
    }

    this._el.dispatchEvent(new CustomEvent('activeDescendantChange', {
        detail: {
            fromIndex: e.detail.fromIndex,
            toIndex: e.detail.toIndex
        }
    }));
}

function onModelReset(e) {
    const toIndex = e.detail.toIndex;
    const activeClassName = this._options.activeDescendantClassName;
    const widget = this;

    this._items.forEach(function(el) {
        el.classList.remove(activeClassName);
        // deprecated. aria-activedescendant is now well supported without needing aria-selected
        if (widget._options.useAriaSelected === true) {
            el.removeAttribute('aria-selected');
        }
    });

    if (toIndex > -1) {
        const itemEl = this._items[toIndex];

        itemEl.classList.add(activeClassName);
        // deprecated. aria-activedescendant is now well supported without needing aria-selected
        if (this._options.useAriaSelected === true) {
            itemEl.setAttribute('aria-selected', 'true');
        }
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
    constructor(el, focusEl, containerEl, itemSelector, selectedOptions) {
        super(el);

        this._options = Object.assign({}, defaultOptions, selectedOptions);

        this._navigationEmitter = NavigationEmitter.createLinear(el, itemSelector, {
            autoInit: this._options.autoInit,
            autoReset: this._options.autoReset,
            axis: this._options.axis
        });

        this._focusEl = focusEl;
        this._containerEl = containerEl;
        this._itemSelector = itemSelector;

        // ensure container has an id
        nextID(containerEl);

        // if DOM hierarchy cannot be determined,
        // focus element must programatically 'own' the container of descendant items
        if (containerEl !== focusEl) {
            focusEl.setAttribute('aria-owns', containerEl.id);
        }

        // ensure each item has an id
        this._items.forEach(function(itemEl) {
            nextID(itemEl);
        });

        if (this._options.autoInit > -1) {
            const itemEl = this._items[this._options.autoInit];

            itemEl.classList.add(this._options.activeDescendantClassName);
            if (this._options.useAriaSelected === true) {
                itemEl.setAttribute('aria-selected', 'true');
            }
            this._focusEl.setAttribute('aria-activedescendant', itemEl.id);
        }
    }

    get index() {
        return this._navigationEmitter.model.index;
    }

    set index(newIndex) {
        this._navigationEmitter.model.index = newIndex;
    }

    reset() {
        this._navigationEmitter.model.reset();
    }

    get _items() {
        return this._containerEl.querySelectorAll(this._itemSelector);
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
    constructor(el, focusEl, containerEl, rowSelector, cellSelector) {
        super(el);
    }
}
*/

function createLinear(el, focusEl, containerEl, itemSelector, selectedOptions) {
    return new LinearActiveDescendant(el, focusEl, containerEl, itemSelector, selectedOptions);
}

module.exports = {
    createLinear
};
