// TODO 
// avoid missing high f events when sampling the current sample
//		accumulate conservatively instead...


// monkey patch
Math.log2 = Math.log2 || function(a) { return Math.log(a) / Math.LN2; };


var libsw = new LibSpaceWalk();

var windowLengths = [15, 30, 60, 120, 240];
var mc = [];
for (var i = 0; i < windowLengths.length; i++) {
	mc[i] = new MarkovChain();
}

var samplingF = 100; // ms

var historyData = [];
for (var i = 0; i < windowLengths.length; i++) {
	historyData[i] = [];
}
var maxHistoryLength = 120;
var maxInformation = 1; // bits

// reserving space for up to 16 buttons
var currentSample = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
var lastSample = currentSample;

window.onload = function() {
	window.setInterval(function() {
		sample();
		truncateHistory();
		updateGraph();
	}, samplingF);
}


libsw.onMessage = function(data) {
	if (data.type === "ext.input.gamePad.sample") {
		if (data.payload.type === 'digital') {
			currentSample[data.payload.buttonNumber] = data.payload.value;
		}
	}
}

var sample = function() {
	var currentStateID = generateId(currentSample);
	var lastStateID = generateId(lastSample);

	for (var i = 0; i < windowLengths.length; i++) {
		mc[i].learn(lastStateID, currentStateID);
		var p = mc[i].p(lastStateID, currentStateID);
		var info = selfInformation(p);

		historyData[i].push(info);
		maxInformation = Math.max(maxInformation, info);

		mc[i].truncate(windowLengths[i]);
	}

	lastSample = currentSample.slice(0); // force copy
}


var updateGraph = function() {


	for (var i = 0; i < mc.length; i++) {
		var bits = d3.select('#info' + windowLengths[i]).selectAll('.bit').data(historyData[i]);
		bits.enter()
			.append('div')
				.attr('class', 'bit')
		bits
			.style('transform', function(d) {return 'scale(1, ' + Math.max(0.05, d / maxInformation) + ')';});


		// $('#markov-value').text(historyData[historyData.length-1].toFixed(2));
		// // $('#markov-bar').width(200 * (historyData[historyData.length-1] / maxInformation));	
		// $('#maxValue').text(maxInformation.toFixed(2));
	}


	// // gaussian
	// var kernel = gaussian(9)
	// var gaussianFiltered = filter(historyData, kernel);
	// bits = d3.select('#gaussianBits').selectAll('.bit').data(gaussianFiltered);
	// bits.enter()
	// 	.append('div')
	// 		.attr('class', 'bit')
	// bits
	// 	.style('transform', function(d) {return 'scale(1, ' + Math.max(0.05, d / maxInformation) + ')';});


	// // entropy
	// var entropy = mm[0].entropy();
	// entropyHistoryData.push(entropy);
	// maxEntropy = Math.max(maxEntropy, entropy);

	// bits = d3.select('#entropyBits').selectAll('.bit').data(entropyHistoryData);
	// bits.enter()
	// 	.append('div')
	// 		.attr('class', 'bit')
	// bits
	// 	.style('transform', function(d) {return 'scale(1, ' + Math.max(0.05, d / maxEntropy) + ')';});

	// $('#maxEntropy').text(maxEntropy.toFixed(2));
}


var truncateHistory = function() {
	for (var i = 0; i < historyData.length; i++)
	if (historyData[i].length > maxHistoryLength) {
		historyData[i] = historyData[i].splice(historyData[i].length - maxHistoryLength);
	}
}



var selfInformation = function(prop) {
	if (prop === 0) {
		return 0;
	}

	return Math.log2(1 / prop);
}

var generateId = function(arr) {
	return arr.reduce(function(prev, current) {
		return prev + current;
	}, '');
}

// ================================= util ================================

// create a linear space of size 'size' spanning [a, b]
// the first element is a, the last is b
function linspace(a, b, size) {
	var result = [];
	for (var i = 0; i < size; i++) {
		var t = i / (size - 1);
		result[i] = (a * (1 - t) + b * t);
	}

	return result;
}

// half sided gaussian bell curve, with 0 at [0] and the max at [size-1]
// non normalised
function leftGaussian(size) {
	var ls = linspace(0, 1, size);
	var sigma = 1/3; // going to 6 sigma width
	var gaussian = ls.map(function(x) {
		return Math.exp(-0.5 * Math.pow(x / sigma, 2));
	});

	return gaussian.reverse();
}

// non normalised gaussian
function gaussian(size) {
	var ls = linspace(-1, 1, size);
	var sigma = 1/3; // going to 6 sigma width
	return ls.map(function(x) {
		return Math.exp(-0.5 * Math.pow(x / sigma, 2));
	});
}

function filter(data, kernel) {
	var mid = Math.floor(kernel.length / 2);

	return data.map(function(_, i) {
		var sum = 0;
		var weightsSum = 0;

		for (var j = 0; j < kernel.length; j++) {
			var index = (i - mid + j);
			if (index < 0 || index > (data.length - 1)) {
				continue;
			}
			sum += (data[index] * kernel[j]);
			weightsSum += kernel[j];
		}
		return (sum / weightsSum) || 0;
	});
}
