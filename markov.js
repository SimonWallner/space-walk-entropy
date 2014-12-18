// TODO
// avoid missing high f events when sampling the current sample
//		accumulate conservatively instead...


// monkey patch
Math.log2 = Math.log2 || function(a) { return Math.log(a) / Math.LN2; };


var libsw = new LibSpaceWalk();

// controllers
var activeController = 0;
var knownControllers = [0];

// Probabilistic Models
var windowLengths = [15, 30, 60, 120, 240];
var reverseWindowLookup = {}
windowLengths.forEach(function(l, i) {
	reverseWindowLookup[l] = i;
})
var samplingF = 100; // ms
var maxHistoryLength = 120;
var maxInformation = 1; // bits


// Marcov Chains
var digitalMCs = [];
var linearMCs = [];
var analogMCs = [];
for (var i = 0; i < windowLengths.length; i++) {
	digitalMCs[i] = new MarkovChain(true, 16);
	linearMCs[i] = new MarkovChain(false);
	analogMCs[i] = new MarkovChain(false);
}
var custom = {
	digital: new StaticModel({}),
	analog: new StaticModel({}),
	linear: new StaticModel({})
}

// samplers
var discSampler = new DiscSampler();
var linearSampler = new LinearSampler();

// digital
var currentSample = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
var lastSample = currentSample;

// analog fun
var currentAnalogSample = {x: 0, y: 0};
var lastAnalogID = discSampler.getID(currentAnalogSample);

// linear stuff
var linearCurrentID;
var linearLastID;

// current Models
var modelA = {
	id: '15',
	linear: linearMCs[0],
	analog: analogMCs[0],
	digital: digitalMCs[0],
	history: {
		analog: [],
		digital: [],
		mixed: []
	}
}
var modelB = {
	id: '15',
	linear: linearMCs[0],
	analog: analogMCs[0],
	digital: digitalMCs[0],
	history: {
		analog: [],
		digital: [],
		mixed: []
	}
}

// display
var svgSize = 300;
var MatrixRoundRobin = 0;
var matrixIDs;
var linearSVGSize = {w: 300, h: 50};
var linearSvg;


// quivers
var arrows = [];
jitteredGridSamples(15, 0.7).map(function(sample) {
	if (distance({x: 0, y: 0}, sample) < 1) {
		arrows.push({pos: sample});
	}
})


// shared
var c = d3.scale.linear()
	.domain([0, 1])
	.range(['#444', '#e25454']);


var mappings = {
	xbox360: {
		digital: {
			'button-0': 'cross',
			'button-1': 'circle',
			'button-2': 'square',
			'button-3': 'triangle',

			'button-4': 'L1',
			'button-5': 'R1',
			'button-6': 'L3',
			'button-7': 'R3',

			'button-11': 'Dpad-up',
			'button-12': 'Dpad-down',
			'button-13': 'Dpad-left',
			'button-14': 'Dpad-right',

			'button-8': 'start',
			'button-9': 'select',
			'button-10': 'special'
		},
		analog: {
			'axis-0': {id: 'LS', property: 'x'},
			'axis-1': {id: 'LS', property: 'y'},

			'axis-3': {id: 'RS', property: 'x'},
			'axis-4': {id: 'RS', property: 'y'},

			'axis-2': {id: 'L2'},
			'axis-5': {id: 'R2'}
		}
	},
	ps3: {
		digital: {
			'button-14': 'cross',
			'button-13': 'circle',
			'button-15': 'square',
			'button-12': 'triangle',

			'button-10': 'L1',
			'button-11': 'R1',
			'button-8': 'L2',
			'button-9': 'R2',
			'button-1': 'L3',
			'button-2': 'R3',

			'button-4': 'Dpad-up',
			'button-6': 'Dpad-down',
			'button-7': 'Dpad-left',
			'button-5': 'Dpad-right',

			'button-3': 'start',
			'button-0': 'select',
			'button-16': 'special'
		},
		analog: {
			'axis-0': {id: 'LS', property: 'x'},
			'axis-1': {id: 'LS', property: 'y'},

			'axis-2': {id: 'RS', property: 'x'},
			'axis-3': {id: 'RS', property: 'y'},
		}
	}
}

var currentMapping = mappings.xbox360;


// various plugins might reside on the same origin, hence we are using
// a pseudo random storage key.
var storageKey = '71710660-85cd-11e4-b4a9-0800200c9a66';
var settings = {
	currentMapping: 'xbox360',
	customMapping: mappings.xbox360,
	modelAId: '15',
	modelBId: '15',
};

var loadSettings = function() {
	var result = localStorage.getItem(storageKey);
	if (result) {
		parsedSettings = JSON.parse(result);

		// update settings one by one so that we can retain default values
		// if there is no key in the stored settings.
		for (var key in parsedSettings) {
			if (parsedSettings.hasOwnProperty(key)) {
				settings[key] = parsedSettings[key];
			}
		}
	}
}

var storeSettings = function() {
	localStorage.setItem(storageKey, JSON.stringify(settings))
}

var activateOption = function(id) {
	var option = $(id);
	if (option) {
		option.siblings().toggleClass('active', false);
		option.toggleClass('active', true);
	}
}

var downloadJson = function(obj, filename) {
	var json = JSON.stringify(obj, undefined, 2);
	var aTag = $('<a>', { href: 'data:aplication/json;charset=utf-8,' + encodeURI(json), download: filename})
	aTag[0].click();
}

var setActiveModel = function(model, id) {
	var index = reverseWindowLookup[id];
	if (typeof index != 'undefined') {
		model.id = id;
		model.linear = linearMCs[index];
		model.analog = analogMCs[index];
		model.digital = digitalMCs[index];

		model.history = {
			analog: [],
			digital: [],
			mixed: []
		};
	} else if (id === 'custom') {
		model.id = 'custom';
		model.linear = custom.linear;
		model.analog = custom.analog;
		model.digital = custom.digital;

		model.history = {
			analog: [],
			digital: [],
			mixed: []
		};
	}
}

$(document).ready(function() {
	drawControllerSelect();
	setupAnalog();

	// load settings
	loadSettings();
	if (settings.currentMapping === 'custom') {
		currentMapping = settings.customMapping;
		activateOption('#mappingCustom');
	} else {
		currentMapping = mappings[settings.currentMapping];
		if (settings.currentMapping === 'xbox360') {
			activateOption('#mappingX360');
		} else if (settings.currentMapping === 'ps3') {
			activateOption('#mappingPS3');
		}
	}

	setActiveModel(modelA, settings.modelAId);
	activateOption('#modelA' + settings.modelAId);
	setActiveModel(modelB, settings.modelBId);
	activateOption('#modelB' + settings.modelBId);


	// intervall callbacks
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

	// buttons hooks
	$('#mappingX360').click(function() {
		currentMapping = mappings.xbox360;
		settings.currentMapping = 'xbox360';
		storeSettings();
		activateOption(this);
	});

	$('#mappingPS3').click(function() {
		currentMapping = mappings.ps3;
		settings.currentMapping = 'ps3';
		storeSettings();
		activateOption(this);
	});

	$('#mappingCustom').click(function() {
		currentMapping = settings.customMapping;
		settings.currentMapping = 'custom';
		storeSettings();
		activateOption(this);
	});

	$('#mappingStore').click(function() {
		downloadJson(currentMapping, 'mapping.json');
	});

	$('#mappingLoad').click(function() {
		var input = $('<input>', { type: 'file' })
		input.change(function(event) {
			var files = event.target.files;
			var reader = new FileReader();
			reader.onload = function(event) {
				try {
					var parsed = JSON.parse(event.target.result);
					if (parsed.digital && parsed.analog) {
						settings.customMapping = parsed;
						settings.currentMapping = 'custom';
						storeSettings();
						currentMapping = parsed;
						activateOption('#mappingCustom');
					} else {
						alert('Error: The mappings file you provided is illformated.')
					}

				} catch (e) {
					alert('Error: Failed to parse mappings JSON file (' + e + ')');
				}
			}
			reader.readAsText(files[0]);
		})
		input.trigger('click');
	});

	$('#modelStore').click(function() {
		var data = {
			linearModel: modelA.linear.serialize(),
			analogModel: modelA.analog.serialize(),
			digitalModel: modelA.digital.serialize()
		}
		downloadJson(data, 'modelData.json');
	});

	$('#modelLaod').click(function() {
		var input = $('<input>', { type: 'file' })
		input.change(function(event) {
			var files = event.target.files;
			var reader = new FileReader();
			reader.onload = function(event) {
				try {
					var parsed = JSON.parse(event.target.result);
					if (parsed.linearModel && parsed.analogModel && parsed.digitalModel) {
						custom.linearModel = parsed.linearModel;
						custom.analogModel = parsed.analogModel;
						custom.digitalModel = parsed.digitalModel;

						setActiveModel(modelB, 'custom');
						settings.modelBId = 'custom';
						storeSettings();

						activateOption('#modelBcustom');
					} else {
						alert('Error: The model data file you provided is illformated.')
					}

				} catch (e) {
					alert('Error: Failed to parse model data JSON file (' + e + ')');
				}
			}
			reader.readAsText(files[0]);
		})
		input.trigger('click');
	});

	$('#modelA15, #modelA30, #modelA60, #modelA120, #modelA240').click(function() {
		var id = $(this).data().model;
		setActiveModel(modelA, id)

		settings.modelAId = modelA.id;
		storeSettings();

		activateOption(this);
	});

	$('#modelB15, #modelB30, #modelB60, #modelB120, #modelB240, #modelBcustom').click(function() {
		var id = $(this).data().model;
		setActiveModel(modelB, id)

		settings.modelBId = modelB.id;
		storeSettings();

		activateOption(this);
	});
});

var drawControllerSelect = function() {
	var divs = d3.select('#controllerSelectGroup').selectAll('.option').data(knownControllers);
	divs.enter()
		.append('div')
			.attr('id', function(d) { return 'controller' + d; })
			.attr('class', 'option')
			.on('click', function(d) {
				activeController = d;
				activateOption('#controller' + activeController);
			})
			.append('span')
				.text(function(d) { return d; })

	activateOption('#controller' + activeController);

	// add clearing divs
	$('#controllerSelectGroup div.clear').remove();
	var options = $('#controllerSelectGroup .option');
	var i = Math.floor(options.length / 2);
	$('<div>', { class: 'clear'}).insertAfter($(options[i-1]));
}

libsw.onMessage = function(data) {
	if (data.type === "ext.input.gamePad.sample") {

		if (data.payload.controllerNumber === activeController) {
			if (data.payload.type === 'digital') {
				if (currentMapping.digital[data.payload.name]) {
					currentSample[data.payload.buttonNumber] = data.payload.value;
				}
			} else if(data.payload.type === 'analog') {
				var mapping = currentMapping.analog[data.payload.name];
				if (mapping) {
					if (mapping.id === 'LS' && mapping.property === 'x') {
						currentAnalogSample.x = data.payload.value;
					} else if (mapping.id === 'LS' && mapping.property === 'y') {
						currentAnalogSample.y = data.payload.value;
					}

					if (data.payload.name === 'axis-5') { // right trigger (XB360)
						linearCurrentID = linearSampler.getID(data.payload.value);
					}
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

	digitalMCs.forEach(function(mc, i) {
		mc.learn(lastStateID, currentStateID);
		mc.truncate(windowLengths[i]);
	});

	var pA = modelA.digital.p(lastStateID, currentStateID);
	var pB = modelB.digital.p(lastStateID, currentStateID);
	var infoA = selfInformation(pA);
	var infoB = selfInformation(pB);

	modelA.history.digital.push(infoA);
	modelB.history.digital.push(infoB);

	maxInformation = Math.max(maxInformation, infoA);
	maxInformation = Math.max(maxInformation, infoB);

	lastSample = currentSample.slice(0); // force copy

	// analog
	var currentAnalogId = discSampler.getID(currentAnalogSample);

	analogMCs.forEach(function(mc, i) {
		mc.learn(lastAnalogID, currentAnalogId);
		mc.truncate(windowLengths[i]);
	});

	pA = modelA.analog.p(lastAnalogID, currentAnalogId);
	pB = modelA.analog.p(lastAnalogID, currentAnalogId);
	infoA = selfInformation(pA);
	infoB = selfInformation(pB);

	modelA.history.analog.push(infoA);
	modelB.history.analog.push(infoB);

	maxInformation = Math.max(maxInformation, infoA);
	maxInformation = Math.max(maxInformation, infoB);


	var probs = modelA.analog.transitionP(currentAnalogId);
	probs.forEach(function(element) {
		d3.select('#graph-cell-' + element.id).attr('fill', c(element.pLog));
	});

	lastAnalogID = currentAnalogId;

	// linear
	linearMCs.forEach(function(mc, i) {
		mc.learn(linearLastID, linearCurrentID);
		mc.truncate(windowLengths[i]);
	});
	linearLastID = linearCurrentID;

	// ready indicator check;
	$('#modelAReady').toggleClass('ready', modelA.analog.ready());
	$('#modelBReady').toggleClass('ready', modelB.analog.ready());
}


var updateGraph = function() {
	for (var i = 0; i < linearMCs.length; i++) {
		var bits = d3.select('#info' + windowLengths[i]).selectAll('.bit').data(modelA.history.digital);
		bits.enter()
			.append('div')
				.attr('class', 'bit')
		bits
			.style('transform', function(d) {return 'scale(1, ' + Math.max(0.05, d / maxInformation) + ')';});

		// $('#markov-value').text(historyData[historyData.length-1].toFixed(2));
		// // $('#markov-bar').width(200 * (historyData[historyData.length-1] / maxInformation));
		$('#maxInformation').text(maxInformation.toFixed(2));
	}
}


var truncateHistory = function() {
	var collection = [modelA.history.analog, modelA.history.digital, modelA.history.mixed,
					modelB.history.analog, modelB.history.digital, modelB.history.mixed];

	collection.forEach(function (list) {
		if (list.length > maxHistoryLength) {
			list = list.splice(list.length - maxHistoryLength);
		}
	});
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

	var probs = modelA.analog.transitionP(id);
	probs.forEach(function(element) {
		d3.select('#cell-' + id + '-' + element.id).attr('fill', c(element.pLog));
	});

	MatrixRoundRobin = (MatrixRoundRobin + 1) % matrixIDs.length;
}

var updateSumSvg = function() {
	var sums = modelA.analog.sums();
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
	modelA.linear.transitionP(linearCurrentID).forEach(function(p) {
		d3.select('#linearPlot-cell-' + p.id).attr('fill', c(p.p));
	})

	var sums = modelA.linear.sums();
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
	var data = discSampler.getFlowData(modelA.analog.Q(), modelA.analog.sums());

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
