// 1D Markov Model to model the length of something
// Transitions are strictly monotonous (s_n --> s_n+1) with s_n < s_n+1
// with the addition of (s_k --> 0) that is possible for all s_k in S.
var MarkovModel = function() {

	var transitions = [];

	var getBound = function(index) {
		// linear case
		// n per second
		return (index + 1) * 0.1;
	}

	var getIndex = function(bound) {
		return Math.floor(bound / getBound(0));
	}

	var pReturnOfTranstion = function(t) {
		var sum = t.cContinue + t.cReturn;
		return t.cReturn / sum;
	}

	// add the length of the endpoint of a chain.
	this.addEndPoint = function(length) {

		for (var i = 0; i < getIndex(length); i++) {
			if (!transitions[i]) {
				transitions[i] = {
					upperBound: getBound(i),
					cContinue: 0,
					cReturn: 0
				}
			}

			transitions[i].cContinue++;
		}

		if (!transitions[i]) {
			transitions[i] = {
				upperBound: getBound(i),
				cContinue: 0,
				cReturn: 0
			}
		}
		transitions[i].cReturn++;
	}

	
	this.getTransitions = function() {
		return transitions;
	}

	this.getPReturnVector = function() {
		return transitions.map(function(t) {
			return pReturnOfTranstion(t);
		})
	}

	this.pContinue = function(length) {
		var index = Math.max(0, getIndex(length) - 1);
		var t = transitions[index];
		if (t) {
			var sum = t.cContinue + t.cReturn;
			return t.cContinue / sum;
		} else {
			return 1;
		}
	}

	this.pReturn = function(length) {
		var index = getIndex(length);
		var t = transitions[index];
		if (t) {
			return pReturnOfTranstion(t);
		} else {
			return 1;
		}
	}

	// util
	var log2 = function(a) {
		if (a <= 0) {
			return 0
		}
		return Math.log(a) / Math.LN2;
	};

	var h = function(p) {
		if (p === 0) {
			return 0;
		}
		return p * log2(1 / p);
	}


	this.entropy = function() {
		var sum = transitions.reduce(function(prev, current) {
			var sum = current.cContinue + current.cReturn;
			return prev + (sum > 0);
		}, 0);

		var sumEntropy = transitions.reduce(function(prev, current) {
			var sum = current.cContinue + current.cReturn;
			var pContinue = (current.cContinue / sum);
			var pReturn = (current.cReturn / sum);

			return prev + h(pContinue) + h(pReturn);
		}, 0)

		if (sum === 0) {
			return 0;
		} else {
			return sumEntropy / sum;
		}
	}
}