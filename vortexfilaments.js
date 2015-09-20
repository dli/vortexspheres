'use strict'

var Filament = function (vertices, smoothingRadius, dummy) {
    this.vertices = vertices;

    this.active = true; //if this filament is still vortexing (if it's not then it's dropping)
    this.vertexVelocities = [];
    for (var i = 0; i < vertices.length; ++i) {
        this.vertexVelocities[i] = [];
    }

    this.smoothingRadius = smoothingRadius;

    this.dummy = dummy; //whether this is just a dummy filament to make up the numbers
};


var gamma0 = [], gamma1 = [], gamma1CrossGamma0 = [], temp = []; //these are to minimize garbage collection
var computeVelocityFromFilament = function (outVelocity, filamentStart, filamentEnd, position, a) { //computes the induced velocity from a filament for a certain position
    subtractVectors(gamma0, filamentStart, position);
    subtractVectors(gamma1, filamentEnd, position);

    var dotProduct = dotVectors(gamma0, gamma1);
    var gamma0MagnitudeSquared = squaredMagnitudeOfVector(gamma0);
    var gamma1MagnitudeSquared = squaredMagnitudeOfVector(gamma1);
    var a2 = a * a;
    crossVectors(gamma1CrossGamma0, gamma1, gamma0)

    var numerator = (dotProduct - gamma0MagnitudeSquared) / Math.sqrt(a2 + gamma0MagnitudeSquared) + (dotProduct - gamma1MagnitudeSquared) / Math.sqrt(a2 + gamma1MagnitudeSquared);
    var denominator = a2 * squaredMagnitudeOfVector(subtractVectors(temp, gamma1, gamma0)) + squaredMagnitudeOfVector(gamma1CrossGamma0);

    return multiplyVectorByScalar(outVelocity, gamma1CrossGamma0, -numerator / denominator);
};

var velocityFromFilament = [];
var computeVelocityFromFilamentVertices = function (filamentVertices, smoothingRadius, position) {
    var totalVelocity = [0, 0, 0];

    for (var i = 0; i < filamentVertices.length; ++i) {
        var startVertex = filamentVertices[i];
        var endVertex = filamentVertices[(i + 1) % filamentVertices.length];

        computeVelocityFromFilament(velocityFromFilament, startVertex, endVertex, position, smoothingRadius);
        addVectors(totalVelocity, totalVelocity, velocityFromFilament);
    }

    return totalVelocity;
}

var computeVelocityFromFilaments = function (outTotalVelocity, filaments, position) {
    outTotalVelocity[0] = 0;
    outTotalVelocity[1] = 0;
    outTotalVelocity[2] = 0;

    for (var i = 0; i < filaments.length; ++i) {
        if (filaments[i].active) {
            var filamentVertices = filaments[i].vertices;

            var velocity = computeVelocityFromFilamentVertices(filamentVertices, filaments[i].smoothingRadius, position);
            addVectors(outTotalVelocity, outTotalVelocity, velocity);
        }
    }

    return outTotalVelocity;
};

var FilamentSystem = function (verticesPerFilament, initialVariation, initialRadius) {
	//an array of filaments
	var filaments = this.filaments = [];

	var filamentVariation = initialVariation;
	this.setFilamentVariation = function (variation) {
		filamentVariation = variation;
	}

	var smoothingRadius = initialRadius;
	this.setSmoothingRadius = function (radius) {
		smoothingRadius = radius;
	}

	var addFilament = function () {
	    var filamentVertices = [];
	    var radius = FILAMENT_RADIUS;

	    for (var j = 0; j < verticesPerFilament; ++j) {
	        var angle = j * (2 * Math.PI / verticesPerFilament);
	        filamentVertices.push([
	            Math.cos(angle) * radius + (Math.random() * 2.0 - 1.0) * filamentVariation,
	            (Math.random() * 2.0 - 1.0) * filamentVariation,
	            Math.sin(angle) * radius + (Math.random() * 2.0 - 1.0) * filamentVariation
	        ]);
	    }

	    filaments.push(new Filament(filamentVertices, smoothingRadius, false));
	    filaments.splice(0, 1);
	};

	var framesToNextEmission = FRAMES_BETWEEN_EMISSIONS;

	for (var i = 0; i < MAX_FILAMENTS; ++i) {
	    var dummyFilamentVertices = [];
	    var radius = FILAMENT_RADIUS;

	    for (var j = 0; j < verticesPerFilament; ++j) {
	        var angle = j * (2 * Math.PI / verticesPerFilament);
	        dummyFilamentVertices.push([
	            Math.cos(angle) * radius,
	            999999999.0,
	            Math.sin(angle) * radius
	        ]);
	    }
	    filaments.push(new Filament(dummyFilamentVertices, 999999999.0, true));
	}
	addFilament();


	var GRAVITY = [0.0, -0.0001, 0.0];
	var FRICTION = 0.98;

	var totalVelocityFromFilaments = [];

	this.filamentData = new Float32Array(MAX_FILAMENTS * verticesPerFilament * 4);

	//advect filaments themselves
	this.simulate = function () {
	    if (framesToNextEmission === 0) {
	        addFilament();
	        framesToNextEmission = FRAMES_BETWEEN_EMISSIONS;
	    }
	    framesToNextEmission -= 1;

	    for (var i = 0; i < filaments.length; ++i) {
	        var filamentVertices = filaments[i].vertices;
	        if (!filaments[i].dummy) {
	            if (filaments[i].active) { //vortexing
	                for (var j = 0; j < filamentVertices.length; ++j) {
	                    computeVelocityFromFilaments(totalVelocityFromFilaments, filaments, filamentVertices[j]);
	                    multiplyVectorByScalar(totalVelocityFromFilaments, totalVelocityFromFilaments, SPEED_SCALE);

	                    //addVectors(totalVelocity, totalVelocity, [0, 0.001, 0]);
	                    addVectors(filamentVertices[j], filamentVertices[j], totalVelocityFromFilaments);

	                    copyVector(filaments[i].vertexVelocities[j], totalVelocityFromFilaments);
	                }
	            } else { //dropping
	                 for (var j = 0; j < filamentVertices.length; ++j) {
	                    addVectors(filamentVertices[j], filamentVertices[j], filaments[i].vertexVelocities[j]);
	                    addVectors(filaments[i].vertexVelocities[j], filaments[i].vertexVelocities[j], GRAVITY);

	                    if (filamentVertices[j][1] < FILAMENT_GEOMETRY_RADIUS_SCALE * filaments[i].smoothingRadius) {
	                        filamentVertices[j][1] = FILAMENT_GEOMETRY_RADIUS_SCALE * filaments[i].smoothingRadius;
	                        filaments[i].vertexVelocities[j][0] *= FRICTION;
	                        filaments[i].vertexVelocities[j][2] *= FRICTION;
	                        filaments[i].vertexVelocities[j][1] = 0;
	                    }
	                }
	            }
	        }
	    }



	    for (var i = 0; i < MAX_FILAMENTS; ++i) {
	        if (i < filaments.length && filaments[i].active) {
	            var filamentVertices = filaments[i].vertices;
	            for (var j = 0; j < verticesPerFilament; ++j) {
	                this.filamentData[(i * verticesPerFilament + j) * 4 + 0] = filamentVertices[j][0];
	                this.filamentData[(i * verticesPerFilament + j) * 4 + 1] = filamentVertices[j][1];
	                this.filamentData[(i * verticesPerFilament + j) * 4 + 2] = filamentVertices[j][2];
	                this.filamentData[(i * verticesPerFilament + j) * 4 + 3] = filaments[i].smoothingRadius;
	            }
	        } else {
	            for (var j = 0; j < verticesPerFilament; ++j) {
	                this.filamentData[(i * verticesPerFilament + j) * 4 + 0] = 0;
	                this.filamentData[(i * verticesPerFilament + j) * 4 + 1] = 0;
	                this.filamentData[(i * verticesPerFilament + j) * 4 + 2] = 0;
	                this.filamentData[(i * verticesPerFilament + j) * 4 + 3] = 0;
	            }
	        }
	    }
	    
	};


	this.getEmissionT = function () {
		return 1.0 - (framesToNextEmission / FRAMES_BETWEEN_EMISSIONS);
	};

	this.drop = function () {
		for (var i = 0; i < filaments.length; ++i) {
	        filaments[i].active = false;
	    }
	};
};