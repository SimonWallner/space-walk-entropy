// sampling on a line
var LinearSampler = function() {
	var domain = {min: 0, max: 1};
	var numSamples = 4;

	var upperLimits = [0.25, 0.5, 0.75, 1];
	var lowerLimits = [0, 0.25, 0.5, 0.75];

	this.getID = function(x) {
		
		for (var i = 0; i < upperLimits.length; i++) {
			if (x <= upperLimits[i]) {
				return i.toString();
			}
		}

		return 'id-not-found';
	}

	this.getAllIDs = function() {
		return upperLimits.map(function(limit) {
			return this.getID(limit);
		})
	}

	this.getPaths = function() {
		var paths = [];
		for (var i = 0; i < upperLimits.length; i++) {
			var path = [
				{x: lowerLimits[i], y: 1},
				{x: lowerLimits[i], y: 0},
				{x: upperLimits[i], y: 0},
				{x: upperLimits[i], y: 1}
			];
			paths.push(path);
		}
		return paths;
	}

	this.getSites = function() {
		var sites = [];
		for (var i = 0; i < upperLimits.length; i++) {
			sites.push(lowerLimits[i] + ((upperLimits[i] - lowerLimits[i]) / 2));
		}
	}
}