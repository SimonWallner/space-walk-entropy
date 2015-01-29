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

// reset model
resetModelArmed = false;

// display
var svgSize = {};
var svgPadding = 5;
var MatrixRoundRobin = 0;
var matrixIDs;
var linearSVGSize = {w: 280, h: 40};
var linearMatrixSVGSize = {w: 110, h: 15}
var linearSvg;
var svgScales = {};

analogSize = 193;
matrixSize = 63;


// quivers
var arrows = [];
jitteredGridSamples(15, 0.7).map(function(sample) {
	if (distance({x: 0, y: 0}, sample) < 1) {
		arrows.push({pos: sample});
	}
})


// shared
var cMono = d3.scale.linear()
	.domain([0, 1])
	.range(['#444', '#e25454']);

var cMonoDiff = d3.scale.linear()
	.domain([0, 1])
	.range(['#444', '#55C3E0']);

var cHeat = d3.scale.linear()
	.domain([0, 0.5, 0.8, 1])
	.range(['#444', '#DCE055', '#e25454', '#FF0000']);

var cHeatDiff = d3.scale.linear()
	.domain([0, 0.5, 0.8, 1])
	.range(['#444', '#55E091', '#55D3E0', '#008CFF']);

var c = cHeat;
var cDiff = cHeatDiff;

var pScaleLinear = function(sum, total) {
	return sum / total;
}
var pScaleLog = function(sum, total) {
	return Math.max(0, Math.log(sum)) / Math.log(total);
}
var pScale = pScaleLog;

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
			analog: Array.apply(null, new Array(maxHistoryLength)).map(Number.prototype.valueOf,0),
			digital: Array.apply(null, new Array(maxHistoryLength)).map(Number.prototype.valueOf,0),
			mixed: Array.apply(null, new Array(maxHistoryLength)).map(Number.prototype.valueOf,0)
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
	setupGraph();
	setupAnalog();


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

	$('#modelReset').click(function() {
		resetModelArmed = !resetModelArmed;
		$(this).toggleClass('armed', resetModelArmed);
		$('#modelResetConfirm').toggleClass('safety', !resetModelArmed);
		$('#modelResetConfirm').toggleClass('flashing', resetModelArmed);
	});

	$('#modelResetConfirm').click(function() {
		if (resetModelArmed) {
			for (var i = 0; i < windowLengths; i++) {
				linearMCs[i].reset();
				analogMCs[i].reset();
				digitalMCs[i].reset();
			}

			resetModelArmed = false;
			$('#modelReset').toggleClass('armed', resetModelArmed);
			$(this).toggleClass('safety', !resetModelArmed);
			$('#modelResetConfirm').toggleClass('flashing', resetModelArmed);
		}
	});

	$('#scale1').click(function() {
		pScale = pScaleLinear;
		activateOption(this);
		settings.pScale = 'linear';
		storeSettings();
	})

	$('#scaleLog').click(function() {
		pScale = pScaleLog;
		activateOption(this);
		settings.pScale = 'log';
		storeSettings();
	})

	$('#colorHeat').click(function() {
		c = cHeat;
		cDiff = cHeatDiff;
		activateOption(this);
		settings.color = 'heat';
		storeSettings();
	})
	$('#colorMono').click(function() {
		c = cMono;
		cDiff = cMonoDiff;
		activateOption(this);
		settings.color = 'mono';
		storeSettings();
	})

	$('#diffOff').click(function() {
		settings.diff = 'off';

		$('.analogDiff').attr('class', 'analogDiff hidden');
		storeSettings();
		activateOption(this);
	})
	$('#diffSplit').click(function() {
		settings.diff = 'split';
		// ...
		$('.analogDiff').attr('class', 'analogDiff');
		storeSettings();
		activateOption(this);
	})
	$('#diffDiff').click(function() {
		settings.diff = 'diff';
		// ...
		$('.analogDiff').attr('class', 'analogDiff hidden');
		storeSettings();
		activateOption(this);
	})



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

	if (settings.color === 'heat') {
		$('#colorHeat').click();
	} else {
		$('#colorMono').click();
	}

	if (settings.pScale === 'linear') {
		$('#scale1').click();
	} else {
		$('#scaleLog').click();
	}

	if (settings.diff === 'off') {
		$('#diffOff').click();
	} else if (settings.diff === 'split') {
		$('#diffSplit').click();
	} else {
		$('#diffDiff').click();
	}

	setActiveModel(modelA, settings.modelAId);
	activateOption('#modelA' + settings.modelAId);
	setActiveModel(modelB, settings.modelBId);
	activateOption('#modelB' + settings.modelBId);
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

	var digital = {};
	digital.pA = modelA.digital.p(lastStateID, currentStateID);
	digital.pB = modelB.digital.p(lastStateID, currentStateID);
	digital.infoA = selfInformation(digital.pA);
	digital.infoB = selfInformation(digital.pB);

	modelA.history.digital.push(digital.infoA);
	modelB.history.digital.push(digital.infoB);

	maxInformation = Math.max(maxInformation, digital.infoA);
	maxInformation = Math.max(maxInformation, digital.infoB);

	lastSample = currentSample.slice(0); // force copy

	// analog
	var currentAnalogId = discSampler.getID(currentAnalogSample);

	analogMCs.forEach(function(mc, i) {
		mc.learn(lastAnalogID, currentAnalogId);
		mc.truncate(windowLengths[i]);
	});

	var analog = {};
	analog.pA = modelA.analog.p(lastAnalogID, currentAnalogId);
	analog.pB = modelB.analog.p(lastAnalogID, currentAnalogId);
	analog.infoA = selfInformation(analog.pA);
	analog.infoB = selfInformation(analog.pB);

	modelA.history.analog.push(analog.infoA);
	modelB.history.analog.push(analog.infoB);

	maxInformation = Math.max(maxInformation, analog.infoA);
	maxInformation = Math.max(maxInformation, analog.infoB);


	var probs = modelA.analog.transitionP(currentAnalogId);
	probs.forEach(function(element) {
		d3.select('#graph-cell-' + element.id).attr('fill', c(element.pLog));
	});

	lastAnalogID = currentAnalogId;

	// mixed
	modelA.history.mixed.push(digital.infoA + analog.infoA);
	modelB.history.mixed.push(digital.infoB + analog.infoB);


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

var setupGraph = function() {
	svgSize = {
		w: $('#svgDigital').width(),
		h: $('#svgDigital').height()
	};

	svgSize.innerWidth = svgSize.w - 2 * svgPadding;
	svgSize.innerHeight = svgSize.h - 2 * svgPadding;
	svgSize.plotHeight = (svgSize.innerHeight - svgPadding) / 2;

	svgScales.x = d3.scale.linear()
		.domain([0, maxHistoryLength])
		.range([svgPadding, svgSize.innerWidth + svgPadding]);



}

var updateGraph = function() {

	d3.selectAll('g.labels text')
		.text(maxInformation.toFixed(2));

	svgScales.y = d3.scale.linear()
		.domain([0, maxInformation])
		.range([0, svgSize.plotHeight]);

	svgScales.yAxis = d3.svg.axis()
		.scale(svgScales.y)
		.orient("left")
		.ticks(3)
		.innerTickSize(-svgSize.innerWidth)
		.outerTickSize(0)


	var plots = [
		{
			id: '#svgDigital',
			dataA: modelA.history.digital,
			dataB: modelB.history.digital
		},
		{
			id: '#svgAnalog',
			dataA: modelA.history.analog,
			dataB: modelB.history.analog
		},
		{
			id: '#svgMixed',
			dataA: modelA.history.mixed,
			dataB: modelB.history.mixed
		}
	];

	plots.forEach(function(plot) {
		var svg = d3.select(plot.id);

		svg.selectAll('.dataA g.grid, .dataB g.grid')
			.attr('transform', 'translate(5, 0)');
		svg.select('.dataA')
			.attr('transform', 'translate(0, ' + (svgSize.plotHeight + 1 * svgPadding) +') scale(1, -1)');
		svg.select('.dataB')
			.attr('transform', 'translate(0, ' + (svgSize.plotHeight + 2 * svgPadding) +')');

		var barsA = svg.select('.dataA').selectAll('.barA').data(plot.dataA);
		barsA.enter()
			.append('rect')
				.attr('width', 4)
				.attr('class', 'barA');
		barsA
			.attr('x', function(d, i) { return svgScales.x(i); })
			.attr('y', 0)
			.attr('height', function(d, i) { return svgScales.y(d); });

		barsA.exit()
			.remove();


		var barsB = svg.select('.dataB').selectAll('.barB').data(plot.dataB);
		barsB.enter()
			.append('rect')
				.attr('width', 4)
				.attr('class', 'barB');
		barsB
			.attr('x', function(d, i) { return svgScales.x(i); })
			.attr('y', 0)
			.attr('height', function(d, i) { return svgScales.y(d) });

		barsB.exit()
			.remove();



		var diffDigital = plot.dataA.map(function(d, i) {
			return d - plot.dataB[i];
		})

		var barsDiff = svg.select('.diff').selectAll('.diffPos, .diffNeg').data(diffDigital);
		barsDiff.enter()
			.append('rect')
				.attr('width', 4)
		barsDiff
			.attr('x', function(d, i) { return svgScales.x(maxHistoryLength - plot.dataB.length + i); })
			.attr('y', function(d) {
				if (d > 0) {
					return (svgPadding + svgSize.plotHeight) - svgScales.y(d);
				} else {
					return (svgPadding + svgSize.plotHeight + svgPadding);
				}
			})
			.attr('height', function(d) { return svgScales.y(Math.abs(d)) })
			.attr('class', function(d) { return (d > 0) ? 'diffPos' : 'diffNeg'});

		barsB.exit()
			.remove();


		svg.selectAll('.dataA .grid, .dataB .grid')
			.attr("class", "grid")
			.call(svgScales.yAxis)
	})


}


var truncateHistory = function() {
	// FIXME
	// code duplication as fuck. My first approach in beeing smart did not work :(
	if (modelA.history.digital.length > maxHistoryLength) {
		modelA.history.digital = modelA.history.digital.splice(modelA.history.digital.length - maxHistoryLength);
	}

	if (modelA.history.analog.length > maxHistoryLength) {
		modelA.history.analog = modelA.history.analog.splice(modelA.history.analog.length - maxHistoryLength);
	}

	if (modelA.history.mixed.length > maxHistoryLength) {
		modelA.history.mixed = modelA.history.mixed.splice(modelA.history.mixed.length - maxHistoryLength);
	}

	if (modelB.history.digital.length > maxHistoryLength) {
		modelB.history.digital = modelB.history.digital.splice(modelB.history.digital.length - maxHistoryLength);
	}

	if (modelB.history.analog.length > maxHistoryLength) {
		modelB.history.analog = modelB.history.analog.splice(modelB.history.analog.length - maxHistoryLength);
	}

	if (modelB.history.mixed.length > maxHistoryLength) {
		modelB.history.mixed = modelB.history.mixed.splice(modelB.history.mixed.length - maxHistoryLength);
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
			.range([3, analogSize - 3]);

	var labels = ['L', 'R', 'L', 'R'];
	['sumsL', 'sumsR', 'flowL', 'flowR'].forEach(function(id, i) {
		var svg = d3.select('#' + id).append('svg')
			.attr('width', analogSize + 'px')
			.attr('height', analogSize + 'px');

		var defs = svg.append('defs');
		defs.append('clipPath')
			.attr('id', 'clip-' + id)
			.append('circle')
				.attr('cx', x(0))
				.attr('cy', x(0))
				.attr('r', analogSize / 2 - 6);

		svg.append('circle')
			.attr('cx', x(0))
			.attr('cy', x(0))
			.attr('r', analogSize / 2 - 2)
			.attr('class', 'outline');

		svg.append('text')
			.text(labels[i])
			.attr('x', 5)
			.attr('y', 20)
			.attr('class', 'label')

		var centers = discSampler.getCenters();
		discSampler.getPaths().forEach(function(path, index) {
			var lineFunc = d3.svg.line()
				.x(function(d) { return x(d.x); })
	 			.y(function(d) { return x(d.y); })
				.interpolate("linear");

			svg.append('path')
				.attr('d', lineFunc(path.path))
				.attr('fill', '#444')
				.attr('id', id + '-cell-' + path.id)
				.attr('clip-path', 'url(#clip-' + id +')');


		// diff viewer
		var centerX = centers[index].x;
		var clipId = id + '-cell-' + path.id + '-clip';
		defs.append('clipPath')
			.attr('id', clipId)
			.append('rect')
				.attr('x', x(centerX))
				.attr('y', 0)
				.attr('width', x(1))
				.attr('height', x(1))
				.attr('clip-path', 'url(#clip-' + id +')');

		svg.append('path')
			.attr('d', lineFunc(path.path))
			.attr('fill', '#444')
			.attr('id', id + '-cell-' + path.id + '-diff')
			.attr('class', 'analogDiff')
			.attr('clip-path', 'url(#' + clipId +')');
		});
	})
}


var setupMatrixPlot = function() {
	matrixIDs = discSampler.getAllIDs();
	var size = matrixSize;

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
		// TODO: fixme somehow it is the other way round...
		if (settings.pScale === 'linear') {
			d3.select('#cell-' + id + '-' + element.id).attr('fill', c(element.p));
		} else {
			d3.select('#cell-' + id + '-' + element.id).attr('fill', c(element.pLog));
		}
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
			d3.select('#sumsL-cell-' + from).attr('fill', c(pScale(sums[from], total)));
		}
	}

	// model B
	var sums = modelB.analog.sums();
	var total = 0;
	for (var from in sums) {
		if (sums.hasOwnProperty(from)) {
			total += sums[from];
		}
	}

	for (var from in sums) {
		if (sums.hasOwnProperty(from)) {
			d3.select('#sumsL-cell-' + from + '-diff').attr('fill', cDiff(pScale(sums[from], total)));
		}
	}
}

var setupLinearPlot = function() {

	var dimension = function(d) {
		d.attr('width', linearSVGSize.w)
		.attr('height', linearSVGSize.h);
	}
	linearSvg = d3.select('#linearPlotLeft').append('svg').call(dimension);
	linearSumsSvg = d3.select('#linearPlotRight').append('svg').call(dimension);

	var x = d3.scale.linear()
		.domain([0, 1])
		.range([3, linearSVGSize.w - 3]);

	var y = d3.scale.linear()
		.domain([0, 1])
		.range([3, linearSVGSize.h - 3]);

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
	});

	// lienar matrix plot
	['leftLinear', 'rightLinear'].forEach(function(id) {

		var svgs = d3.selectAll('#' + id + ' .linearP').append('svg');
		svgs.attr("width", linearMatrixSVGSize.w)
			.attr("height", linearMatrixSVGSize.h)
			.attr('id', function(d, i) { return 'matrix-' + i})
			.attr('class', 'matrix');

		var mX = d3.scale.linear()
			.domain([0, 1])
			.range([1, linearMatrixSVGSize.w - 1]);

		var mY = d3.scale.linear()
			.domain([0, 1])
			.range([1, linearMatrixSVGSize.h - 1]);

		var lineFunc = d3.svg.line()
			.x(function(d) { return mX(d.x); })
			.y(function(d) { return mY(d.y); })
			.interpolate("linear");

		linearSampler.getPaths().forEach(function(path) {
			svgs.append('path')
				.attr('d', lineFunc(path.path))
				.attr('fill', '#444')
				.attr('id', function(d, i) { return id + '-matrix-' + i + '-cell-' + path.id; })
				.attr('class', function(d, i) { return (i === path.id) ? 'anchor' : ''})
		});
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
	d3.select('#flowA svg defs, #flowB svg defs').append('marker')
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

	d3.selectAll('#flowA svg defs, #flowB svg defs').append('marker')
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
		.range([3, analogSize - 3]);
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

	var selection = d3.select('#flowA svg').selectAll('path.quiver').data(arrows);
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
