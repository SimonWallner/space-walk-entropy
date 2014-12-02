// TODO/questions
// - how to init Q? all with transitions to {0}*???


// Discrete time, discrete space markov model
// states are identified as strings
var MarkovChain = function(biased) {

	var Q = {}; // transition matrix storing transition counts;
	// this ends up to be a 2D matrix that is addressed as
	// Q[from][to]

	var sums = {}; // storing the out-degree of each state

	var historyBuffer = [];

	var bias = 20;
	var froms = {};
	var tos = {};

	// get time in seconds
	var getTime = function() {
		return performance.now() / 1000;
	}

	this.learn = function(from, to) {
		if (biased) {
			// fully expended setup
			if (Q[from] === undefined) {
				Q[from] = {};
				sums[from] = 0;

				for (t in tos) {
					if (tos.hasOwnProperty(t)) {
						Q[from][t] = bias;
						sums[from] += bias;
					}
				}

				froms[from] = true;
			}

			if (Q[from][to] === undefined) {
				for (f in froms) {
					if (froms.hasOwnProperty(f)) {
						Q[f][to] = bias;
						sums[f] += bias;
					}
				}

				tos[to] = true;
			}

		} else {
			// sparse setup
			if (Q[from] === undefined) {
				Q[from] = {};
				sums[from] = 0;
				froms[from] = true;
			}

			if (Q[from][to] === undefined) {
				Q[from][to] = 0;
				tos[to] = true;
			}
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

	this.pLog = function(from, to) {
		if (Q[from] === undefined || Q[from][to] === undefined) {
			return 0;
		}

		if (sums[from] === undefined || sums[from] <= 1) {
			return 0;
		}

		return Math.max(0, Math.log(Q[from][to])) / Math.log(sums[from]);
	}

	// return a list of transitions probs starting at 'from'
	this.transitionP = function(from) {
		var transition = []
		for(t in tos) {
			if (tos.hasOwnProperty(t)) {
				transition.push({
					id: t,
					p: this.p(from, t),
					pLog: this.pLog(from, t)})
			}
		}
		return transition;
	}

	this.sums = function() {
		return sums;
	}

	this.Q = function() {
		return Q;
	}
}
