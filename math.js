// function cache

var functionCache1D = function(functor) {
    var cache = {};
    var hit = 0;
    var miss = 0;

    this.f = function(x) {
        if (cache[x]) {
            hit++;
            return cache[x];
        } else {
            miss++;
            var result = functor(x);
            cache[x] = result;
            return result;
        }
    }

    this.hit = function() {
        return hit;
    }

    this.miss = function() {
        return miss;
    }
}


var functionCache2D = function(functor) {
    var cache = {};
    var hit = 0;
    var miss = 0;

    this.f = function(x, y) {
        if (cache[x] && cache[x][y]) {
            hit++;
            return cache[x][y];
        } else {
            miss++;

            if (!cache[x]) {
                cache[x] = {};
            }

            var result = functor(x, y);
            cache[x][y] = result;
            return result;
        }
    }

    this.hit = function() {
        return hit;
    }

    this.miss = function() {
        return miss;
    }
}

var integrate = function(f, a, b, steps) {
    var samples = linspace(a, b, steps);
    var sum = 0;
    for (var i = 0; i < samples.length - 2; i++) {
        var x1 = samples[i];
        var x2 = samples[i+1];

        sum += (x2 - x1) * (f(x1) + f(x2)) / 2;
    }

    return sum;
}

var I = function(x) {
    if (x === 0) {
        return 0;
    }
    return Math.log2(1 / x);
}

var IPrime = function(a, b) {
    return integrate(function(x) {
        return jStat.beta.pdf(x, a, b) * I(x);
    }, 0, 1, 100)
}

var IPrimeCached = new functionCache2D(IPrime);

// create a linear space of length = 'size' spanning [a, b]
// the first element is a, the last is b
function linspace(a, b, size) {
	var result = [];
	for (var i = 0; i < size; i++) {
		var t = i / (size - 1);
		result[i] = (a * (1 - t) + b * t);
	}

	return result;
}

var boundedMax = function(a, b) {
    if (a === Infinity) {
        return b;
    } else if (b === Infinity) {
        return a;
    } else {
        return Math.max(a, b);
    }
}
