/* eslint-disable no-console */

const ActiveDescendant = require('../index.js');

const navs = [];
const appender = document.getElementById('appender');
const widgetEls = document.querySelectorAll('.widget');
const wrapCheckbox = document.getElementById('wrap');

appender.addEventListener('click', function() {
    widgetEls.forEach(function(el) {
        const list = el.querySelector('ul');
        const newListItem = document.createElement('li');
        const numListItems = parseInt(list.querySelectorAll('li').length, 10);
        newListItem.innerText = `Item ${numListItems}`;
        list.appendChild(newListItem);
    });
});

widgetEls.forEach(function(el) {
    el.addEventListener('activeDescendantChange', function(e) {
        console.log(e);
    });

    const options = {
        useAriaSelected: false
    };

    if (el.dataset.makeupInit !== undefined) {
        options.autoInit = el.dataset.makeupInit;
    }

    if (el.dataset.makeupReset !== undefined) {
        if (el.dataset.makeupReset === 'null') {
            options.autoReset = null;
        } else {
            options.autoReset = el.dataset.makeupReset;
        }
    }

    const widget = ActiveDescendant.createLinear(
        el,
        el.querySelector('input') || el.querySelector('ul'),
        el.querySelector('ul'),
        'li',
        options
    );

    navs.push(widget);
});

wrapCheckbox.addEventListener('change', function(e) {
    navs[0].wrap = e.target.checked;
});
