'use strict'

var niceConcatenation = function (list) {
    if (list.length === 0) {
        return '';
    } else if (list.length === 1) {
        return "'" + list[0] + "'";
    } else {
        var result = '';
        for (var i = 0; i < list.length; ++i) {
            result += "'" + list[i] + "'";
            if (i < list.length - 1) {
                result += i < list.length - 2 ? ', ' : ' and '
            }
        }

        return result;
    }
}

checkWebGLSupportWithExtensions(['ANGLE_instanced_arrays', 'WEBGL_draw_buffers', 'WEBGL_depth_texture'],
    function () { //has webgl with extensions
        document.getElementById('ui').style.display = 'block';
        document.getElementById('footer').style.display = 'block';
        document.getElementById('qualities').style.display = 'block';

        var vortexSpheres = new VortexSpheres(8, 256, 128, 1.4); //start at medium quality

        var buttons = new Buttons([
            document.getElementById('medium-quality'),
            document.getElementById('low-quality'),
            document.getElementById('high-quality')
        ], function (index) {
            if (index === 1) { //low
                vortexSpheres.resetFilaments(6);
                vortexSpheres.resetParticles(128, 128, 1.8);
            } else if (index === 0) { //medium
                vortexSpheres.resetFilaments(8);
                vortexSpheres.resetParticles(256, 128, 1.4);
            } else if (index === 2) { //high
                vortexSpheres.resetFilaments(10);
                vortexSpheres.resetParticles(256, 256, 1.0);
            }
        });
    },

    function (hasWebGL, unsupportedExtensions) { //missing webgl or extensions
        document.getElementById('error').style.display = 'block';
        document.getElementById('video').style.display = 'block';

        if (!hasWebGL) {
            document.getElementById('error').textContent = "Unfortunately, your browser does not support WebGL.";
        } else {
            document.getElementById('error').textContent = "Unfortunately, your browser does not support the " + niceConcatenation(unsupportedExtensions) + " WebGL extension" + (unsupportedExtensions.length > 1 ? 's.' : '.');
        }
    }
);