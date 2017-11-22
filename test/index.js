describe("makeup-active-descendant", function() {
    var ActiveDescendant = require('../index.js');
    var dom = '<ul class="widget">'
                + '<li>Button 1</li>'
                + '<li>Button 2</li>'
                + '<li>Button 3</li>'
            + '</ul>';

    document.body.innerHTML = dom;

    var testEl = document.querySelector('.widget');
    var testEmitter; // eslint-disable-line

    describe('when module is imported', function() {
        it("module should not be undefined", function() {
            expect(ActiveDescendant).not.toEqual(undefined);
        });
    });
});
