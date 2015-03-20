// TODO/questions
// - how to init Q? all with transitions to {0}*???


// Discrete time, discrete space markov model
// states are identified as strings
var MarkovChain = function(biased, numIndividualStates) {

	var Q = {}; // transition matrix storing transition counts;
	// this ends up to be a 2D matrix that is addressed as
	// Q[from][to]

	var sums = {}; // storing the out-degree of each state

	var historyBuffer = [];

	var bias = 0;
	var froms = {};
	var tos = {};
	var primed = false;

	// get time in seconds
	var getTime = function() {
		return performance.now() / 1000;
	}

	this.reset = function() {
		Q = {};
		sums = {};
		historyBuffer = [];
		froms = {};
		tos = {};
		primed = false;
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
			primed = true;
		}
	}

	this.p = function(from, to) {
		if (Q[from] === undefined || Q[from][to] === undefined) {
			return 0;
		}

		if (sums[from] === undefined || sums[from] === 0) {
			return 0;
		}

		if (biased) {
			totalStatesCnt = Math.pow(2, numIndividualStates);
			var b = 2;

			return (Q[from][to] + b) / (sums[from] + (totalStatesCnt * b));
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

		return Math.log(Q[from][to] + 1) / Math.log(sums[from] + 1);
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

	this.serialize = function() {
		var q = {};
		for (var f in froms) {
			q[f] = {};
			for (var t in tos) {
				q[f][t] = this.p(f, t)
			}
		}
		return q;
	}

	this.ready = function() {
		// TODO check if we are ready
		return primed;
	}

	// get flow data for a certain site
	this.getFlowData = function(sampler) {
		// compute center of mass
		// return difference vector to site
		return sampler.getSites().map(function(site, i) {
			var from = i;

			var tos = Q[from];
			if (tos && sums[from] && sums[from] > 0) {
				var sum = {x: 0, y: 0}
				for (var to in tos)
					if (tos.hasOwnProperty(to)) {
						var position = sampler.getSite(to);
						var weight = Q[from][to];
						sum = mad(sum, position, weight);
					}

				var center = mul(sum, 1 / sums[from]);
			} else {
				var center = site;
			}

			return {
				x: site.x,
				y: site.y,
				centerX: center.x,
				centerY: center.y,
				dirX: (center.x - site.x) / 2,
				dirY: (center.y - site.y) / 2,
			};
		});
	}
}


// static probability model, i.e. it has no learning capabilities and can be of
// any form.
StaticModel = function(q) {
	var Q = q;

	var accumulatedP = {};
	for (var from in Q) {
		if (Q.hasOwnProperty(from)) {
			for (var to in Q[from]) {
				if (Q[from].hasOwnProperty(to)) {
					if (accumulatedP[to] === undefined) {
						accumulatedP[to] = 0;
					}
					accumulatedP[to] += Q[from][to];
				}
			}
		}
	}


	this.p = function(from, to) {
		if (Q[from] === undefined || Q[from][to] === undefined) {
			return 0;
		}

		return Q[from][to];
	}

	this.pLog = function(from, to) {
		var p = this.p(from, to);

		return p;
	}

	// return a list of transitions probs starting at 'from'
	this.transitionP = function(from) {
		var transition = [];
		if (Q[from]) {
			for (var to in Q[from]) {
				if (Q[from].hasOwnProperty(to)) {
					transition.push({
						id: to,
						p: this.p(from, to),
						pLog: this.pLog(from, to)})
				}
			}
		}
		return transition;
	}

	this.Q = function() {
		return Q;
	}

	this.sums = function() {
		return accumulatedP;
	}

	this.ready = function() {
		return true;
	}

	this.getFlowData = function(sampler) {
		// compute center of mass
		// return difference vector to site
		return sampler.getSites().map(function(site, i) {
			var from = i;

			var tos = Q[from];
			if (tos && accumulatedP[from] && accumulatedP[from] > 0) {
				var sum = {x: 0, y: 0}
				for (var to in tos)
					if (tos.hasOwnProperty(to)) {
						var position = sampler.getSite(to);
						var weight = Q[from][to];
						sum = mad(sum, position, weight);
					}

				var center = mul(sum, 1);
			} else {
				var center = site;
			}

			return {
				x: site.x,
				y: site.y,
				centerX: center.x,
				centerY: center.y,
				dirX: (center.x - site.x) / 2,
				dirY: (center.y - site.y) / 2,
			};
		})
	}
}
