// TODO/questions
// - who to init Q? all with transitions to {0}*???


// Discrete time, discrete space markov model
// states are identified as strings
var MarkovChain = function() {

	var Q = []; // transition matrix storing transition counts;
	// this ends up to be a 2D matrix that is addressed as 
	// Q[from][to]

	var sums = []; // storing the out-degree of each state

	var historyBuffer = [];

	// get time in seconds
	var getTime = function() {
		return performance.now() / 1000;
	}

	this.learn = function(from, to) {
		if (Q[from] === undefined) {
			Q[from] = [];
			sums[from] = 0;
		}

		if (Q[from][to] === undefined) {
			Q[from][to] = 0;
		}

		Q[from][to]++;
		sums[from]++;

		historyBuffer.push({
			from: from,
			to: to,
			time: getTime()
		})
	}

	// remove (unlearn) all data from the Markov chain that is older than 'timeSeconds'
	this.truncate = function(timeSeconds) {
		var currentTime = getTime();
		while (historyBuffer[0] && (currentTime - historyBuffer[0].time) > timeSeconds) {
			Q[historyBuffer[0].from][historyBuffer[0].to]--;
			sums[historyBuffer[0].from]--;

			historyBuffer = historyBuffer.slice(1);
		}
	}

	this.p = function(from, to) {
		if (Q[from] === undefined || Q[from][to] === undefined) {
			return 0;
		}

		if (sums[from] === undefined || sums[from] === 0) {
			return 0;
		}

		return Q[from][to] / sums[from];
	}
}