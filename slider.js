'use strict'

var Slider = function (element, min, max, initialValue, changeCallback) {
    var div = element;

    var innerDiv = document.createElement('div');
    innerDiv.style.position = 'absolute';
    innerDiv.style.height = div.offsetHeight + 'px';

    div.appendChild(innerDiv);

    var color = 'rgba(255, 255, 255, 1.0)';

    var value = initialValue;

    this.getValue = function () {
        return value;
    };

    var mousePressed = false;

    var redraw = function () {
        var fraction = (value - min) / (max - min);
        innerDiv.style.background = color;
        innerDiv.style.width = fraction * div.offsetWidth + 'px';
        innerDiv.style.height = div.offsetHeight + 'px';
    };

    redraw();

    div.addEventListener('mousedown', function (event) {
        mousePressed = true;
        onChange(event);
    });

    document.addEventListener('mouseup', function (event) {
        mousePressed = false;
    });

    document.addEventListener('mousemove', function (event) {
        if (mousePressed) {
            onChange(event);
        }
    });

    var onChange = function (event) {
        var mouseX = getMousePosition(event, div).x;
        value = clamp((mouseX / div.offsetWidth) * (max - min) + min, min, max);

        changeCallback(value);

        redraw();
    };
};