var FLOOR_VERTEX_SHADER_SOURCE = [
    'precision highp float;',

    'attribute vec2 a_vertexPosition;',

    'uniform mat4 u_projectionViewMatrix;',

    'varying vec3 v_position;',

    'void main () {',
        'v_position = vec3(a_vertexPosition.x * 200.0, 0.0, a_vertexPosition.y * 200.0);',

        'gl_Position = u_projectionViewMatrix * vec4(v_position, 1.0);',
    '}'
].join('\n');

var FLOOR_FRAGMENT_SHADER_SOURCE = [
    '#extension GL_EXT_draw_buffers : require',

    'precision highp float;',

    'varying vec3 v_position;',

    'void main () {',
        'gl_FragData[0] = vec4(v_position, 1.0);', //position
        'gl_FragData[1] = vec4(vec3(0.0, 1.0, 0.0), 1.0);', //normal
        'gl_FragData[2] = vec4(0.6, 0.6, 0.6, smoothstep(3.0, 0.0, length(v_position)));', //color
    '}'
].join('\n');


var SPHERE_DEPTH_VERTEX_SHADER_SOURCE = [
    'precision highp float;',

    'attribute vec2 a_textureCoordinates;',
    'attribute vec3 a_vertexPosition;',

    'uniform mat4 u_projectionViewMatrix;',

    'uniform sampler2D u_positionsTexture;',

    'uniform vec2 u_particleResolution;',
    'uniform float u_fadeWidth;',
    'uniform float u_respawnEndIndex;',

    'void main () {',
        'vec4 data = texture2D(u_positionsTexture, a_textureCoordinates);',

        'float index = a_textureCoordinates.y * u_particleResolution.y * u_particleResolution.x + a_textureCoordinates.x * u_particleResolution.x;',
        'if (index < u_respawnEndIndex) index += u_particleResolution.x * u_particleResolution.y;',

        'float sphereRadius = data.a * smoothstep(u_respawnEndIndex, u_respawnEndIndex + u_fadeWidth, index);',

        'vec3 position = a_vertexPosition * sphereRadius + data.rgb;',

        'gl_Position = u_projectionViewMatrix * vec4(position, 1.0);',
    '}'
].join('\n');

var SPHERE_DEPTH_FRAGMENT_SHADER_SOURCE = [
    'precision highp float;',

    'void main () {',
        'gl_FragColor = vec4(1.0);',
    '}'
].join('\n');


var SPHERE_VERTEX_SHADER_SOURCE = [
    'precision highp float;',

    'attribute vec3 a_vertexPosition;',
    'attribute vec3 a_vertexNormal;',

    'attribute vec2 a_textureCoordinates;',

    'uniform mat4 u_projectionViewMatrix;',

    'uniform sampler2D u_positionsTexture;',
    'uniform sampler2D u_velocitiesTexture;',

    'uniform vec2 u_particleResolution;',
    'uniform float u_fadeWidth;',
    'uniform float u_respawnEndIndex;',

    'varying vec3 v_position;',
    'varying vec3 v_normal;',
    'varying vec3 v_color;',

    'vec3 hsv2rgb(vec3 c) {',
        'vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);',
        'vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);',
        'return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);',
    '}',

    'vec3 speedToColor (float speed) {',
        'return hsv2rgb(vec3(0.3 + speed * 0.002, 0.7, 1.0));',
    '}',

    'void main () {',
        'vec4 data = texture2D(u_positionsTexture, a_textureCoordinates);',

        'float index = a_textureCoordinates.y * u_particleResolution.y * u_particleResolution.x + a_textureCoordinates.x * u_particleResolution.x;',
        'if (index < u_respawnEndIndex) index += u_particleResolution.x * u_particleResolution.y;',

        'float sphereRadius = data.a * smoothstep(u_respawnEndIndex, u_respawnEndIndex + u_fadeWidth, index);',

        'vec3 position = a_vertexPosition * sphereRadius + data.rgb;',

        'v_normal = a_vertexNormal;',
        'v_position = position;',

        'vec4 velocityData = texture2D(u_velocitiesTexture, a_textureCoordinates);',

        //if we're dropping then we can use the saved speed
        'float speed = velocityData.a;',

        'if (speed == 0.0) speed = length(velocityData.xyz);', //if we're vortexing then we need to calculate the speed
        'v_color = speedToColor(speed);',

        'gl_Position = u_projectionViewMatrix * vec4(position, 1.0);',
    '}'
].join('\n');

var SPHERE_FRAGMENT_SHADER_SOURCE = [
    '#extension GL_EXT_draw_buffers : require',

    'precision highp float;',

    'varying vec3 v_position;',
    'varying vec3 v_normal;',
    'varying vec3 v_color;',

    'void main () {',
        'gl_FragData[0] = vec4(v_position, 1.0);', //position
        'gl_FragData[1] = vec4(v_normal, 1.0);', //normal
        'gl_FragData[2] = vec4(v_color, 1.0);', //color
    '}'
].join('\n');



var AO_VERTEX_SHADER_SOURCE = [
    'precision highp float;',

    'attribute vec3 a_vertexPosition;',
    'attribute vec3 a_vertexNormal;',

    'attribute vec2 a_textureCoordinates;',

    'uniform mat4 u_projectionViewMatrix;',

    'uniform sampler2D u_particlePositionsTexture;',

    'varying vec3 v_spherePosition;',
    'varying float v_sphereRadius;',
    'varying float v_extrudedSphereRadius;',

    'uniform vec2 u_particleResolution;',
    'uniform float u_fadeWidth;',
    'uniform float u_respawnEndIndex;',

    'void main () {',
        'vec4 data = texture2D(u_particlePositionsTexture, a_textureCoordinates);',

        'float index = a_textureCoordinates.y * u_particleResolution.y * u_particleResolution.x + a_textureCoordinates.x * u_particleResolution.x;',
        'if (index < u_respawnEndIndex) index += u_particleResolution.x * u_particleResolution.y;',

        'float extrusionFactor = 7.5;',
        'v_sphereRadius = data.a * smoothstep(u_respawnEndIndex, u_respawnEndIndex + u_fadeWidth, index);',
        'v_extrudedSphereRadius = v_sphereRadius * extrusionFactor;',
        'v_spherePosition = data.rgb;',

        'vec3 position = a_vertexPosition * v_extrudedSphereRadius + v_spherePosition;',

        'gl_Position = u_projectionViewMatrix * vec4(position, 1.0);',
    '}'
].join('\n');

var AO_FRAGMENT_SHADER_SOURCE = [
    'precision highp float;',

    'uniform vec2 u_resolution;',

    'uniform sampler2D u_positionsTexture;',
    'uniform sampler2D u_normalsTexture;',

    'varying vec3 v_spherePosition;',
    'varying float v_sphereRadius;',

    'varying float v_extrudedSphereRadius;',

    'const float PI = 3.14159265;',

    'void main () {',
        'vec2 coordinates = gl_FragCoord.xy / u_resolution;', 
        'vec3 position = texture2D(u_positionsTexture, coordinates).rgb;', 
        'vec3 normal = texture2D(u_normalsTexture, coordinates).rgb;', 

        'vec3 pointToSphere = normalize(v_spherePosition - position);',
        'float d = distance(v_spherePosition, position);',

        'float occlusion = dot(pointToSphere, normalize(normal)) * (v_sphereRadius / d) * (v_sphereRadius / d);',
        'float falloff = clamp(1.0 - (d - v_sphereRadius) / v_extrudedSphereRadius, 0.0, 1.0);',

        'vec3 di = v_spherePosition - position;',
        'float l = length(di);',
        'float nl = dot(normal, di / l);',
        'float h = l / v_sphereRadius;',
        'float h2 = h * h;',
        'float k2 = 1.0 - h2 * nl * nl;',

        'float result = max(0.0, nl) / h2;',

        'if (k2 > 0.0) {',
            'result = nl * acos(-nl * sqrt((h2 - 1.0) / (1.0 - nl * nl))) - sqrt(k2 * (h2 - 1.0));',
            'result = result / h2 + atan(sqrt(k2 / (h2 - 1.0)));',
            'result /= PI;',
        '}',
        
        'gl_FragColor = vec4(vec3(result), 1.0);',
    '}'
].join('\n');

var FILAMENT_VERTEX_SHADER_SOURCE = [
    'precision highp float;',

    'attribute vec3 a_position;',
    'attribute vec3 a_normal;',

    'uniform mat4 u_projectionViewMatrix;',

    'varying vec3 v_position;',
    'varying vec3 v_normal;',

    'void main () {',
        'v_position = a_position;',
        'v_normal = a_normal;',
        'gl_Position = u_projectionViewMatrix * vec4(a_position, 1.0);',
    '}'
].join('\n');

var FILAMENT_FRAGMENT_SHADER_SOURCE = [
    '#extension GL_EXT_draw_buffers : require',

    'precision highp float;',

    'varying vec3 v_position;',
    'varying vec3 v_normal;',

    'void main () {',
        'gl_FragData[0] = vec4(v_position, 1.0);', //position
        'gl_FragData[1] = vec4(normalize(v_normal), 1.0);', //normal
        'gl_FragData[2] = vec4(1.0, 1.0, 0.2, 1.0);', //color
    '}'
].join('\n');

var OUTPUT_FRAGMENT_SHADER_SOURCE = [
    'precision highp float;',

    'uniform sampler2D u_positionsTexture;',
    'uniform sampler2D u_normalsTexture;',
    'uniform sampler2D u_colorsTexture;',
    'uniform sampler2D u_occlusionTexture;',

    'varying vec2 v_coordinates;',

    'uniform sampler2D u_shadowDepthTexture;',
    'uniform vec2 u_shadowResolution;',
    'uniform mat4 u_lightProjectionViewMatrix;',

    'uniform vec3 u_lightDirection;',

    'uniform float u_verticalFov;',
    'uniform vec2 u_resolution;',
    'uniform mat4 u_cameraMatrix;',

    'float saturate (float x) {',
        'return clamp(x, 0.0, 1.0);',
    '}',

    'void main () {',
        'float occlusion = texture2D(u_occlusionTexture, v_coordinates).r;',
        'vec3 position = texture2D(u_positionsTexture, v_coordinates).rgb;',
        'vec3 normal = texture2D(u_normalsTexture, v_coordinates).rgb;',
        'vec4 color = texture2D(u_colorsTexture, v_coordinates).rgba;',

        'float ambient = (1.0 - occlusion * 0.7);',

        'vec4 lightSpacePosition = u_lightProjectionViewMatrix * vec4(position, 1.0);',
        'lightSpacePosition /= lightSpacePosition.w;',
        'lightSpacePosition *= 0.5;',
        'lightSpacePosition += 0.5;',
        'vec2 lightSpaceCoordinates = lightSpacePosition.xy;',
        

        'float shadow = 1.0;',
        'const int PCF_WIDTH = 2;',
        'const float PCF_NORMALIZATION = float(PCF_WIDTH * 2 + 1) * float(PCF_WIDTH * 2 + 1);',

        'for (int xOffset = -PCF_WIDTH; xOffset <= PCF_WIDTH; ++xOffset) {',
            'for (int yOffset = -PCF_WIDTH; yOffset <= PCF_WIDTH; ++yOffset) {',
                'float shadowSample = texture2D(u_shadowDepthTexture, lightSpaceCoordinates + vec2(float(xOffset), float(yOffset)) / u_shadowResolution).r;',
                'if (lightSpacePosition.z > shadowSample + 0.001) shadow -= 1.0 / PCF_NORMALIZATION;',
            '}',
        '}',

        'float direct = shadow;',

        'vec3 outputColor = color.rgb * vec3(ambient * 0.5 + direct * 0.5);',


        'float horizontalFov = u_verticalFov * u_resolution.x / u_resolution.y;',
        'vec3 rayDirection = normalize(vec3(',
            '(v_coordinates.x * 2.0 - 1.0) * tan(horizontalFov / 4.0),',
             '(v_coordinates.y * 2.0 - 1.0) * tan(u_verticalFov / 4.0),',
             '-1.0',
         '));',

        'rayDirection = mat3(u_cameraMatrix) * rayDirection;',

        'vec3 backgroundColor = vec3(0.8 + pow(saturate(dot(rayDirection, -u_lightDirection)), 1.5) * 0.2);',

        'gl_FragColor = vec4(mix(backgroundColor, outputColor, color.a), 1.0);',
    '}'
].join('\n');

var FULLSCREEN_VERTEX_SHADER_SOURCE = [
    'precision highp float;',

    'attribute vec2 a_position;',

    'varying vec2 v_coordinates;',

    'void main () {',
        'v_coordinates = a_position * 0.5 + 0.5;',
        'gl_Position = vec4(a_position, 0.0, 1.0);',
    '}'
].join('\n');

var ADVECT_FRAGMENT_SHADER_SOURCE = [
    //MAX_FILAMENTS and VERTICES_PER_FILAMENT must be defined

    '#extension GL_EXT_draw_buffers : require',

    'precision highp float;',

    'uniform sampler2D u_positionsTexture;', //xyz is position, w is radius
    'uniform sampler2D u_velocitiesTexture;', //xyz is velocity, w is 0 when vortexing and the speed at moment of drop
    'uniform sampler2D u_filamentsTexture;',

    'uniform sampler2D u_spawnPositionsTexture;',

    //ranges includes start index but not end index
    'uniform float u_respawnStartIndex;',
    'uniform float u_respawnEndIndex;',

    'uniform vec2 u_positionsResolution;',
    'uniform vec2 u_filamentsResolution;',

    'uniform int u_dropping;',

    'uniform float u_speedScale;',

    'uniform float u_emissionT;', //0 at moment of new filament emission to 1 just before next filament gets emitted

    'uniform vec3 u_cameraPosition;',
    'uniform vec3 u_mouseDirection;',
    'uniform vec2 u_mouseVelocity;',
    'uniform vec3 u_cameraUp;',
    'uniform vec3 u_cameraRight;',

    'float squaredLength (vec3 v) {',
        'return v.x * v.x + v.y * v.y + v.z * v.z;',
    '}',

    'vec3 velocityFromFilament (vec3 filamentStart, vec3 filamentEnd, vec3 position, float a) {',
        'vec3 gamma0 = filamentStart - position;',
        'vec3 gamma1 = filamentEnd - position;',

        'float dotProduct = dot(gamma0, gamma1);',

        'float numerator = (dotProduct - squaredLength(gamma0)) / sqrt(a * a + squaredLength(gamma0)) + (dotProduct - squaredLength(gamma1)) / sqrt(a * a + squaredLength(gamma1));',
        'float denominator = a * a * squaredLength(gamma1 - gamma0) + squaredLength(cross(gamma1, gamma0));',

        'denominator = max(denominator, 0.000001);',

        'return cross(gamma1, gamma0) * (-numerator / denominator);',
    '}',

    'void main () {',
        'vec2 positionsCoordinates = gl_FragCoord.xy / u_positionsResolution;',

        'vec4 oldData = texture2D(u_positionsTexture, positionsCoordinates);',
        'vec3 oldPosition = oldData.rgb;',

        'vec3 totalVelocity = vec3(0.0);',

        'for (int j = 0; j < MAX_FILAMENTS; ++j) {',
            'float yCoordinate = (float(j) + 0.5) / float(MAX_FILAMENTS);',

            'float factor = 1.0;',
            'if (j == MAX_FILAMENTS - 1) factor = smoothstep(0.0, 0.1, u_emissionT);', //newest emitted filament
            'if (j == 0) factor = smoothstep(1.0, 0.6, u_emissionT);', //next filament to die

            'for (int i = 0; i < VERTICES_PER_FILAMENT; ++i) {',
                'vec4 filamentStart = texture2D(u_filamentsTexture, vec2((float(i) + 0.5) / float(VERTICES_PER_FILAMENT), yCoordinate));',
                'vec4 filamentEnd = texture2D(u_filamentsTexture, vec2((mod(float(i + 1), float(VERTICES_PER_FILAMENT)) + 0.5) / float(VERTICES_PER_FILAMENT), yCoordinate));',

                'float smoothingRadius = filamentStart.w;', //this assumes all the vertices of the same filament have the same smoothing radius

                'totalVelocity += velocityFromFilament(filamentStart.xyz, filamentEnd.xyz, oldPosition, smoothingRadius) * factor;',
            '}',
        '}',

        'vec3 newPosition = vec3(0.0);',
        'vec4 newVelocity = vec4(0.0);',

        'float index = gl_FragCoord.y * u_positionsResolution.x + gl_FragCoord.x;',
        'float total = u_positionsResolution.x * u_positionsResolution.y;',

        'vec4 oldVelocity = texture2D(u_velocitiesTexture, positionsCoordinates);',

        'if (oldVelocity.w > 0.0) {', //if we're dropping
            'newPosition = oldPosition + oldVelocity.xyz * u_speedScale;',

            'if (newPosition.y < oldData.w) {',
                'newPosition.y = oldData.w;',
                'oldVelocity.xz *= 0.98;',
            '}',

            'newVelocity.xyz = oldVelocity.xyz + vec3(0.0, -3.0, 0.0);',
            'newVelocity.w = oldVelocity.w;',
        '} else {', //vortexing
            'newPosition = oldPosition + totalVelocity * u_speedScale;',
            'newVelocity.xyz = totalVelocity;',
        '}',

        'bool dropping = u_dropping == 1;',        

        'vec3 droppingVelocity = oldVelocity.xyz;',

        'float distanceToMouseRay = length(cross(u_mouseDirection, oldPosition - u_cameraPosition));',

        'if (distanceToMouseRay < 0.01) {',
            'dropping = true;',
            'vec3 shedVelocity = u_mouseVelocity.x * u_cameraRight + u_mouseVelocity.y * u_cameraUp;',
            'droppingVelocity += shedVelocity * 2500000.0;',
        '}',

        'if (dropping && oldVelocity.w == 0.0) {', //make sure we don't drop twice
            'newVelocity.xyz = droppingVelocity;',
            'newVelocity.w = length(oldVelocity);', //put into drop state and remember speed at drop
        '}',

        'if (index >= u_respawnStartIndex && index < u_respawnEndIndex) {',
            'vec3 spawnPosition = texture2D(u_spawnPositionsTexture, positionsCoordinates).rgb;',
            'newPosition = spawnPosition;',
            'newVelocity.w = 0.0;', //reset drop state
        '}',

        'gl_FragData[0] = vec4(newPosition, oldData.w);',
        'gl_FragData[1] = vec4(newVelocity);',
    '}'
].join('\n');

var FXAA_FRAGMENT_SHADER_SOURCE = [
    'precision highp float;',

    'varying vec2 v_coordinates;',

    'uniform sampler2D u_input;',

    'uniform vec2 u_resolution;',

    'const float FXAA_SPAN_MAX = 8.0;',
    'const float FXAA_REDUCE_MUL = 1.0 / 8.0;',
    'const float FXAA_REDUCE_MIN = 1.0 / 128.0;',
     
    'void main () {',
        'vec2 delta = 1.0 / u_resolution;',

        'vec3 rgbNW = texture2D(u_input, v_coordinates + vec2(-1.0, -1.0) * delta).rgb;',
        'vec3 rgbNE = texture2D(u_input, v_coordinates + vec2(1.0, -1.0) * delta).rgb;',
        'vec3 rgbSW = texture2D(u_input, v_coordinates + vec2(-1.0, 1.0) * delta).rgb;',
        'vec3 rgbSE = texture2D(u_input, v_coordinates + vec2(1.0, 1.0) * delta).rgb;',
        'vec3 rgbM = texture2D(u_input, v_coordinates).rgb;',

        'vec3 luma = vec3(0.299, 0.587, 0.114);',
        'float lumaNW = dot(rgbNW, luma);',
        'float lumaNE = dot(rgbNE, luma);',
        'float lumaSW = dot(rgbSW, luma);',
        'float lumaSE = dot(rgbSE, luma);',
        'float lumaM  = dot(rgbM,  luma);',

        'float lumaMin = min(lumaM, min(min(lumaNW, lumaNE), min(lumaSW, lumaSE)));',
        'float lumaMax = max(lumaM, max(max(lumaNW, lumaNE), max(lumaSW, lumaSE)));',

        'vec2 dir;',
        'dir.x = -((lumaNW + lumaNE) - (lumaSW + lumaSE));',
        'dir.y =  ((lumaNW + lumaSW) - (lumaNE + lumaSE));',

        'float dirReduce = max((lumaNW + lumaNE + lumaSW + lumaSE) * (0.25 * FXAA_REDUCE_MUL), FXAA_REDUCE_MIN);',
        'float rcpDirMin = 1.0/(min(abs(dir.x), abs(dir.y)) + dirReduce);',
        'dir = min(vec2(FXAA_SPAN_MAX),  max(vec2(-FXAA_SPAN_MAX), dir * rcpDirMin)) * delta.xy;',

        'vec3 rgbA = 0.5 * (texture2D(u_input, v_coordinates.xy + dir * (1.0 / 3.0 - 0.5)).xyz + texture2D(u_input, v_coordinates.xy + dir * (2.0 / 3.0 - 0.5)).xyz);',
        'vec3 rgbB = rgbA * 0.5 + 0.25 * (texture2D(u_input, v_coordinates.xy + dir * -0.5).xyz + texture2D(u_input, v_coordinates.xy + dir * 0.5).xyz);',
        'float lumaB = dot(rgbB, luma);',
        'if((lumaB < lumaMin) || (lumaB > lumaMax)) {',
            'gl_FragColor = vec4(rgbA, 1.0);',
        '} else {',
            'gl_FragColor = vec4(rgbB, 1.0);',
        '}',
    '}',
].join('\n');