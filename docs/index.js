var ActiveDescendant = require('../index.js');

function nodeListToArray(nodeList) {
    return Array.prototype.slice.call(nodeList);
}

var navs = [];
var appender = document.getElementById('appender');
var widgetEls = nodeListToArray(document.querySelectorAll('.widget'));
var wrapCheckbox = document.getElementById('wrap');

appender.addEventListener('click', function() {
    widgetEls.forEach(function(el) {
        var list = el.querySelector('ul');
        var newListItem = document.createElement('li');
        var numListItems = parseInt(list.querySelectorAll('li').length, 10);
        newListItem.innerText = 'Item ' + numListItems;
        list.appendChild(newListItem);
    });
});

widgetEls.forEach(function(el) {
    el.addEventListener('activeDescendantChange', function(e) {
        console.log(e);
    });

    var widget = ActiveDescendant.createLinear(el, el.querySelector('input'), el.querySelector('ul'), 'li');

    navs.push(widget);
});

wrapCheckbox.addEventListener('change', function(e) {
    navs[0].wrap = e.target.checked;
});
