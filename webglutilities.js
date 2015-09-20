'use strict'

var buildProgramWrapper = function (gl, vertexShader, fragmentShader, attributeLocations) {
    var programWrapper = {};

    var program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    for (var attributeName in attributeLocations) {
        gl.bindAttribLocation(program, attributeLocations[attributeName], attributeName);
    }
    gl.linkProgram(program);
    var uniformLocations = {};
    var numberOfUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < numberOfUniforms; i += 1) {
        var activeUniform = gl.getActiveUniform(program, i),
            uniformLocation = gl.getUniformLocation(program, activeUniform.name);
        uniformLocations[activeUniform.name] = uniformLocation;
    }

    programWrapper.program = program;
    programWrapper.uniformLocations = uniformLocations;

    return programWrapper;
};

var buildShader = function (gl, type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    console.log(gl.getShaderInfoLog(shader));
    return shader;
};

var buildTexture = function (gl, unit, format, type, width, height, data, wrapS, wrapT, minFilter, magFilter) {
    var texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, format, width, height, 0, format, type, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, magFilter);
    return texture;
};

var buildRenderbuffer = function (gl, width, height) {
    var renderbuffer = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);
    return renderbuffer;
};

var checkWebGLSupportWithExtensions = function (extensions, successCallback, failureCallback) { //successCallback(), failureCallback(hasWebGL, unsupportedExtensions)
    var canvas = document.createElement('canvas');
    var gl = null;
    try {
        gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    } catch (e) {
        failureCallback(false, []); //no webgl support
        return;
    }
    if (gl === null) {
        failureCallback(false, []); //no webgl support
        return;
    }

    var unsupportedExtensions = [];
    for (var i = 0; i < extensions.length; ++i) {
        if (gl.getExtension(extensions[i]) === null) {
            unsupportedExtensions.push(extensions[i]);
        }
    }
    if (unsupportedExtensions.length > 0) {
        failureCallback(true, unsupportedExtensions); //webgl support but no extensions
        return;
    }

    //webgl support and all required extensions
    successCallback();
};