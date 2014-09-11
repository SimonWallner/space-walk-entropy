// TODO 
// - regularise data to a fixed dt
// 		- make it exact, time wise. use time stamps
// - limited width used for transition probs
// - add y axis grid and max value
// - add numerical value 
// - potentially smooth current value
// - try sequences of last n data points not just last
// - visualise transition props, (the return to 0 propb, i.e.)
// - extend transition matrix to something larger, better handle loooong skips
// - beats instead of just presses --> holding button down
// - continuous data for analog input
// - extend to all buttons, how to mix ???

// monkey patch
Math.log2 = Math.log2 || function(a) { return Math.log(a) / Math.LN2; };


var libsw = new LibSpaceWalk();
var mm = new MarkovModel(0.1, 'exponential');

var lastSample = {};
var currentSample = {};

var lastInteractionT = 0;

var dataWindow = [];
var windowLength = 100;
var samplingF = 100; // ms

var historyData = [];
var entropyHistoryData = [];
var maxHistoryLength = 120;
var maxInformation = 1; // bits
var maxEntropy = 1;

var primed = false;

// in seconds
var Timer = function() {
	var that = this;

	this.lastT = performance.now() / 1000;
	this.deltaT = 0;

	this.tick = function() {
		var currentT = performance.now() / 1000;
		this.deltaT = currentT - this.lastT;
		this.lastT = currentT;
	};
};
var timer = new Timer();

var approximateTime = 0;


window.onload = function() {
	window.setInterval(function() {
		plot();
	}, samplingF);
}


libsw.onMessage = function(data) {
	if (data.type === "ext.input.gamePad.sample") {
		if (data.payload.name === "button-0") {
			lastSample = currentSample;
			currentSample = data.payload;
			approximateTime = currentSample.time;

			if (primed) {
				if (lastSample.value !== currentSample.value) {// interaction!
					var length = currentSample.time - lastInteractionT;
					mm.addEndPoint(length);
					updateMarkovPlot();

					lastInteractionT = currentSample.time;
				}
			} else {
				lastInteractionT = currentSample.time;
				primed = true;
			}
		}
	}
}

var updateMarkovPlot = function() {
	var bars = d3.select('#pReturnWrapper').selectAll('.bar').data(mm.getPReturnVector);
	bars.enter()
		.append('div')
			.attr('class', 'bar');
	bars
		.style('transform', function(d) {return 'scale(1, ' + Math.max(0.05, d.p) + ')';})
		.style('width', function(d) { return d.width * 200 + 'px'; });


	var selfInfo = mm.getPReturnVector().map(function(t) {
		t.selfInfo = selfInformation(t.p)
		return t;
	})
	var maxSelfInfo = Math.max(1, d3.max(selfInfo, function(d) { return d.selfInfo; }));

	var bars = d3.select('#markovInformation').selectAll('.bar').data(selfInfo);
	bars.enter()
		.append('div')
			.attr('class', 'bar');
	bars
		.style('transform', function(d) {return 'scale(1, ' + Math.max(0.05, d.selfInfo / maxSelfInfo) + ')';})
		.style('width', function(d) { return d.width * 200 + 'px'; });
}

var updateGraph = function() {
	var bits = d3.select('#bits').selectAll('.bit').data(historyData);
	bits.enter()
		.append('div')
			.attr('class', 'bit')
	bits
		.style('transform', function(d) {return 'scale(1, ' + Math.max(0.05, d / maxInformation) + ')';});


	$('#markov-value').text(historyData[historyData.length-1].toFixed(2));
	// $('#markov-bar').width(200 * (historyData[historyData.length-1] / maxInformation));	
	$('#maxValue').text(maxInformation.toFixed(2));


	// gaussian
	var kernel = gaussian(9)
	var gaussianFiltered = filter(historyData, kernel);
	bits = d3.select('#gaussianBits').selectAll('.bit').data(gaussianFiltered);
	bits.enter()
		.append('div')
			.attr('class', 'bit')
	bits
		.style('transform', function(d) {return 'scale(1, ' + Math.max(0.05, d / maxInformation) + ')';});


	// entropy
	var entropy = mm.entropy();
	entropyHistoryData.push(entropy);
	maxEntropy = Math.max(maxEntropy, entropy);

	bits = d3.select('#entropyBits').selectAll('.bit').data(entropyHistoryData);
	bits.enter()
		.append('div')
			.attr('class', 'bit')
	bits
		.style('transform', function(d) {return 'scale(1, ' + Math.max(0.05, d / maxEntropy) + ')';});

	$('#maxEntropy').text(maxEntropy.toFixed(2));
}

var plot = function() {
	var length = approximateTime - lastInteractionT;

	if (lastSample.value !== currentSample.value) {// interaction!
		var info = selfInformation(mm.pReturn(length));
	} else {
		var info = selfInformation(mm.pContinue(length));
	}

	historyData.push(info);
	maxInformation = Math.max(maxInformation, info);

	truncateHistory();
	mm.unlearn(3);
	updateGraph();
	updateMarkovPlot();

	approximateTime += (samplingF / 1000);
}

var truncateHistory = function() {
	if (historyData.length > maxHistoryLength) {
		historyData = historyData.splice(historyData.length - maxHistoryLength);
		entropyHistoryData = entropyHistoryData.splice(entropyHistoryData.length - maxHistoryLength);
	}
}



var selfInformation = function(prop) {
	if (prop === 0) {
		return 0;
	}

	return Math.log2(1 / prop);
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
