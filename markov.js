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
var analogWindowLengths = [15, 30, 60];
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

var svg;
var svgSize = 300;

window.onload = function() {

	svg = d3.select('#graph').append('svg')
		.attr('width', svgSize + 'px')
		.attr('height', svgSize + 'px');

	var x = d3.scale.linear()
		.domain([-1, 1])
		.range([3, svgSize - 3]);

	svg.append('defs').append('clipPath')
		.attr('id', 'clip')
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
			.attr('id', 'cell' + path.id)
			.attr('clip-path', 'url(#clip)');
	});

	// discSampler.getSites().forEach(function(site) {
	// 	svg.append('circle')
	// 		.attr('cx', x(site.x))
	// 		.attr('cy', x(site.y))
	// 		.attr('r', 5)
	// });

	drawControllerSelect();

	window.setInterval(function() {
		sample();
		truncateHistory();
		updateGraph();
	}, samplingF);

	setupMatrixPlot();
	window.setInterval(function() {
		updateMatrixPlot();
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

	var c = d3.scale.linear()
		.domain([0, 1])
		.range(['#444', '#e25454']);

	var probs = analogMc[2].transitionP(currentAnalogId);
	probs.forEach(function(element) {
		svg.select('#cell' + element.id).attr('fill', c(element.p));
	});

	lastAnalogID = currentAnalogId;
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


var setupMatrixPlot = function() {
	var ids = discSampler.getAllIDs();
	var size = 100;

	d3.select('#matrixPlot').data(ids)
		.enter()
			.append('svg')
			.attr('class', 'matrix')
			.attr('id', function(d) { return 'matrix-' + d; })
			.attr('width', size + 'px')
			.attr('height', size + 'px');

	var x = d3.scale.linear()
		.domain([-1, 1])
		.range([3, size - 3]);


	ids.forEach(function(id) {

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
	var ids = discSampler.getAllIDs();

	var c = d3.scale.linear()
		.domain([0, 1])
		.range(['#444', '#e25454']);

	ids.forEach(function(id) {
		var probs = analogMc[2].transitionP(id);
		probs.forEach(function(element) {
			d3.select('#cell-' + id + '-' + element.id).attr('fill', c(element.p));
		});
	});
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
