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

var selfInformationPrime = function(a, b) {

}

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
