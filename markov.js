// TODO 
// - regularise data to a fixed dt
// 		- make it exact, time wise. use time stamp


var libsw = new LibSpaceWalk();

var lastValue = null;

var lengths = [];
var currentLength = 0;
var sum = 0;

// sparse[0]: transition to 0
// sparse[1]: transition to l+1
var SparseTransitionMatrix = [];
var sums = [];

for (var i = 0; i < 1024; i++) {
	SparseTransitionMatrix[i] = [0, 0];
	sums[i] = 0;
}

var historyData = [];



window.onload = function() {
	window.setInterval(addSample, 100);
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
		.style('transform', function(d) {return 'scale(1, ' + Math.max(0.05, d) + ')';});
}

var addSample = function() {
	// just reset it for now
	if (currentLength > 1023) {
		currentLength = 0;
	}


	if (lastValue === 1) {
		SparseTransitionMatrix[currentLength][0]++;
		sums[currentLength]++;
		
		currentLength = 0;
	} else {
		SparseTransitionMatrix[currentLength][1]++;
		sums[currentLength]++;

		currentLength++;
	}

	if (lastValue === 1) {
		historyData.push(pTransitionTo0(currentLength));
	} else {
		historyData.push(pTransitionToNext(currentLength));
	}

	updateGraph();
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