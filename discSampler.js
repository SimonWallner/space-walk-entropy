// sampling on a disc
var DiscSampler = function() {

	var divisions = 5;

	this.getID = function(x, y) {
		if (y === undefined) { // passing in an object instead of coords...
			y = x.y;
			x = x.x;
		}

		// simple grid based sampling
		// map [-1, 1] to discrete [0, 4]
		var idX = Math.min(divisions - 1, Math.floor(map(-1, 1, 0, divisions, x)));
		var idy = Math.min(divisions - 1, Math.floor(map(-1, 1, 0, divisions, y)));

		return idX.toString() + idy.toString();
	}

	this.getPaths = function() {
		var paths = [];
		var inc = 2 / divisions;
		for (var i = 0; i < divisions; i++) {
			for (var j = 0; j < divisions; j++) {
				paths.push([
					{x: -1 + i * inc, 		y: -1 + j * inc},
					{x: -1 + i * inc, 		y: -1 + (j + 1) * inc},
					{x: -1 + (i + 1) * inc, y: -1 + (j + 1) * inc},
					{x: -1 + (i + 1) * inc, y: -1 + j * inc}
				])
			}
		}
		return paths;
	}

	// utils

	// map x from [a, b] to [r, s]
	var map = function(a, b, r, s, x) {
		var t = (x - a) / (b - a);
		return r + (t * s - r);
	}
}