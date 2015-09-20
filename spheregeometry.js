'use strict'

var SphereGeometry = function () {
	var generateSphereGeometry = function (iterations, outSphereVertices, outSphereNormals, outSphereIndices) {
	    var vertices = [],
	        normals = [],
	        indices = [];

	    var compareVectors = function (a, b) {
	        var EPSILON = 0.001;
	        return Math.abs(a[0] - b[0]) < EPSILON && Math.abs(a[1] - b[1]) < EPSILON && Math.abs(a[2] - b[2]) < EPSILON;
	    };

	    var addVertex = function (v) {
	        normalizeVector(v, v);
	        vertices.push(v);
	        normals.push(v);
	    };

	    var getMiddlePoint = function (vertexA, vertexB) {
	        var middle = [
	            (vertexA[0]+ vertexB[0]) / 2,
	            (vertexA[1]+ vertexB[1]) / 2,
	            (vertexA[2]+ vertexB[2]) / 2
	        ];
	        normalizeVector(middle, middle);

	        for (var i = 0; i < vertices.length; ++i) {
	            if (compareVectors(vertices[i], middle)) {
	                return i;
	            }
	        }

	        addVertex(middle);
	        return (vertices.length - 1);
	    };


	    var t = (1.0 + Math.sqrt(5.0)) / 2.0;

	    addVertex([-1, t, 0]);
	    addVertex([1, t, 0]);
	    addVertex([-1, -t, 0]);
	    addVertex([1, -t, 0]);

	    addVertex([0, -1, t]);
	    addVertex([0, 1, t]);
	    addVertex([0, -1, -t]);
	    addVertex([0, 1, -t]);

	    addVertex([t, 0, -1]);
	    addVertex([t, 0, 1]);
	    addVertex([-t, 0, -1]);
	    addVertex([-t, 0, 1]);


	    var faces = [];
	    faces.push([0, 11, 5]);
	    faces.push([0, 5, 1]);
	    faces.push([0, 1, 7]);
	    faces.push([0, 7, 10]);
	    faces.push([0, 10, 11]);

	    faces.push([1, 5, 9]);
	    faces.push([5, 11, 4]);
	    faces.push([11, 10, 2]);
	    faces.push([10, 7, 6]);
	    faces.push([7, 1, 8]);

	    faces.push([3, 9, 4]);
	    faces.push([3, 4, 2]);
	    faces.push([3, 2, 6]);
	    faces.push([3, 6, 8]);
	    faces.push([3, 8, 9]);

	    faces.push([4, 9, 5]);
	    faces.push([2, 4, 11]);
	    faces.push([6, 2, 10]);
	    faces.push([8, 6, 7]);
	    faces.push([9, 8, 1]);


	    for (var i = 0; i < iterations; ++i) {
	        var faces2 = [];

	        for (var i = 0; i < faces.length; ++i) {
	            var face = faces[i];
	            // replace triangle by 4 triangles
	            var a = getMiddlePoint(vertices[face[0]], vertices[face[1]]);
	            var b = getMiddlePoint(vertices[face[1]], vertices[face[2]]);
	            var c = getMiddlePoint(vertices[face[2]], vertices[face[0]]);

	            faces2.push([face[0], a, c]);
	            faces2.push([face[1], b, a]);
	            faces2.push([face[2], c, b]);
	            faces2.push([a, b, c]);
	            
	        }

	        faces = faces2;
	    }

	    outSphereVertices.length = 0;
	    outSphereNormals.length = 0;
	    outSphereIndices.length = 0;
	    for (var i = 0; i < vertices.length; ++i) {
	        outSphereVertices.push(vertices[i][0]);
	        outSphereVertices.push(vertices[i][1]);
	        outSphereVertices.push(vertices[i][2]);

	        outSphereNormals.push(normals[i][0]);
	        outSphereNormals.push(normals[i][1]);
	        outSphereNormals.push(normals[i][2]);
	    }

	    for (var i = 0; i < faces.length; ++i) {
	        var face = faces[i];
	        outSphereIndices.push(face[0]);
	        outSphereIndices.push(face[1]);
	        outSphereIndices.push(face[2]);
	    }
	}

	var sphereVertices = [],
	    sphereNormals = [],
	    sphereIndices = [];
	generateSphereGeometry(3, sphereVertices, sphereNormals, sphereIndices);

	this.vertices = sphereVertices;
	this.normals = sphereNormals;
	this.indices = sphereIndices;
}