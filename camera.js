'use strict'

var Camera = function (element, distance, orbitPoint) {
    var azimuth = 0.0,
        elevation = 0;

    var lastMouseX = 0,
        lastMouseY = 0;

    var mouseDown = false;

    var viewMatrix = new Float32Array(16);

    this.getViewMatrix = function () {
        return viewMatrix;
    };

    var onDown = function (x, y) {
        mouseDown = true;
        lastMouseX = x;
        lastMouseY = y;
    };

    var onUp = function () {
        mouseDown = false;
    };

    this.isMouseDown = function () {
        return mouseDown;
    };

    var currentMouseX = 0,
        currentMouseY = 0;

    var mouseVelocityX = 0,
        mouseVelocityY = 0;

    var onMove = function (x, y) {
        currentMouseX = x;
        currentMouseY = y;
    };

    var SENSITIVITY = 0.005;
    var MIN_ELEVATION = 0;
    var MAX_ELEVATION = Math.PI / 3;

    this.update = function () {
        if (mouseDown) {
            var deltaAzimuth = (currentMouseX - lastMouseX) * SENSITIVITY;
            var deltaElevation = (currentMouseY - lastMouseY) * SENSITIVITY;

            azimuth += deltaAzimuth;
            elevation += deltaElevation;

            if (elevation > MAX_ELEVATION) elevation = MAX_ELEVATION;
            if (elevation < MIN_ELEVATION) elevation = MIN_ELEVATION;

            recomputeViewMatrix();

            mouseVelocityX = (currentMouseX - lastMouseX);
            mouseVelocityY = (currentMouseY - lastMouseY);

            lastMouseX = currentMouseX;
            lastMouseY = currentMouseY;

            element.style.cursor = '-webkit-grabbing';
            element.style.cursor = '-moz-grabbing';
            element.style.cursor = 'grabbing';
        } else {
            var deltaAzimuth = mouseVelocityX * SENSITIVITY;
            var deltaElevation = mouseVelocityY * SENSITIVITY;

            mouseVelocityX *= 0.8;
            mouseVelocityY *= 0.8;

            azimuth += deltaAzimuth;
            elevation += deltaElevation;

            if (elevation > MAX_ELEVATION) elevation = MAX_ELEVATION;
            if (elevation < MIN_ELEVATION) elevation = MIN_ELEVATION;

            recomputeViewMatrix();


            element.style.cursor = '-webkit-grab';
            element.style.cursor = '-moz-grab';
            element.style.cursor = 'grab';
        }

        distance += (targetDistance - distance) * 0.2;
    };

    element.addEventListener('mousedown', function (event) {
        event.preventDefault();
        onDown(getMousePosition(event, element).x, getMousePosition(event, element).y);
    });

    document.addEventListener('mouseup', function (event) {
        event.preventDefault();
        onUp();
    });

    document.addEventListener('mousemove', function (event) {
        event.preventDefault();
        onMove(getMousePosition(event, element).x, getMousePosition(event, element).y);
    });


    var recomputeViewMatrix = function () {
        var xRotationMatrix = new Float32Array(16),
            yRotationMatrix = new Float32Array(16),
            distanceTranslationMatrix = makeIdentityMatrix(new Float32Array(16)),
            orbitTranslationMatrix = makeIdentityMatrix(new Float32Array(16));

        makeIdentityMatrix(viewMatrix);

        makeXRotationMatrix(xRotationMatrix, elevation);
        makeYRotationMatrix(yRotationMatrix, azimuth);
        distanceTranslationMatrix[14] = -distance;
        orbitTranslationMatrix[12] = -orbitPoint[0];
        orbitTranslationMatrix[13] = -orbitPoint[1];
        orbitTranslationMatrix[14] = -orbitPoint[2];

        premultiplyMatrix(viewMatrix, viewMatrix, orbitTranslationMatrix);
        premultiplyMatrix(viewMatrix, viewMatrix, yRotationMatrix);
        premultiplyMatrix(viewMatrix, viewMatrix, xRotationMatrix);
        premultiplyMatrix(viewMatrix, viewMatrix, distanceTranslationMatrix);
    };

    recomputeViewMatrix();

    var MIN_DISTANCE = 0.5;
    var MAX_DISTANCE = 1.0;
    var targetDistance = distance;

    element.addEventListener('wheel', function (event) {
        var scrollDelta = event.deltaY;
        targetDistance += ((scrollDelta > 0) ? 1 : -1) * 0.03;
        if (targetDistance < MIN_DISTANCE) targetDistance = MIN_DISTANCE;
        if (targetDistance > MAX_DISTANCE) targetDistance = MAX_DISTANCE;
    })
};