'use strict'

var mod = function (x, n) { //positive modulo
    var m = x % n;
    return m < 0 ? m + n : m;
};

var evaluateCubicSpline = function (outPoint, t, startPoint, endPoint, startTangent, endTangent) {
    var t2 = t * t;
    var t3 = t * t * t;

    for (var l = 0; l < 3; ++l) {
        outPoint[l] = (2 * t3 - 3 * t2 + 1) * startPoint[l] + (t3 - 2 * t2 + t) * startTangent[l] + (-2 * t3 + 3 * t2) * endPoint[l] + (t3 - t2) * endTangent[l];
    }
    
    return outPoint;
};

var evaluateCubicSplineTangent = function (outTangent, t, startPoint, endPoint, startTangent, endTangent) {
    var t2 = t * t;

    for (var l = 0; l < 3; ++l) {
        outTangent[l] = (6 * t2 - 6 * t) * startPoint[l] + (3 * t2 - 4 * t + 1) * startTangent[l] + (-6 * t2 + 6 * t) * endPoint[l] + (3 * t2 - 2 * t) * endTangent[l];
    }
    
    return outTangent;
};

var UP_DIRECTION = [0, 1, 0];
var CIRCLE_SEGMENTS = 5;
var SPLINE_ALPHA = 0.5; //centripetal catmull rom spline
var SPLINE_SUBDIVISIONS = 5; //centripetal catmull rom spline subdivisions

var FilamentsGeometry = function (verticesPerFilament) {
    //cache to avoid garbage collection
    var temp = [];
    var surfacePoint = [], surfaceNormal = [];
    var circleUp = [], circleRight = [];
    var startTangent = [], endTangent = [];
    var filamentPoint = [], filamentTangent = [];


    this.vertexData = new Float32Array(MAX_FILAMENTS * verticesPerFilament * SPLINE_SUBDIVISIONS * CIRCLE_SEGMENTS * 3);
    this.normalData = new Float32Array(MAX_FILAMENTS * verticesPerFilament * SPLINE_SUBDIVISIONS * CIRCLE_SEGMENTS * 3);

    var POINTS_PER_FILAMENT = verticesPerFilament * SPLINE_SUBDIVISIONS; //subdivided points along each filament (around which each circle is formed)
    this.indices = new Uint16Array(MAX_FILAMENTS * POINTS_PER_FILAMENT * CIRCLE_SEGMENTS * 6);

    this.generate = function (filamentSystem) {
        var filaments = filamentSystem.filaments;
        var filamentIndexData = this.indexData = [];

        var baseIndex = 0;

        var vertexIndex = 0;
        var normalIndex = 0;
        var indicesIndex = 0;

        for (var i = 0; i < MAX_FILAMENTS; ++i) { //for each filament
            var filamentVertices = filaments[i].vertices;

            var subdividedFilamentPoints = [];
            var subdividedFilamentTangents = [];

            var filamentTubeRadius = FILAMENT_GEOMETRY_RADIUS_SCALE * filaments[i].smoothingRadius;
            if (i === 0) { //shrink out the next filament to be destroyed
                filamentTubeRadius *= smoothstep(1.0, 0.5, filamentSystem.getEmissionT());
            }

            var indicesInBatch = 0;

            for (var j = 0; j < verticesPerFilament; ++j) { //for each filament segment going from point j to point j + 1
                var point0 = filamentVertices[mod(j - 1, verticesPerFilament)],
                    point1 = filamentVertices[mod(j + 0, verticesPerFilament)],
                    point2 = filamentVertices[mod(j + 1, verticesPerFilament)],
                    point3 = filamentVertices[mod(j + 2, verticesPerFilament)];

                var t0 = 0,
                    t1 = t0 + Math.pow(distanceBetweenVectors(point0, point1), SPLINE_ALPHA),
                    t2 = t1 + Math.pow(distanceBetweenVectors(point1, point2), SPLINE_ALPHA),
                    t3 = t2 + Math.pow(distanceBetweenVectors(point2, point3), SPLINE_ALPHA);

                var startPoint = point1;
                var endPoint = point2;
                
                for (var k = 0; k < 3; ++k) {
                    startTangent[k] = (point1[k] - point0[k]) / (t1 - t0) - (point2[k] - point0[k]) / (t2 - t0) + (point2[k] - point1[k]) / (t2 - t1);
                    endTangent[k] = (point2[k] - point1[k]) / (t2 - t1) - (point3[k] - point1[k]) / (t3 - t1) + (point3[k] - point2[k]) / (t3 - t2);
                
                    startTangent[k] *= (t2 - t1);
                    endTangent[k] *= (t2 - t1);
                }

                for (var k = 0; k < SPLINE_SUBDIVISIONS; ++k) {
                    evaluateCubicSpline(filamentPoint, k / SPLINE_SUBDIVISIONS, startPoint, endPoint, startTangent, endTangent);
                    evaluateCubicSplineTangent(filamentTangent, k / (SPLINE_SUBDIVISIONS - 1), startPoint, endPoint, startTangent, endTangent);
                
                    if (filamentPoint[1] < filamentTubeRadius) {
                        filamentPoint[1] = filamentTubeRadius;
                    }

                    normalizeVector(circleUp, crossVectors(temp, filamentTangent, UP_DIRECTION));
                    normalizeVector(circleRight, crossVectors(circleRight, circleUp, filamentTangent));

                    for (var l = 0; l < CIRCLE_SEGMENTS; ++l) {
                        var angle = (l / CIRCLE_SEGMENTS) * Math.PI * 2.0;

                        var circleX = Math.cos(angle) * filamentTubeRadius;
                        var circleY = Math.sin(angle) * filamentTubeRadius;

                        var normal = [];
                        for (var m = 0; m < 3; ++m) {
                            normal[m] = circleX * circleRight[m] + circleY * circleUp[m];
                        }

                        addVectors(surfacePoint, filamentPoint, normal);
                        multiplyVectorByScalar(surfaceNormal, normal, 1.0 / filamentTubeRadius); //normalize

                        this.vertexData[vertexIndex] = surfacePoint[0];
                        this.vertexData[vertexIndex + 1] = surfacePoint[1];
                        this.vertexData[vertexIndex + 2] = surfacePoint[2];
                        vertexIndex += 3;

                        this.normalData[normalIndex] = surfaceNormal[0];
                        this.normalData[normalIndex + 1] = surfaceNormal[1];
                        this.normalData[normalIndex + 2] = surfaceNormal[2];
                        normalIndex += 3;

                        indicesInBatch++;
                    }
                }
            }

            for (var filamentX = 0; filamentX < POINTS_PER_FILAMENT; ++filamentX) {
                for (var filamentY = 0; filamentY < CIRCLE_SEGMENTS; ++filamentY) {
                
                    var bottomLeftIndex = baseIndex + filamentX * CIRCLE_SEGMENTS + filamentY;
                    var topLeftIndex = baseIndex + filamentX * CIRCLE_SEGMENTS + (filamentY + 1) % CIRCLE_SEGMENTS;
                    var bottomRightIndex = baseIndex + ((filamentX + 1) % POINTS_PER_FILAMENT) * CIRCLE_SEGMENTS + filamentY;
                    var topRightIndex = baseIndex + ((filamentX + 1) % POINTS_PER_FILAMENT) * CIRCLE_SEGMENTS + (filamentY + 1) % CIRCLE_SEGMENTS;

                    this.indices[indicesIndex + 0] = bottomLeftIndex;
                    this.indices[indicesIndex + 1] = bottomRightIndex;
                    this.indices[indicesIndex + 2] = topRightIndex;

                    this.indices[indicesIndex + 3] = topRightIndex;
                    this.indices[indicesIndex + 4] = topLeftIndex;
                    this.indices[indicesIndex + 5] = bottomLeftIndex;

                    indicesIndex += 6;
                }
            }

            baseIndex += indicesInBatch;
        }
    };
};