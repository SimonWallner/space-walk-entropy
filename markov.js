// TODO
// avoid missing high f events when sampling the current sample
//		accumulate conservatively instead...


// monkey patch
Math.log2 = Math.log2 || function(a) { return Math.log(a) / Math.LN2; };


var libsw = new LibSpaceWalk();

var activeController = 0;
var knownControllers = [0];

var windowLengths = [15, 30, 60, 120, 240];
var mc = [];
for (var i = 0; i < windowLengths.length; i++) {
	mc[i] = new MarkovChain(true);
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

// analog fun
var analogWindowLengths = [150, 300, 600];
var analogMc = [];
var analogHistoryData = []
for (var i = 0; i < analogWindowLengths.length; i++) {
	analogMc[i] = new MarkovChain(false);
	analogHistoryData[i] = [];
}
var discSampler = new DiscSampler();
var currentAnalogSample = {x: 0, y: 0};
var lastAnalogID = discSampler.getID(currentAnalogSample);
var maxAnalogInformation = 1;

var svgSize = 300;

var MatrixRoundRobin = 0;
var matrixIDs;

// linear stuff
var linearMc = new MarkovChain(false);
var linearSampler = new LinearSampler();
var linearSVGSize = {w: 300, h: 50};
var linearSvg;
var linearCurrentID;
var linearLastID;

// quivers
var arrows = []
jitteredGridSamples(15, 0.7).map(function(sample) {
	if (distance({x: 0, y: 0}, sample) < 1) {
		arrows.push({pos: sample});
	}
})


// shared
var c = d3.scale.linear()
	.domain([0, 1])
	.range(['#444', '#e25454']);


window.onload = function() {
	drawControllerSelect();

	setupAnalog();

	window.setInterval(function() {
		if (!libsw.isPaused()) {
			sample();
			truncateHistory();
			updateGraph();
		}
	}, samplingF);

	setupFlowVis();
	window.setInterval(function() {
		if (!libsw.isPaused()) {
			updateFlowVis();
		}
	}, 500);

	setupMatrixPlot();
	window.setInterval(function() {
		if (!libsw.isPaused()) {
			updateMatrixPlot();
		}
	}, 100);

	window.setInterval(function() {
		if (!libsw.isPaused()) {
			updateSumSvg();
		}
	}, 500);

	setupLinearPlot();
	window.setInterval(function() {
		if (!libsw.isPaused()) {
			updateLinearPlot();
		}
	}, 500);
}

var drawControllerSelect = function() {
	var divs = d3.select('#controllerSelect').selectAll('div').data(knownControllers);
	divs.enter()
		.append('div')
			.text(function(d) { return d; })
			.attr('id', function(d) { return 'controller' + d; })
			.on('click', function(d) {
				activeController = d;
				drawControllerSelect();
			})

	divs.text(function(d) { return d; })
		.attr('class', '');

	$('#controller' + activeController).addClass('active');
}

libsw.onMessage = function(data) {
	if (data.type === "ext.input.gamePad.sample") {

		if (data.payload.controllerNumber === activeController) {
			if (data.payload.type === 'digital') {
				currentSample[data.payload.buttonNumber] = data.payload.value;
			} else if(data.payload.type === 'analog') {

				if (data.payload.name === 'axis-0') {
					currentAnalogSample.x = data.payload.value;
				} else if (data.payload.name === 'axis-1') {
					currentAnalogSample.y = data.payload.value;
				}

				if (data.payload.name === 'axis-5') { // right trigger (XB360)
					linearCurrentID = linearSampler.getID(data.payload.value);
				}
			}
		} else {
			if (knownControllers.indexOf(data.payload.controllerNumber) === -1) {
				knownControllers.push(data.payload.controllerNumber);

				drawControllerSelect();
			}
		}
	}
}

var sample = function() {
	// digital
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

	// analog
	var currentAnalogId = discSampler.getID(currentAnalogSample);

	for (var i = 0; i < analogWindowLengths.length; i++) {
		analogMc[i].learn(lastAnalogID, currentAnalogId);
		var p = analogMc[i].p(lastAnalogID, currentAnalogId);
		var info = selfInformation(p);

		analogHistoryData[i].push(info);
		maxAnalogInformation = Math.max(maxAnalogInformation, info);

		analogMc[i].truncate(analogWindowLengths[i]);
	}

	var probs = analogMc[2].transitionP(currentAnalogId);
	probs.forEach(function(element) {
		d3.select('#graph-cell-' + element.id).attr('fill', c(element.pLog));
	});

	lastAnalogID = currentAnalogId;

	// linear
	linearMc.learn(linearLastID, linearCurrentID);
	linearLastID = linearCurrentID;
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
		$('#maxInformation').text(maxInformation.toFixed(2));
	}

	// gaussian
	var kernel = gaussian(9)

	for (var i = 0; i < 3; i++)	{
		var gaussianFiltered = filter(historyData[i], kernel);
		bits = d3.select('#filtered' + windowLengths[i]).selectAll('.bit').data(gaussianFiltered);
		bits.enter()
			.append('div')
				.attr('class', 'bit')
		bits
			.style('transform', function(d) {return 'scale(1, ' + Math.max(0.05, d / maxInformation) + ')';});
	}

	// analog
	for (var i = 0; i < analogMc.length; i++) {
		var bits = d3.select('#analogInfo' + analogWindowLengths[i]).selectAll('.bit').data(analogHistoryData[i]);
		bits.enter()
			.append('div')
				.attr('class', 'bit')
		bits
			.style('transform', function(d) {return 'scale(1, ' + Math.max(0.05, d / maxAnalogInformation) + ')';});


		// $('#markov-value').text(historyData[historyData.length-1].toFixed(2));
		// // $('#markov-bar').width(200 * (historyData[historyData.length-1] / maxInformation));
		$('#maxAnalogInformation').text(maxAnalogInformation.toFixed(2));
	}
}


var truncateHistory = function() {
	for (var i = 0; i < historyData.length; i++)
	if (historyData[i].length > maxHistoryLength) {
		historyData[i] = historyData[i].splice(historyData[i].length - maxHistoryLength);
	}

	for (var i = 0; i < analogHistoryData.length; i++)
	if (analogHistoryData[i].length > maxHistoryLength) {
		analogHistoryData[i] = analogHistoryData[i].splice(analogHistoryData[i].length - maxHistoryLength);
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

var setupAnalog = function() {
		var x = d3.scale.linear()
			.domain([-1, 1])
			.range([3, svgSize - 3]);

	['graph', 'sumSvg', 'flowVis'].forEach(function(id) {
		var svg = d3.select('#' + id).append('svg')
			.attr('width', svgSize + 'px')
			.attr('height', svgSize + 'px');

		svg.append('defs').append('clipPath')
			.attr('id', 'clip-' + id)
			.append('circle')
				.attr('cx', x(0))
				.attr('cy', x(0))
				.attr('r', svgSize / 2 - 6);

		svg.append('circle')
			.attr('cx', x(0))
			.attr('cy', x(0))
			.attr('r', svgSize / 2 - 2)
			.attr('class', 'outline');

		discSampler.getPaths().forEach(function(path) {
			var lineFunc = d3.svg.line()
				.x(function(d) { return x(d.x); })
	 			.y(function(d) { return x(d.y); })
				.interpolate("linear");

			svg.append('path')
				.attr('d', lineFunc(path.path))
				.attr('fill', '#444')
				.attr('id', id + '-cell-' + path.id)
				.attr('clip-path', 'url(#clip-' + id +')');
		});
	})
}


var setupMatrixPlot = function() {
	matrixIDs = discSampler.getAllIDs();
	var size = 100;

	d3.select('#matrixPlot').selectAll('svg').data(matrixIDs)
		.enter()
			.append('svg')
			.attr('class', 'matrix')
			.attr('id', function(d) { return 'matrix-' + d; })
			.attr('width', size + 'px')
			.attr('height', size + 'px');

	var x = d3.scale.linear()
		.domain([-1, 1])
		.range([3, size - 3]);


	matrixIDs.forEach(function(id) {

		var svg = d3.select('#matrix-' + id);
		var g = svg.append('g');

		svg.append('defs').append('clipPath')
			.attr('id', 'matrixClip')
			.append('circle')
				.attr('cx', x(0))
				.attr('cy', x(0))
				.attr('r', size / 2 - 4);

		svg.append('circle')
			.attr('cx', x(0))
			.attr('cy', x(0))
			.attr('r', size / 2 - 2)
			.attr('class', 'outline');

		discSampler.getPaths().forEach(function(path) {
			var lineFunc = d3.svg.line()
				.x(function(d) { return x(d.x); })
	 			.y(function(d) { return x(d.y); })
				.interpolate("linear");

			if (id === path.id) {
				svg.append('path')
				.attr('d', lineFunc(path.path))
				.attr('fill', '#444')
				.attr('id', 'cell-' + id + '-' + path.id)
				.attr('clip-path', 'url(#matrixClip)')
				.attr('class', 'anchor');
			} else {
				g.append('path')
				.attr('d', lineFunc(path.path))
				.attr('fill', '#444')
				.attr('id', 'cell-' + id + '-' + path.id)
				.attr('clip-path', 'url(#matrixClip)');
			}
		});
	})
}

var updateMatrixPlot = function() {
	var id = matrixIDs[MatrixRoundRobin]

	var probs = analogMc[2].transitionP(id);
	probs.forEach(function(element) {
		d3.select('#cell-' + id + '-' + element.id).attr('fill', c(element.pLog));
	});

	MatrixRoundRobin = (MatrixRoundRobin + 1) % matrixIDs.length;
}

var updateSumSvg = function() {
	var sums = analogMc[2].sums();
	var total = 0;
	for (var from in sums) {
		if (sums.hasOwnProperty(from)) {
			total += sums[from];
		}
	}

	for (var from in sums) {
		if (sums.hasOwnProperty(from)) {
			d3.select('#sumSvg-cell-' + from).attr('fill', c(Math.max(0, Math.log(sums[from])) / Math.log(total)));
		}
	}
}

var setupLinearPlot = function() {

	var dimension = function(d) {
		d.attr('width', linearSVGSize.w)
		.attr('height', linearSVGSize.h);
	}
	linearSvg = d3.select('#linearPlot').append('svg').call(dimension);
	linearSumsSvg = d3.select('#linearSums').append('svg').call(dimension);

	var x = d3.scale.linear()
		.domain([0, 1])
		.range([4, linearSVGSize.w - 4]);

	var y = d3.scale.linear()
		.domain([0, 1])
		.range([4, linearSVGSize.h - 4]);

	[linearSvg, linearSumsSvg].forEach(function(svg) {
		linearSampler.getPaths().forEach(function(path) {
			var lineFunc = d3.svg.line()
				.x(function(d) { return x(d.x); })
	 			.y(function(d) { return y(d.y); })
				.interpolate("linear");

			svg.append('path')
				.attr('d', lineFunc(path.path))
				.attr('fill', '#444')
				.attr('id', svg[0][0].parentElement.id + '-cell-' + path.id)
		});

		svg.append('rect')
			.attr('x', 1)
			.attr('y', 1)
			.attr('width', linearSVGSize.w - 2)
			.attr('height', linearSVGSize.h - 2)
			.attr('class', 'outline');
	});
}

var updateLinearPlot = function() {
	linearMc.transitionP(linearCurrentID).forEach(function(p) {
		d3.select('#linearPlot-cell-' + p.id).attr('fill', c(p.p));
	})

	var sums = linearMc.sums();
	var total = 0;
	for (var from in sums) {
		if (sums.hasOwnProperty(from)) {
			total += sums[from];
		}
	}

	for (var from in sums) {
		if (sums.hasOwnProperty(from)) {
			d3.select('#linearSums-cell-' + from).attr('fill', c(Math.max(0, Math.log(sums[from])) / Math.log(total)));
		}
	}
}

var setupFlowVis = function() {
	d3.select('#flowVis svg defs').append('marker')
		.attr('id', 'markerArrow')
		.attr('viewBox', '0 0 10 10')
		.attr('markerWidth', 5)
		.attr('markerHeight', 4)
		.attr('refX', 2)
		.attr('refY', 5)
		.attr('orient', 'auto')
		.append('path')
			.attr('d', 'M0,0 L0,10 L10,5 L0,0')
			.attr('fill', '#3fc0c9')
			.attr('style', 'stroke-width: 0px');

	d3.select('#flowVis svg defs').append('marker')
		.attr('id', 'quiverArrow')
		.attr('viewBox', '0 0 10 10')
		.attr('markerWidth', 5)
		.attr('markerHeight', 4)
		.attr('refX', 2)
		.attr('refY', 5)
		.attr('orient', 'auto')
		.append('path')
			.attr('d', 'M0,0 L0,10 L10,5 L0,0')
			.attr('fill', 'white')
			.attr('style', 'stroke-width: 0px')
}


var updateFlowVis = function() {
	var data = discSampler.getFlowData(analogMc[2].Q(), analogMc[2].sums());

	var x = d3.scale.linear()
		.domain([-1, 1])
		.range([3, svgSize - 3]);
	var s = d3.scale.linear()
		.domain([0, 1])
		.range([0, 10]);

	var pathSpec = function(d) {
		var dirVector = {
			x: (d.centerX - d.x) / 2,
			y: (d.centerY - d.y) / 2
		};

		return 'M' + x(d.x) + ',' + x(d.y)
			+ ' L' + x(d.x + dirVector.x) + ',' + x(d.y + dirVector.y);
	};

	// var selection = d3.select('#flowVis svg').selectAll('path.glyph').data(data);
	// selection.enter()
	// 	.append('path')
	// 	.attr('class', 'glyph');
	//
	// selection // update
	// 	.attr('d', pathSpec);


	// quiver plot
	var sites = discSampler.getSites();
	for (var i = 0; i < arrows.length; i++) {
		pos = arrows[i].pos;

		var pairs = sites.map(function(site, index) {
			var d = distance(pos, site)
			return {
				siteId: index,
				distance: d
			}
		})

		var sorted = pairs.slice();
		sorted.sort(function(a, b) {
			return a.distance - b.distance;
		});

		var sum = {x: 0, y: 0};
		var weightSum = 0;
		for (var k = 0; k < 3; k++) {
			var pair = sorted[k];
			var siteCenter = {x: data[pair.siteId].centerX, y: data[pair.siteId].centerY}

			if (pair.distance === 0) {
				sum = siteCenter;
				weightsSum = 1;
				break;
			}
			weight = 1 / Math.pow(pair.distance, 1);
			sum = mad(sum, siteCenter, weight);
			weightSum += weight;
		}
		sum = mul(sum, 1 / weightSum);

		arrows[i].center = sum;
	}

	var quiverPathSpec = function(d) {
		var dirVector = {
			x: (d.center.x - d.pos.x) / 5,
			y: (d.center.y - d.pos.y) / 5
		};

		return 'M' + x(d.pos.x) + ',' + x(d.pos.y)
			+ ' L' + x(d.pos.x + dirVector.x) + ',' + x(d.pos.y + dirVector.y);
	};

	var selection = d3.select('#flowVis svg').selectAll('path.quiver').data(arrows);
	selection.enter()
		.append('path')
		.attr('class', 'quiver');

	selection // update
		.attr('d', quiverPathSpec);
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

function distance(a, b) {
	var v = {
		x: b.x - a.x,
		y: b.y - a.y,
	}

	return (v.x * v.x) + (v.y * v.y);
}

var add = function(a, b) {
	return {x: a.x + b.x, y: a.y + b.y};
}

var mul = function(a, s) {
	return {x: a.x * s, y: a.y * s};
}

var mad = function(a, b, s) {
	return {x: a.x + b.x * s, y: a.y + b.y * s};
}

function jitteredGridSamples(dimension, jitter) {
	var result = [];
	for (var i = 0; i < dimension; i++) {
		for (var j = 0; j < dimension; j++) {
			var x = (i / (dimension - 1)) * 2 - 1;
			var y = (j / (dimension - 1)) * 2 - 1;

			result.push({
				x: x + (Math.random() * 2 - 1) * (jitter / dimension),
				y: y + (Math.random() * 2 - 1) * (jitter / dimension)
			})
		}
	}
	return result;
}
