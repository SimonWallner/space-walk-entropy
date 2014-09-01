// TODO 
// - regularise data to a fixed dt
// 		- make it exact, time wise. use time stamp
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

var lastValue = null;

var currentLength = 0;
var enfOfTheLineLength = 0;
var dataWindow = [];
var windowLength = 100;
var samplingF = 100; // ms

// sparse[0]: transition to 0
// sparse[1]: transition to l+1
var SparseTransitionMatrix = [];
var sums = [];

for (var i = 0; i < 1024; i++) {
	SparseTransitionMatrix[i] = [0, 0];
	sums[i] = 0;
}

var historyData = [];
var maxHistoryLength = 120;
var maxInformation = 1; // bits



window.onload = function() {
	window.setInterval(addSample, samplingF);
}


libsw.onMessage = function(data) {
	if (data.type === "input") {
		if (data.payload.name === "button-0") {
			lastValue = data.payload.value;
		}
	}
}

var updateGraph = function() {
	var bits = d3.select('#bits').selectAll('.bit').data(historyData);
	bits.enter()
		.append('div')
			.attr('class', 'bit')
	bits
		.style('transform', function(d) {return 'scale(1, ' + Math.max(0.05, d / maxInformation) + ')';});


	$('#markov-value').text(historyData[historyData.length-1].toFixed(2));
	$('#markov-bar').width(200 * (historyData[historyData.length-1] / maxInformation));	
}

var addSample = function() {
	// just reset it for now
	if (currentLength > 1023) {
		currentLength = 0;
	}

	if (lastValue === 1) {
		SparseTransitionMatrix[currentLength][0]++;
		sums[currentLength]++;
		
		var info = selfInformation(pTransitionTo0(currentLength));
		historyData.push(info);
		currentLength = 0;
		maxInformation = Math.max(maxInformation, info);
	} else {
		SparseTransitionMatrix[currentLength][1]++;
		sums[currentLength]++;

		var info = selfInformation(pTransitionToNext(currentLength));
		historyData.push(info);
		currentLength++;
		maxInformation = Math.max(maxInformation, info);
	}

	// truncateDataWindow();
	truncateHistory();
	updateGraph();
}

var truncateHistory = function() {
	if (historyData.length > maxHistoryLength) {
		historyData = historyData.splice(historyData.length - maxHistoryLength);
		maxInformation = historyData.reduce(function(prev, current) {
			return Math.max(prev, current);
		}, 1);
	}
}

var pTransitionToNext = function(from) {
	if (sums[from] === 0) {
		return 0;
	}

	return SparseTransitionMatrix[from][1] / sums[from];
}

var pTransitionTo0 = function(from) {
	if (sums[from] === 0) {
		return 0;
	}

	return SparseTransitionMatrix[from][0] / sums[from];
}

var selfInformation = function(prop) {
	if (prop === 0) {
		return 0;
	}

	return Math.log2(1 / prop);
}