// sampling on a line
var LinearSampler = function() {
	var domain = {min: 0, max: 1};
	var numSamples = 4;

	var upperLimits = [0.1111111, 0.2222222, 0.333333, 0.444444, 0.555555, 0.666666, 0.777777, 0.888888, 1];
	var lowerLimits = [0, 0.1111111, 0.2222222, 0.333333, 0.444444, 0.555555, 0.666666, 0.777777, 0.888888];

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
			paths.push({
				path: path,
				id: i});
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
