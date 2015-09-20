'use strict'

var VortexSpheres = function (initialVerticesPerFilament, initialParticlesWidth, initialParticlesHeight, initialParticlesSize) {
    var FADE_WIDTH = 3000;

    var VERTICAL_FOV = Math.PI / 2;

    var PROJECTION_NEAR = 0.01, PROJECTION_FAR = 100;

    var LIGHT_DIRECTION = normalizeVector([], [-1.0, -1.0, -1]); //points towards where the light is
    var LIGHT_UP_VECTOR = [0, 1, 0];

    var LIGHT_PROJECTION_LEFT = -1.0;
    var LIGHT_PROJECTION_RIGHT = 1.0;
    var LIGHT_PROJECTION_BOTTOM = -1.0;
    var LIGHT_PROJECTION_TOP = 1.0;
    var LIGHT_PROJECTION_NEAR = -3.0;
    var LIGHT_PROJECTION_FAR = 5.0;

    var SHADOW_MAP_WIDTH = 2048;
    var SHADOW_MAP_HEIGHT = 2048;


    var canvas = document.getElementsByTagName('canvas')[0];
    var gl = canvas.getContext('webgl');
    gl.getExtension('OES_texture_float');
    var ext = gl.getExtension('ANGLE_instanced_arrays');
    var drawExt = gl.getExtension('WEBGL_draw_buffers');
    var depthTextureExt = gl.getExtension('WEBGL_depth_texture');

    var variationSlider = new Slider(document.getElementById('variation-slider'), 0.0, 0.01, 0.005, function (value) {
        filamentSystem.setFilamentVariation(value);
    });

    var smoothingRadiusSlider = new Slider(document.getElementById('smoothing-radius-slider'), 0.02, 0.06, 0.04, function (value) {
        filamentSystem.setSmoothingRadius(value);
    });

    var sphereGeometry = new SphereGeometry();

    var verticesPerFilament = 10;
    var filamentSystem,
        filamentsGeometry,
        advectProgramWrapper;

    this.resetFilaments = function (newVerticesPerFilament) {
        verticesPerFilament = newVerticesPerFilament;

        filamentSystem = new FilamentSystem(verticesPerFilament, variationSlider.getValue(), smoothingRadiusSlider.getValue());
        filamentsGeometry = new FilamentsGeometry(verticesPerFilament);
        advectProgramWrapper = buildProgramWrapper(gl,
            buildShader(gl, gl.VERTEX_SHADER, FULLSCREEN_VERTEX_SHADER_SOURCE),
            buildShader(gl, gl.FRAGMENT_SHADER, '#define MAX_FILAMENTS ' + MAX_FILAMENTS.toFixed(0) + '\n#define VERTICES_PER_FILAMENT ' + verticesPerFilament.toFixed(0) + '\n' + ADVECT_FRAGMENT_SHADER_SOURCE),
            {'a_position': 0});
    }

    this.resetFilaments(initialVerticesPerFilament);


    var sphereVertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sphereGeometry.vertices), gl.STATIC_DRAW);

    var sphereNormalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sphereNormalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sphereGeometry.normals), gl.STATIC_DRAW);

    var sphereIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sphereIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(sphereGeometry.indices), gl.STATIC_DRAW);

    var camera = new Camera(canvas, 0.55, [0, 0.4, 0]);
    var projectionMatrix = new Float32Array(16);
    makePerspectiveMatrix(projectionMatrix, VERTICAL_FOV, canvas.width / canvas.height, PROJECTION_NEAR, PROJECTION_FAR);

    var floorProgramWrapper = buildProgramWrapper(gl,
        buildShader(gl, gl.VERTEX_SHADER, FLOOR_VERTEX_SHADER_SOURCE),
        buildShader(gl, gl.FRAGMENT_SHADER, FLOOR_FRAGMENT_SHADER_SOURCE),
        {
            'a_vertexPosition': 0,
        });

    var sphereDepthProgramWrapper = buildProgramWrapper(gl,
        buildShader(gl, gl.VERTEX_SHADER, SPHERE_DEPTH_VERTEX_SHADER_SOURCE),
        buildShader(gl, gl.FRAGMENT_SHADER, SPHERE_DEPTH_FRAGMENT_SHADER_SOURCE),
        {
            'a_textureCoordinates': 1,
            'a_vertexPosition': 0,
        });

    var sphereProgramWrapper = buildProgramWrapper(gl,
        buildShader(gl, gl.VERTEX_SHADER, SPHERE_VERTEX_SHADER_SOURCE),
        buildShader(gl, gl.FRAGMENT_SHADER, SPHERE_FRAGMENT_SHADER_SOURCE),
        {
            'a_textureCoordinates': 2,
            'a_vertexPosition': 0,
            'a_vertexNormal': 1
        });

    var aoProgramWrapper = buildProgramWrapper(gl,
        buildShader(gl, gl.VERTEX_SHADER, AO_VERTEX_SHADER_SOURCE),
        buildShader(gl, gl.FRAGMENT_SHADER, AO_FRAGMENT_SHADER_SOURCE),
        {
            'a_textureCoordinates': 2,
            'a_vertexPosition': 0,
            'a_vertexNormal': 1
        });

    var filamentProgramWrapper = buildProgramWrapper(gl,
        buildShader(gl, gl.VERTEX_SHADER, FILAMENT_VERTEX_SHADER_SOURCE),
        buildShader(gl, gl.FRAGMENT_SHADER, FILAMENT_FRAGMENT_SHADER_SOURCE),
        {
            'a_position': 0,
            'a_normal': 1,
        });

    var outputProgramWrapper = buildProgramWrapper(gl,
        buildShader(gl, gl.VERTEX_SHADER, FULLSCREEN_VERTEX_SHADER_SOURCE),
        buildShader(gl, gl.FRAGMENT_SHADER, OUTPUT_FRAGMENT_SHADER_SOURCE),
        {'a_position': 0});

    var fxaaProgramWrapper = buildProgramWrapper(gl,
        buildShader(gl, gl.VERTEX_SHADER, FULLSCREEN_VERTEX_SHADER_SOURCE),
        buildShader(gl, gl.FRAGMENT_SHADER, FXAA_FRAGMENT_SHADER_SOURCE),
        {'a_position': 0});

    var filamentVertexBuffer = gl.createBuffer();
    var filamentNormalBuffer = gl.createBuffer();
    var filamentIndexBuffer = gl.createBuffer();


    var particleVertexBuffer,
        particleTexture,
        particleTextureTemp,
        particleVelocityTexture,
        particleVelocityTextureTemp,
        spawnPositionsTexture;

    var particlesWidth = 0,
        particlesHeight = 0;

    var respawnBatchSize = Math.floor(particlesWidth * particlesHeight / PARTICLE_LIFETIME);
    var respawnStartIndex = 0;

    this.resetParticles = function (newParticlesWidth, newParticlesHeight, sizeScale) {
        particlesWidth = newParticlesWidth;
        particlesHeight = newParticlesHeight;

        respawnBatchSize = Math.floor(particlesWidth * particlesHeight / PARTICLE_LIFETIME);
        respawnStartIndex = 0;

        //create particle vertex buffer containing the relevant texture coordinates
        particleVertexBuffer = gl.createBuffer();

        var particleTextureCoordinates = new Float32Array(particlesWidth * particlesHeight * 2);
        for (var y = 0; y < particlesHeight; ++y) {
            for (var x = 0; x < particlesWidth; ++x) {
                particleTextureCoordinates[(y * particlesWidth + x) * 2] = (x + 0.5) / particlesWidth;
                particleTextureCoordinates[(y * particlesWidth + x) * 2 + 1] = (y + 0.5) / particlesHeight;
            }
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, particleVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, particleTextureCoordinates, gl.STATIC_DRAW);


        //generate initial particle positions amd create particle position texture for them
        var particlePositions = new Float32Array(particlesWidth * particlesHeight * 4);
        for (var i = 0; i < particlesWidth * particlesHeight; ++i) {
            particlePositions[i * 4] = 9999999999.0;
            particlePositions[i * 4 + 1] = 9999999999.0;
            particlePositions[i * 4 + 2] =  9999999999.0;

            var size = (0.6 + Math.pow(Math.random(), 100.0) * 4.0) * 0.003 * sizeScale;
            particlePositions[i * 4 + 3] = size;
        }

        particleTexture = buildTexture(gl, 0, gl.RGBA, gl.FLOAT, particlesWidth, particlesHeight, particlePositions, gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE, gl.NEAREST, gl.NEAREST);
        particleTextureTemp = buildTexture(gl, 0, gl.RGBA, gl.FLOAT, particlesWidth, particlesHeight, null, gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE, gl.NEAREST, gl.NEAREST);


        particleVelocityTexture = buildTexture(gl, 0, gl.RGBA, gl.FLOAT, particlesWidth, particlesHeight, null, gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE, gl.NEAREST, gl.NEAREST);
        particleVelocityTextureTemp = buildTexture(gl, 0, gl.RGBA, gl.FLOAT, particlesWidth, particlesHeight, null, gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE, gl.NEAREST, gl.NEAREST);

        var particleSpawnPositions = new Float32Array(particlesWidth * particlesHeight * 4);
        for (var i = 0; i < particlesWidth * particlesHeight; ++i) {

            var r = Math.random();
            var theta = Math.random() * 2 * Math.PI;

            var x = Math.sqrt(r) * Math.cos(theta) * FILAMENT_RADIUS;
            var y = -particlePositions[i * 4 + 3];
            var z = Math.sqrt(r) * Math.sin(theta) * FILAMENT_RADIUS;

            particleSpawnPositions[i * 4] = x;
            particleSpawnPositions[i * 4 + 1] = y
            particleSpawnPositions[i * 4 + 2] =  z;
            particleSpawnPositions[i * 4 + 3] = 1;
        }

        spawnPositionsTexture = buildTexture(gl, 0, gl.RGBA, gl.FLOAT, particlesWidth, particlesHeight, particleSpawnPositions, gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE, gl.NEAREST, gl.NEAREST);
    };

    this.resetParticles(initialParticlesWidth, initialParticlesHeight, initialParticlesSize);


    

    var fullscreenVertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, fullscreenVertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0]), gl.STATIC_DRAW);

    var filamentTexture = buildTexture(gl, 0, gl.RGBA, gl.FLOAT, 1, 1, null, gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE, gl.NEAREST, gl.NEAREST);

    var simulationFramebuffer = gl.createFramebuffer();
    var renderingFramebuffer = gl.createFramebuffer();
    var occlusionFramebuffer = gl.createFramebuffer();
    var outputFramebuffer = gl.createFramebuffer();

    //things that need to be resized
    var positionsTexture = buildTexture(gl, 0, gl.RGBA, gl.FLOAT, canvas.width, canvas.height, null, gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE, gl.NEAREST, gl.NEAREST);
    var colorsTexture = buildTexture(gl, 0, gl.RGBA, gl.FLOAT, canvas.width, canvas.height, null, gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE, gl.NEAREST, gl.NEAREST);
    var normalsTexture = buildTexture(gl, 0, gl.RGBA, gl.FLOAT, canvas.width, canvas.height, null, gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE, gl.NEAREST, gl.NEAREST);
    var occlusionTexture = buildTexture(gl, 0, gl.RGBA, gl.UNSIGNED_BYTE, canvas.width, canvas.height, null, gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE, gl.NEAREST, gl.NEAREST);
    var outputTexture = buildTexture(gl, 0, gl.RGBA, gl.UNSIGNED_BYTE, canvas.width, canvas.height, null, gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE, gl.LINEAR, gl.LINEAR);
    var renderingRenderbuffer = buildRenderbuffer(gl, canvas.width, canvas.height);

    var depthColorTexture = buildTexture(gl, 0, gl.RGBA, gl.UNSIGNED_BYTE, SHADOW_MAP_WIDTH, SHADOW_MAP_HEIGHT, null, gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE, gl.NEAREST, gl.NEAREST);
    var depthTexture = buildTexture(gl, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_SHORT, SHADOW_MAP_WIDTH, SHADOW_MAP_HEIGHT, null, gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE, gl.NEAREST, gl.NEAREST);
    var shadowFramebuffer = gl.createFramebuffer();

    var mouseX = 0;
    var mouseY = 0;
    var lastMouseX = 0;
    var lastMouseY = 0;
    var mouseSpeedX = 0;
    var mouseSpeedY = 0;

    var lightViewMatrix = new Float32Array(16); 
    makeLookAtMatrix(lightViewMatrix, [0.0, 0.0, 0.0], LIGHT_DIRECTION, LIGHT_UP_VECTOR);
    var lightProjectionMatrix = makeOrthographicMatrix(new Float32Array(16), LIGHT_PROJECTION_LEFT, LIGHT_PROJECTION_RIGHT, LIGHT_PROJECTION_BOTTOM, LIGHT_PROJECTION_TOP, LIGHT_PROJECTION_NEAR, LIGHT_PROJECTION_FAR);

    var lightViewProjectionMatrix = new Float32Array(16);
    premultiplyMatrix(lightViewProjectionMatrix, lightViewMatrix, lightProjectionMatrix);


    canvas.onmousemove = function (event) {
        mouseX = (event.layerX / canvas.width) * 2.0 - 1.0;
        mouseY = (1.0 - event.layerY / canvas.height) * 2.0 - 1.0;
    };

    var uiDiv = document.getElementById('ui');


    var droppingThisFrame = false;


    var draw = function () {
        camera.update();

        var projectionViewMatrix = premultiplyMatrix(new Float32Array(16), camera.getViewMatrix(), projectionMatrix);

        mouseSpeedX = (mouseX - lastMouseX) / canvas.height;
        mouseSpeedY = (mouseY - lastMouseY) / canvas.height;

        lastMouseX = mouseX;
        lastMouseY = mouseY;

        gl.enableVertexAttribArray(0);

        gl.bindTexture(gl.TEXTURE_2D, filamentTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, verticesPerFilament, MAX_FILAMENTS, 0, gl.RGBA, gl.FLOAT, filamentSystem.filamentData);

        //advect particles

        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.BLEND);

        gl.bindFramebuffer(gl.FRAMEBUFFER, simulationFramebuffer);

        drawExt.drawBuffersWEBGL([
            drawExt.COLOR_ATTACHMENT0_WEBGL,
            drawExt.COLOR_ATTACHMENT1_WEBGL,
        ]);

        gl.framebufferTexture2D(gl.FRAMEBUFFER, drawExt.COLOR_ATTACHMENT0_WEBGL, gl.TEXTURE_2D, particleTextureTemp, 0);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, drawExt.COLOR_ATTACHMENT1_WEBGL, gl.TEXTURE_2D, particleVelocityTextureTemp, 0);

        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, particleTextureTemp, 0);
        gl.viewport(0, 0, particlesWidth, particlesHeight);

        gl.bindBuffer(gl.ARRAY_BUFFER, fullscreenVertexBuffer);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

        gl.useProgram(advectProgramWrapper.program);
        gl.uniform1i(advectProgramWrapper.uniformLocations['u_positionsTexture'], 0);
        gl.uniform1i(advectProgramWrapper.uniformLocations['u_filamentsTexture'], 1);
        gl.uniform1i(advectProgramWrapper.uniformLocations['u_spawnPositionsTexture'], 2);
        gl.uniform1i(advectProgramWrapper.uniformLocations['u_velocitiesTexture'], 3);

        gl.uniform1f(advectProgramWrapper.uniformLocations['u_speedScale'], SPEED_SCALE);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, particleTexture);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, filamentTexture);

        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, spawnPositionsTexture);

        gl.activeTexture(gl.TEXTURE3);
        gl.bindTexture(gl.TEXTURE_2D, particleVelocityTexture);


        respawnStartIndex += respawnBatchSize;

        if (respawnStartIndex > particlesWidth * particlesHeight) {
            respawnStartIndex = 0;
        }

        gl.uniform1f(advectProgramWrapper.uniformLocations['u_respawnStartIndex'], respawnStartIndex);
        gl.uniform1f(advectProgramWrapper.uniformLocations['u_respawnEndIndex'], respawnStartIndex + respawnBatchSize);

        gl.uniform1f(advectProgramWrapper.uniformLocations['u_emissionT'], filamentSystem.getEmissionT());

        
        gl.uniform1i(advectProgramWrapper.uniformLocations['u_dropping'], droppingThisFrame ? 1 : 0);
        droppingThisFrame = false;


        //compute current mouse ray

        var inverseProjectionViewMatrix = [];

        var viewProjectionMatrix = premultiplyMatrix([], camera.getViewMatrix(), projectionMatrix);
        var inverseProjectionViewMatrix = invertMatrix([], viewProjectionMatrix)

        var nearPoint = [mouseX, mouseY, 1.0, 1.0];
        transformVectorByMatrix(nearPoint, nearPoint, inverseProjectionViewMatrix);

        var farPoint = [mouseX, mouseY, -1.0, 1.0];
        transformVectorByMatrix(farPoint, farPoint, inverseProjectionViewMatrix);

        projectVector4(nearPoint, nearPoint);
        projectVector4(farPoint, farPoint);

        var direction = normalizeVector([], subtractVectors([], nearPoint, farPoint));

        if ((Math.abs(mouseSpeedX) > 0.0 || Math.abs(mouseSpeedY) > 0.0) && !camera.isMouseDown()) {
            gl.uniform3f(advectProgramWrapper.uniformLocations['u_cameraPosition'], farPoint[0], farPoint[1], farPoint[2]);
            gl.uniform3f(advectProgramWrapper.uniformLocations['u_mouseDirection'], direction[0], direction[1], direction[2]);
            gl.uniform2f(advectProgramWrapper.uniformLocations['u_mouseVelocity'], mouseSpeedX, mouseSpeedY);
        } else { //no shedding
            gl.uniform3f(advectProgramWrapper.uniformLocations['u_cameraPosition'], 9999999.0, 999999.0, 999999.0);
            gl.uniform3f(advectProgramWrapper.uniformLocations['u_mouseDirection'], 0, 0, 1);
            gl.uniform2f(advectProgramWrapper.uniformLocations['u_mouseVelocity'], mouseSpeedX, mouseSpeedY);
        }


        var cameraViewMatrix = camera.getViewMatrix();
        var cameraRight = [cameraViewMatrix[0], cameraViewMatrix[4], cameraViewMatrix[8]];
        var cameraUp = [cameraViewMatrix[1], cameraViewMatrix[5], cameraViewMatrix[9]];
        var cameraForward = [-cameraViewMatrix[2], -cameraViewMatrix[6], -cameraViewMatrix[10]];

        gl.uniform3f(advectProgramWrapper.uniformLocations['u_cameraRight'], cameraRight[0], cameraRight[1], cameraRight[2]);
        gl.uniform3f(advectProgramWrapper.uniformLocations['u_cameraUp'], cameraUp[0], cameraUp[1], cameraUp[2]);

        gl.uniform2f(advectProgramWrapper.uniformLocations['u_positionsResolution'], particlesWidth, particlesHeight);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        var temp = particleTexture;
        particleTexture = particleTextureTemp;
        particleTextureTemp = temp;

        var temp = particleVelocityTexture;
        particleVelocityTexture = particleVelocityTextureTemp;
        particleVelocityTextureTemp = temp;




        //draw spheres for shadows

        gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFramebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, depthColorTexture, 0);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depthTexture, 0);

        gl.clearColor(999999, 999999, 999999, 999999);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.viewport(1, 1, SHADOW_MAP_WIDTH - 2, SHADOW_MAP_HEIGHT - 2);

        gl.enable(gl.DEPTH_TEST);



        gl.enableVertexAttribArray(0);
        gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertexBuffer);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sphereIndexBuffer);

        gl.useProgram(sphereDepthProgramWrapper.program);

        gl.uniform1i(sphereDepthProgramWrapper.uniformLocations['u_positionsTexture'], 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, particleTexture);

        gl.uniformMatrix4fv(sphereDepthProgramWrapper.uniformLocations['u_projectionViewMatrix'], false, lightViewProjectionMatrix);


        gl.enableVertexAttribArray(1);
        gl.bindBuffer(gl.ARRAY_BUFFER, particleVertexBuffer);
        gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
        ext.vertexAttribDivisorANGLE(1, 1);

        gl.uniform1f(sphereDepthProgramWrapper.uniformLocations['u_respawnEndIndex'], respawnStartIndex + respawnBatchSize);
        gl.uniform1f(sphereDepthProgramWrapper.uniformLocations['u_fadeWidth'], FADE_WIDTH);
        gl.uniform2f(sphereDepthProgramWrapper.uniformLocations['u_particleResolution'], particlesWidth, particlesHeight);


        gl.enable(gl.CULL_FACE);
        gl.frontFace(gl.CCW);

        gl.colorMask(false, false, false, false);

        ext.drawElementsInstancedANGLE(gl.TRIANGLES, sphereGeometry.indices.length, gl.UNSIGNED_SHORT, 0, particlesWidth * particlesHeight);

        gl.colorMask(true, true, true, true);

        gl.disable(gl.CULL_FACE);


        ext.vertexAttribDivisorANGLE(1, 0);
        




        

        gl.bindFramebuffer(gl.FRAMEBUFFER, renderingFramebuffer);

        drawExt.drawBuffersWEBGL([
            drawExt.COLOR_ATTACHMENT0_WEBGL,
            drawExt.COLOR_ATTACHMENT1_WEBGL,
            drawExt.COLOR_ATTACHMENT2_WEBGL,
        ]);

        gl.framebufferTexture2D(gl.FRAMEBUFFER, drawExt.COLOR_ATTACHMENT0_WEBGL, gl.TEXTURE_2D, positionsTexture, 0);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, drawExt.COLOR_ATTACHMENT1_WEBGL, gl.TEXTURE_2D, normalsTexture, 0);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, drawExt.COLOR_ATTACHMENT2_WEBGL, gl.TEXTURE_2D, colorsTexture, 0);

        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, renderingRenderbuffer);

        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.viewport(0, 0, canvas.width, canvas.height);

        gl.disable(gl.BLEND);
        gl.enable(gl.DEPTH_TEST);
        gl.depthMask(true);

        //draw spheres
        gl.enableVertexAttribArray(0);
        gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertexBuffer);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

        gl.enableVertexAttribArray(1);
        gl.bindBuffer(gl.ARRAY_BUFFER, sphereNormalBuffer);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sphereIndexBuffer);

        gl.useProgram(sphereProgramWrapper.program);

        gl.uniform1i(sphereProgramWrapper.uniformLocations['u_positionsTexture'], 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, particleTexture);

        gl.uniform1i(sphereProgramWrapper.uniformLocations['u_velocitiesTexture'], 1);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, particleVelocityTexture);

        gl.uniformMatrix4fv(sphereProgramWrapper.uniformLocations['u_projectionViewMatrix'], false, projectionViewMatrix);


        gl.enableVertexAttribArray(2);
        gl.bindBuffer(gl.ARRAY_BUFFER, particleVertexBuffer);
        gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);
        ext.vertexAttribDivisorANGLE(2, 1);

        gl.uniform1f(sphereProgramWrapper.uniformLocations['u_respawnEndIndex'], respawnStartIndex + respawnBatchSize);
        gl.uniform1f(sphereProgramWrapper.uniformLocations['u_fadeWidth'], FADE_WIDTH);
        gl.uniform2f(sphereProgramWrapper.uniformLocations['u_particleResolution'], particlesWidth, particlesHeight);


        gl.enable(gl.CULL_FACE);
        gl.frontFace(gl.CCW);

        ext.drawElementsInstancedANGLE(gl.TRIANGLES, sphereGeometry.indices.length, gl.UNSIGNED_SHORT, 0, particlesWidth * particlesHeight);

        gl.disable(gl.CULL_FACE);

        gl.disableVertexAttribArray(0);
        gl.disableVertexAttribArray(1);
        gl.disableVertexAttribArray(2);


        //draw filaments
        filamentsGeometry.generate(filamentSystem);

        gl.useProgram(filamentProgramWrapper.program);

        gl.enableVertexAttribArray(0);
        gl.bindBuffer(gl.ARRAY_BUFFER, filamentVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, filamentsGeometry.vertexData, gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

        gl.enableVertexAttribArray(1);
        gl.bindBuffer(gl.ARRAY_BUFFER, filamentNormalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, filamentsGeometry.normalData, gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);

        gl.uniformMatrix4fv(filamentProgramWrapper.uniformLocations['u_projectionViewMatrix'], false, projectionViewMatrix);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, filamentIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, filamentsGeometry.indices, gl.DYNAMIC_DRAW);


        gl.enable(gl.CULL_FACE);
        gl.frontFace(gl.CCW);

        gl.drawElements(gl.TRIANGLES, filamentsGeometry.indices.length, gl.UNSIGNED_SHORT, 0);

        gl.disable(gl.CULL_FACE);


        //draw floor

        gl.useProgram(floorProgramWrapper.program);

        gl.enableVertexAttribArray(0);
        gl.bindBuffer(gl.ARRAY_BUFFER, fullscreenVertexBuffer);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

        gl.uniformMatrix4fv(floorProgramWrapper.uniformLocations['u_projectionViewMatrix'], false, projectionViewMatrix);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        
        
        //ambient occlusion


        gl.bindFramebuffer(gl.FRAMEBUFFER, occlusionFramebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, occlusionTexture, 0);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, renderingRenderbuffer);

        gl.viewport(0, 0, canvas.width, canvas.height);

        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);

        gl.enable(gl.DEPTH_TEST);
        gl.depthMask(false);


        
        gl.useProgram(aoProgramWrapper.program);

        gl.uniform2f(aoProgramWrapper.uniformLocations['u_resolution'], canvas.width, canvas.height);

        gl.uniformMatrix4fv(aoProgramWrapper.uniformLocations['u_projectionViewMatrix'], false, projectionViewMatrix);

        gl.uniform1f(aoProgramWrapper.uniformLocations['u_respawnEndIndex'], respawnStartIndex + respawnBatchSize);
        gl.uniform1f(aoProgramWrapper.uniformLocations['u_fadeWidth'], FADE_WIDTH);
        gl.uniform2f(aoProgramWrapper.uniformLocations['u_particleResolution'], particlesWidth, particlesHeight);


        gl.uniform1i(aoProgramWrapper.uniformLocations['u_particlePositionsTexture'], 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, particleTexture);

        gl.uniform1i(aoProgramWrapper.uniformLocations['u_positionsTexture'], 1);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, positionsTexture);

        gl.uniform1i(aoProgramWrapper.uniformLocations['u_normalsTexture'], 2);
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, normalsTexture);


        //draw spheres
        gl.enableVertexAttribArray(0);
        gl.enableVertexAttribArray(1);

        gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertexBuffer);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, sphereNormalBuffer);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sphereIndexBuffer);

        gl.enableVertexAttribArray(2);
        gl.bindBuffer(gl.ARRAY_BUFFER, particleVertexBuffer);
        gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);
        ext.vertexAttribDivisorANGLE(2, 1);
        
        gl.enable(gl.CULL_FACE);
        gl.frontFace(gl.CCW);

        ext.drawElementsInstancedANGLE(gl.TRIANGLES, sphereGeometry.indices.length, gl.UNSIGNED_SHORT, 0, particlesWidth * particlesHeight);
        
        gl.disable(gl.CULL_FACE);

        gl.depthMask(true);
        gl.disable(gl.BLEND);

        gl.disableVertexAttribArray(0);
        gl.disableVertexAttribArray(1);
        gl.disableVertexAttribArray(2);
        

        
        //output
        gl.bindFramebuffer(gl.FRAMEBUFFER, outputFramebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, outputTexture, 0);
        gl.viewport(0, 0, canvas.width, canvas.height);

        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT, gl.DEPTH_BUFFER_BIT);


        
        gl.enableVertexAttribArray(0);
        gl.bindBuffer(gl.ARRAY_BUFFER, fullscreenVertexBuffer);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

        gl.useProgram(outputProgramWrapper.program);

        gl.uniform1i(outputProgramWrapper.uniformLocations['u_positionsTexture'], 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, positionsTexture);

        gl.uniform1i(outputProgramWrapper.uniformLocations['u_normalsTexture'], 1);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, normalsTexture);

        gl.uniform1i(outputProgramWrapper.uniformLocations['u_colorsTexture'], 2);
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, colorsTexture);

        gl.uniform1i(outputProgramWrapper.uniformLocations['u_occlusionTexture'], 3);
        gl.activeTexture(gl.TEXTURE3);
        gl.bindTexture(gl.TEXTURE_2D, occlusionTexture);


        gl.uniform1i(outputProgramWrapper.uniformLocations['u_shadowDepthTexture'], 4);
        gl.activeTexture(gl.TEXTURE4);
        gl.bindTexture(gl.TEXTURE_2D, depthTexture);

        gl.uniform2f(outputProgramWrapper.uniformLocations['u_shadowResolution'], SHADOW_MAP_WIDTH, SHADOW_MAP_HEIGHT);

        gl.uniform3f(outputProgramWrapper.uniformLocations['u_lightDirection'], LIGHT_DIRECTION[0], LIGHT_DIRECTION[1], LIGHT_DIRECTION[2]);

        gl.uniformMatrix4fv(outputProgramWrapper.uniformLocations['u_lightProjectionViewMatrix'], false, lightViewProjectionMatrix);


        var viewMatrix = new Float32Array(camera.getViewMatrix());
        viewMatrix[3] = 0;
        viewMatrix[7] = 0;
        viewMatrix[11] = 0;
        viewMatrix[12] = 0;
        viewMatrix[13] = 0;
        viewMatrix[14] = 0;
        viewMatrix[15] = 1;
        var cameraMatrix = transposeMat4(new Float32Array(16), viewMatrix);
        gl.uniformMatrix4fv(outputProgramWrapper.uniformLocations['u_cameraMatrix'], false, cameraMatrix);

        gl.uniform1f(outputProgramWrapper.uniformLocations['u_verticalFov'], VERTICAL_FOV);
        gl.uniform2f(outputProgramWrapper.uniformLocations['u_resolution'], canvas.width, canvas.height);


        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        gl.disable(gl.DEPTH_TEST);


        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT, gl.DEPTH_BUFFER_BIT);

        gl.enableVertexAttribArray(0);
        gl.bindBuffer(gl.ARRAY_BUFFER, fullscreenVertexBuffer);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

        gl.useProgram(fxaaProgramWrapper.program);

        gl.uniform2f(fxaaProgramWrapper.uniformLocations['u_resolution'], canvas.width, canvas.height);

        gl.uniform1i(fxaaProgramWrapper.uniformLocations['u_input'], 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, outputTexture);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);





        var anchorPoint = normalizeVector([], crossVectors([], cameraForward, [0, 1, 0]));
        multiplyVectorByScalar(anchorPoint, anchorPoint, 0.2);
        addVectors(anchorPoint, anchorPoint, [0, 0.0, 0]);

        anchorPoint[3] = 1;
        transformVectorByMatrix(anchorPoint, anchorPoint, projectionViewMatrix);

        projectVector4(anchorPoint, anchorPoint);

        var uiX = (anchorPoint[0] * 0.5 + 0.5) * canvas.width;
        var uiY = canvas.height - (anchorPoint[1] * 0.5 + 0.5) * canvas.height;

        //anchor to bottom left
        uiDiv.style.top = (uiY - uiDiv.getBoundingClientRect().height) + 'px';
        uiDiv.style.left = uiX + 'px';
        
    };


    var dropButton = document.getElementById('drop-button');
    dropButton.onclick = function () {
        drop();
    };

    var onresize = function () {
        var aspectRatio = window.innerWidth / window.innerHeight;
        makePerspectiveMatrix(projectionMatrix, VERTICAL_FOV, aspectRatio, PROJECTION_NEAR, PROJECTION_FAR);
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        positionsTexture = buildTexture(gl, 0, gl.RGBA, gl.FLOAT, canvas.width, canvas.height, null, gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE, gl.NEAREST, gl.NEAREST);
        colorsTexture = buildTexture(gl, 0, gl.RGBA, gl.FLOAT, canvas.width, canvas.height, null, gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE, gl.NEAREST, gl.NEAREST);
        normalsTexture = buildTexture(gl, 0, gl.RGBA, gl.FLOAT, canvas.width, canvas.height, null, gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE, gl.NEAREST, gl.NEAREST);
        occlusionTexture = buildTexture(gl, 0, gl.RGBA, gl.UNSIGNED_BYTE, canvas.width, canvas.height, null, gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE, gl.NEAREST, gl.NEAREST);
        outputTexture = buildTexture(gl, 0, gl.RGBA, gl.UNSIGNED_BYTE, canvas.width, canvas.height, null, gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE, gl.LINEAR, gl.LINEAR);
        renderingRenderbuffer = buildRenderbuffer(gl, canvas.width, canvas.height);
    };

    window.addEventListener('resize', onresize);
    onresize();


    var drop = function () {
        droppingThisFrame = true;

        filamentSystem.drop();
    };

    document.onkeydown = function (event) {
        if (event.keyCode === 32) { //space
            drop();
        }
    };

    var update = function update () {
        filamentSystem.simulate();
        draw();

        requestAnimationFrame(update);
    }
    update();
}