'use strict'

var Buttons = function (elements, changeCallback) {
    var activeElement = elements[0];

    var color;

    this.setColor = function (newColor) {
        color = newColor;
        refresh();
    };

    var refresh = function () {
        for (var i = 0; i < elements.length; ++i) {
            if (elements[i] === activeElement) {
                elements[i].style.color = '#111111';
            } else {
                elements[i].style.color = '#777777';
            }
        }
    };

    for (var i = 0; i < elements.length; ++i) {
        (function () { //create closure to store index
            var index = i;
            var clickedElement = elements[i];
            elements[i].addEventListener('click', function () {
                if (activeElement !== clickedElement) {
                    activeElement = clickedElement;

                    changeCallback(index);

                    refresh();
                }

            });
        }());
    }

    refresh();
};