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
var linearMCs = {l: [], r: []};
var analogMCs = {l: [], r: []};

for (var i = 0; i < windowLengths.length; i++) {
	digitalMCs[i] = new MarkovChain(true, 16);
	linearMCs.l[i] = new MarkovChain(false);
	linearMCs.r[i] = new MarkovChain(false);
	analogMCs.l[i] = new MarkovChain(false);
	analogMCs.r[i] = new MarkovChain(false);
}
var custom = {
	digital: new StaticModel({}),
	analogLeft: new StaticModel({}),
	analogRight: new StaticModel({}),
	linearLeft: new StaticModel({}),
	linearRight: new StaticModel({})
}

// samplers
var discSampler = new DiscSampler();
var linearSampler = new LinearSampler();

// digital
var currentSample = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
var lastSample = currentSample;

// analog fun
var currentAnalogLeftSample = {x: 0, y: 0};
var currentAnalogRightSample = {x: 0, y: 0};
var lastAnalogLeftID = discSampler.getID(currentAnalogLeftSample);
var lastAnalogRightID = discSampler.getID(currentAnalogRightSample);

// linear stuff
var linearCurrentLeftID;
var linearCurrentRightID;
var linearLastLeftID;
var linearLastRightID;

// current Models
var modelA = {
	id: '15',
	linearLeft: linearMCs.l[0],
	linearRight: linearMCs.r[0],
	analogLeft: analogMCs.l[0],
	analogRight: analogMCs.r[0],
	digital: digitalMCs[0],
	history: {
		analog: [],
		digital: [],
		mixed: []
	}
}
var modelB = {
	id: '15',
	linearLeft: linearMCs.l[0],
	linearRight: linearMCs.r[0],
	analogLeft: analogMCs.l[0],
	analogRight: analogMCs.r[0],
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
var linearMatrixRoundRobin = 0;
var matrixIDs;
var linearMatrixIDs;
var linearSVGSize = {w: 280, h: 40};
var linearMatrixSVGSize = {w: 110, h: 15}
var linearSvgLeft;
var linearSvgRight;
var svgScales = {};

analogSize = 193;
matrixSize = 63;


// quivers
var arrowsLeftA = [];
var arrowsLeftB = [];
var arrowsRightA = [];
var arrowsRightB = [];
jitteredGridSamples(15, 0.7).map(function(sample) {
	if (distance({x: 0, y: 0}, sample) < 1) {
		arrowsLeftA.push({pos: sample});
		arrowsLeftB.push({pos: sample});
		arrowsRightA.push({pos: sample});
		arrowsRightB.push({pos: sample});
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

var cDiffEncoding = d3.scale.linear()
	// .domain([-1, 0, 1])
	// .range(['#E25454', '#444', '#B6CE4E']);
	.domain([-1, -0.01, 0, 0.01, 1])
	.range(['#E25454', '#674848', '#444', '#5D6346', '#B6CE4E']);

var pScaleLinear = function(sum, total) {
	return sum / total;
}
var pScaleLog = function(sum, total) {
	return Math.log(sum+1) / Math.log(total+1);
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
		model.linearLeft = linearMCs.l[index];
		model.linearRight = linearMCs.r[index];
		model.analogLeft = analogMCs.l[index],
		model.analogRight = analogMCs.r[index],
		model.digital = digitalMCs[index];

		model.history = {
			analog: Array.apply(null, new Array(maxHistoryLength)).map(Number.prototype.valueOf,0),
			digital: Array.apply(null, new Array(maxHistoryLength)).map(Number.prototype.valueOf,0),
			mixed: Array.apply(null, new Array(maxHistoryLength)).map(Number.prototype.valueOf,0)
		};
	} else if (id === 'custom') {
		model.id = 'custom';
		model.linearLeft = custom.linearLeft;
		model.linearRight = custom.linearRight;
		model.analogLeft = custom.analogLeft;
		model.analogRight = custom.analogRight;
		model.digital = custom.digital;

		model.history = {
			analog: [],
			digital: [],
			mixed: []
		};
	}
}

$(document).ready(function() {

	loadSettings();

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
			linearLeftModel: modelA.linearLeft.serialize(),
			linearRightModel: modelA.linearRight.serialize(),
			analogLeftModel: modelA.analogLeft.serialize(),
			analogRightModel: modelA.analogRight.serialize(),
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

					if (parsed.linearLeftModel && parsed.linearRightModel
						&& parsed.analogLeftModel && parsed.analogRightModel
						&& parsed.digitalModel) {
						custom.linearLeftModel = parsed.linearLeftModel;
						custom.linearRightModel = parsed.linearRightModel;
						custom.analogLeftModel = parsed.analogLeftModel;
						custom.analogRightModel = parsed.analogRightModel;
						custom.digitalModel = parsed.digitalModel;

						setActiveModel(modelB, 'custom');
						// settings.modelBId = 'custom';
						// storeSettings();

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

	$('#modelA15, #modelA30, #modelA60, #modelA120, #modelA240, #modelAcustom').click(function() {
		var id = $(this).data().model;
		setActiveModel(modelA, id)

		if (id !== 'custom') {
			settings.modelAId = modelA.id;
			storeSettings();
		}

		activateOption(this);
	});

	$('#modelB15, #modelB30, #modelB60, #modelB120, #modelB240, #modelBcustom').click(function() {
		var id = $(this).data().model;
		setActiveModel(modelB, id)

		if (id !== 'custom') {
			settings.modelBId = modelB.id;
			storeSettings();
		}

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
			for (var i = 0; i < windowLengths.length; i++) {
				linearMCs.l[i].reset();
				linearMCs.r[i].reset();
				analogMCs.l[i].reset();
				analogMCs.r[i].reset();
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
		$('.analogDiff').attr('class', 'analogDiff');
		storeSettings();
		activateOption(this);
	})
	$('#diffDiff').click(function() {
		settings.diff = 'diff';
		$('.analogDiff').attr('class', 'analogDiff hidden');
		storeSettings();
		activateOption(this);
	})

	$('#vectorADisplayQuiver').click(function() {
		settings.vectorADisplay = 'quiver';
		storeSettings();
		$('.quiver').attr('class', 'quiver');
		$('.glyph').attr('class', 'glyph hidden');
		activateOption(this);
	})
	$('#vectorADisplayArrow').click(function() {
		settings.vectorADisplay = 'arrow';
		storeSettings();
		$('.quiver').attr('class', 'quiver hidden');
		$('.glyph').attr('class', 'glyph');
		activateOption(this);
	})

	$('#vectorBDisplayOff').click(function() {
		activateOption(this);
		settings.vectorBDisplay = 'off';
		storeSettings();
		$('.quiverB').attr('class', 'quiverB hidden');
		$('.glyphB').attr('class', 'glyphB hidden');
	})
	$('#vectorBDisplayQuiver').click(function() {
		activateOption(this);
		settings.vectorBDisplay = 'quiver';
		storeSettings();
		$('.quiverB').attr('class', 'quiverB');
		$('.glyphB').attr('class', 'glyphB hidden');
	})
	$('#vectorBDisplayArrow').click(function() {
		activateOption(this);
		settings.vectorBDisplay = 'arrow';
		storeSettings();
		$('.quiverB').attr('class', 'quiverB hidden');
		$('.glyphB').attr('class', 'glyphB');
	})

	$('#vectorErrorOff').click(function() {
		activateOption(this);
		settings.vectorError = 'off';
		storeSettings();
	})
	$('#vectorErrorDiff').click(function() {
		activateOption(this);
		settings.vectorError = 'diff';
		storeSettings();
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

	if (settings.vectorADisplay === 'quiver') {
		$('#vectorADisplayQuiver').click();
	} else {
		$('#vectorADisplayArrow').click();
	}

	if (settings.vectorBDisplay === 'off') {
		$('#vectorBDisplayOff').click();
	} else if (settings.vectorBDisplay === 'quiver') {
		$('#vectorBDisplayQuiver').click();
	} else {
		$('#vectorBDisplayArrow').click();
	}

	if (settings.vectorError === 'off') {
		$('#vectorErrorOff').click();
	} else {
		$('#vectorErrorDiff').click();
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
						currentAnalogLeftSample.x = data.payload.value;
					} else if (mapping.id === 'LS' && mapping.property === 'y') {
						currentAnalogLeftSample.y = data.payload.value;
					} else if (mapping.id === 'RS' && mapping.property === 'x') {
						currentAnalogRightSample.x = data.payload.value;
					} else if (mapping.id === 'RS' && mapping.property === 'y') {
						currentAnalogRightSample.y = data.payload.value;
					}

					else if (mapping.id === 'L2') { // right trigger (XB360)
						linearCurrentLeftID = linearSampler.getID(data.payload.value);
					} else if (mapping.id === 'R2') { // right trigger (XB360)
						linearCurrentRightID = linearSampler.getID(data.payload.value);
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

	lastSample = currentSample.slice(0); // force copy


	// analog
	var currentAnalogLeftId = discSampler.getID(currentAnalogLeftSample);
	var currentAnalogRightId = discSampler.getID(currentAnalogRightSample);

	analogMCs.l.forEach(function(mc, i) {
		mc.learn(lastAnalogLeftID, currentAnalogLeftId);
		mc.truncate(windowLengths[i]);
	});
	analogMCs.r.forEach(function(mc, i) {
		mc.learn(lastAnalogRightID, currentAnalogRightId);
		mc.truncate(windowLengths[i]);
	});

	var analogLeft = {};
	analogLeft.pA = modelA.analogLeft.p(lastAnalogLeftID, currentAnalogLeftId);
	analogLeft.pB = modelB.analogLeft.p(lastAnalogLeftID, currentAnalogLeftId);
	analogLeft.infoA = selfInformation(analogLeft.pA);
	analogLeft.infoB = selfInformation(analogLeft.pB);

	var analogRight = {};
	analogRight.pA = modelA.analogRight.p(lastAnalogRightID, currentAnalogRightId);
	analogRight.pB = modelB.analogRight.p(lastAnalogRightID, currentAnalogRightId);
	analogRight.infoA = selfInformation(analogRight.pA);
	analogRight.infoB = selfInformation(analogRight.pB);

	maxInformation = Math.max(maxInformation, analogLeft.infoA + analogRight.infoA);
	maxInformation = Math.max(maxInformation, analogLeft.infoB + analogRight.infoB);

	lastAnalogLeftID = currentAnalogLeftId;
	lastAnalogRightID = currentAnalogRightId;



	// linear
	linearMCs.l.forEach(function(mc, i) {
		mc.learn(linearLastLeftID, linearCurrentLeftID);
		mc.truncate(windowLengths[i]);
	});
	linearMCs.r.forEach(function(mc, i) {
		mc.learn(linearLastRightID, linearCurrentRightID);
		mc.truncate(windowLengths[i]);
	});

	var linearLeft = {};
	linearLeft.pA = modelA.linearLeft.p(linearLastLeftID, linearCurrentLeftID);
	linearLeft.pB = modelB.linearLeft.p(linearLastLeftID, linearCurrentLeftID);
	linearLeft.infoA = selfInformation(linearLeft.pA);
	linearLeft.infoB = selfInformation(linearLeft.pB);

	var linearRight = {};
	linearRight.pA = modelA.linearRight.p(linearLastLeftID, linearCurrentLeftID);
	linearRight.pB = modelB.linearRight.p(linearLastLeftID, linearCurrentLeftID);
	linearRight.infoA = selfInformation(linearRight.pA);
	linearRight.infoB = selfInformation(linearRight.pB);

	linearLastLeftID = linearCurrentLeftID;
	linearLastRightID = linearCurrentRightID;

	// ready indicator check;
	$('#modelAReady').toggleClass('ready', modelA.analogLeft.ready());
	$('#modelBReady').toggleClass('ready', modelB.analogLeft.ready());

	// history and max information
	modelA.history.digital.push(digital.infoA);
	modelB.history.digital.push(digital.infoB);

	var analogA = analogLeft.infoA + analogRight.infoA + linearLeft.infoA + linearRight.infoA;
	var analogB = analogLeft.infoB + analogRight.infoB + linearLeft.infoB + linearRight.infoB;
	modelA.history.analog.push(analogA);
	modelB.history.analog.push(analogB);

	modelA.history.mixed.push(digital.infoA + analogA);
	modelB.history.mixed.push(digital.infoB + analogB);

	maxInformation = Math.max(maxInformation, digital.infoA + analogA, digital.infoB + analogB);
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

	d3.selectAll('#matrixPlotLeft').selectAll('svg').data(matrixIDs)
		.enter()
			.append('svg')
			.attr('class', 'matrix')
			.attr('id', function(d) { return 'matrixLeft-' + d; })
			.attr('width', size + 'px')
			.attr('height', size + 'px');

	d3.selectAll('#matrixPlotRight').selectAll('svg').data(matrixIDs)
		.enter()
			.append('svg')
			.attr('class', 'matrix')
			.attr('id', function(d) { return 'matrixRight-' + d; })
			.attr('width', size + 'px')
			.attr('height', size + 'px');

	var x = d3.scale.linear()
		.domain([-1, 1])
		.range([3, size - 3]);


	matrixIDs.forEach(function(id) {
		var svgs = d3.selectAll('#matrixLeft-' + id + ', #matrixRight-' + id);
		var gs = svgs.append('g');

		svgs.append('defs').append('clipPath')
			.attr('id', 'matrixClip')
			.append('circle')
				.attr('cx', x(0))
				.attr('cy', x(0))
				.attr('r', size / 2 - 4);

		svgs.append('circle')
			.attr('cx', x(0))
			.attr('cy', x(0))
			.attr('r', size / 2 - 2)
			.attr('class', 'outline');

		discSampler.getPaths().forEach(function(path) {
			var lineFunc = d3.svg.line()
				.x(function(d) { return x(d.x); })
	 			.y(function(d) { return x(d.y); })
				.interpolate("linear");

			var drawFunc = function(anchor) {
				return function(d) {
					d.attr('d', lineFunc(path.path))
						.attr('fill', '#444')
						.attr('class', anchor + ' cell-' + id + '-' + path.id)
						.attr('clip-path', 'url(#matrixClip)');
				};
			};

			if (id === path.id) {
				svgs.append('path').call(drawFunc('anchor'))
			} else {
				gs.append('path').call(drawFunc(''));
			}
		});
	})
}

var updateMatrixPlot = function() {
	var id = matrixIDs[MatrixRoundRobin]

	// brute force clearing
	d3.selectAll('#matrixLeft-' + id + ' path').attr('fill', c(0));
	d3.selectAll('#matrixRight-' + id + ' path').attr('fill', c(0));

	var probs = modelA.analogLeft.transitionP(id);
	probs.forEach(function(element) {
		if (settings.pScale === 'linear') {
			d3.select('#matrixPlotLeft .cell-' + id + '-' + element.id).attr('fill', c(element.p));
		} else {
			d3.select('#matrixPlotLeft .cell-' + id + '-' + element.id).attr('fill', c(element.pLog));
		}
	});

	var probs = modelA.analogRight.transitionP(id);
	probs.forEach(function(element) {
		if (settings.pScale === 'linear') {
			d3.select('#matrixPlotRight .cell-' + id + '-' + element.id).attr('fill', c(element.p));
		} else {
			d3.select('#matrixPlotRight .cell-' + id + '-' + element.id).attr('fill', c(element.pLog));
		}
	});

	MatrixRoundRobin = (MatrixRoundRobin + 1) % matrixIDs.length;
}

var updateSumSvg = function() {
	if (settings.diff !== 'diff') {
		// model A Left
		var sums = modelA.analogLeft.sums();
		var total = 0;
		for (var from in sums) {
			if (sums.hasOwnProperty(from)) {
				total += sums[from];
			}
		}

		matrixIDs.forEach(function(id) {
			d3.select('#sumsL-cell-' + id).attr('fill', c(pScale((sums[id] || 0), total)));
		});

		// model B Left
		var sums = modelB.analogLeft.sums();
		var total = 0;
		for (var from in sums) {
			if (sums.hasOwnProperty(from)) {
				total += sums[from];
			}
		}

		matrixIDs.forEach(function(id) {
			d3.select('#sumsL-cell-' + id + '-diff').attr('fill', cDiff(pScale((sums[id] || 0), total)));
		});

		// model A Right
		var sums = modelA.analogRight.sums();
		var total = 0;
		for (var from in sums) {
			if (sums.hasOwnProperty(from)) {
				total += sums[from];
			}
		}

		matrixIDs.forEach(function(id) {
			d3.select('#sumsR-cell-' + id).attr('fill', c(pScale((sums[id] || 0), total)));
		});

		// model B Right
		var sums = modelB.analogRight.sums();
		var total = 0;
		for (var from in sums) {
			if (sums.hasOwnProperty(from)) {
				total += sums[from];
			}
		}

		matrixIDs.forEach(function(id) {
			d3.select('#sumsR-cell-' + id + '-diff').attr('fill', cDiff(pScale((sums[id] || 0), total)));
		});
	} else { // diff
		// Left
		var sumsA = modelA.analogLeft.sums();
		var sumsB = modelB.analogLeft.sums();
		var totalA = 0;
		var totalB = 0;
		for (var from in sumsA) {
			if (sumsA.hasOwnProperty(from)) {
				totalA += sumsA[from];
			}
		}
		for (var from in sumsB) {
			if (sumsB.hasOwnProperty(from)) {
				totalB += sumsB[from];
			}
		}

		matrixIDs.forEach(function(id) {
			d3.select('#sumsL-cell-' + id).attr('fill',
				cDiffEncoding(pScale((sumsA[id] || 0), totalA) - pScale((sumsB[id] || 0), totalB)));
		});

		// Right
		var sumsA = modelA.analogRight.sums();
		var sumsB = modelB.analogRight.sums();
		var totalA = 0;
		var totalB = 0;
		for (var from in sumsA) {
			if (sumsA.hasOwnProperty(from)) {
				totalA += sumsA[from];
			}
		}
		for (var from in sumsB) {
			if (sumsB.hasOwnProperty(from)) {
				totalB += sumsB[from];
			}
		}

		matrixIDs.forEach(function(id) {
			d3.select('#sumsR-cell-' + id).attr('fill',
				cDiffEncoding(pScale((sumsA[id] || 0), totalA) - pScale((sumsB[id] || 0), totalB)));
		});
	}
}

var setupLinearPlot = function() {

	var dimension = function(d) {
		d.attr('width', linearSVGSize.w)
		.attr('height', linearSVGSize.h);
	}
	linearSvgLeft = d3.select('#linearPlotLeft').append('svg').call(dimension);
	linearSvgRight = d3.select('#linearPlotRight').append('svg').call(dimension);

	var x = d3.scale.linear()
		.domain([0, 1])
		.range([3, linearSVGSize.w - 3]);

	var y = d3.scale.linear()
		.domain([0, 1])
		.range([3, linearSVGSize.h - 3]);

	[linearSvgLeft, linearSvgRight].forEach(function(svg) {
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

	// linear matrix plot
	['leftLinear', 'rightLinear'].forEach(function(id) {
		var svgs = d3.selectAll('#' + id + ' .linearP').append('svg');
		svgs.attr("width", linearMatrixSVGSize.w)
			.attr("height", linearMatrixSVGSize.h)
			.attr('id', function(d, i) { return 'matrix-' + i})
			.attr('class', 'matrix');

		var gs = svgs.append('g');

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

			gs.append('path')
				.attr('d', lineFunc(path.path) + 'Z')
				.attr('fill', '#444')
				.attr('id', function(d, i) { return id + '-matrix-' + i + '-cell-' + path.id; })
				.attr('class', function(d, i) { return (i === path.id) ? 'anchor' : ''})

			// moving things by hand
			var path = $('#' + id + '-matrix-' + path.id + '-cell-' + path.id);
			path.appendTo(path.parent().parent());
		});
	});

	linearMatrixIDs = linearSampler.getAllIDs();
}

var updateLinearPlot = function() {
	// Left sums
	var sums = modelA.linearLeft.sums();
	var total = 0;
	for (var from in sums) {
		if (sums.hasOwnProperty(from)) {
			total += sums[from];
		}
	}

	for (var from in sums) {
		if (sums.hasOwnProperty(from)) {
			d3.select('#linearPlotLeft-cell-' + from).attr('fill', c(pScale(sums[from], total)));
		}
	}

	// Right sums
	var sums = modelA.linearRight.sums();
	var total = 0;
	for (var from in sums) {
		if (sums.hasOwnProperty(from)) {
			total += sums[from];
		}
	}

	for (var from in sums) {
		if (sums.hasOwnProperty(from)) {
			d3.select('#linearPlotRight-cell-' + from).attr('fill', c(pScale(sums[from], total)));
		}
	}

	// matrix left
	var from = linearMatrixIDs[linearMatrixRoundRobin];
	var transitionP = modelA.linearLeft.transitionP(from);
	transitionP.forEach(function(t) {
		if (settings.pScale === 'linear') {
			d3.select('#leftLinear-matrix-' + from + '-cell-' + t.id).attr('fill', c(t.p));
		} else {
			d3.select('#leftLinear-matrix-' + from + '-cell-' + t.id).attr('fill', c(t.pLog));
		}
	})

	// matrix right
	var from = linearMatrixIDs[linearMatrixRoundRobin];
	var transitionP = modelA.linearRight.transitionP(from);
	transitionP.forEach(function(t) {
		if (settings.pScale === 'linear') {
			d3.select('#rightLinear-matrix-' + from + '-cell-' + t.id).attr('fill', c(t.p));
		} else {
			d3.select('#rightLinear-matrix-' + from + '-cell-' + t.id).attr('fill', c(t.pLog));
		}
	})

	linearMatrixRoundRobin = (linearMatrixRoundRobin + 1) % linearMatrixIDs.length;
}

var setupFlowVis = function() {
	d3.selectAll('#flowL svg defs, #flowR svg defs').append('marker')
		.attr('id', 'markerArrowA')
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

	d3.selectAll('#flowL svg defs, #flowR svg defs').append('marker')
		.attr('id', 'markerArrowB')
		.attr('viewBox', '0 0 10 10')
		.attr('markerWidth', 5)
		.attr('markerHeight', 4)
		.attr('refX', 2)
		.attr('refY', 5)
		.attr('orient', 'auto')
		.append('path')
			.attr('d', 'M0,0 L0,10 L10,5 L0,0')
			.attr('fill', '#e89f49')
			.attr('style', 'stroke-width: 0px');

	d3.selectAll('#flowL svg defs, #flowR svg defs').append('marker')
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

	d3.selectAll('#flowL svg defs, #flowR svg defs').append('marker')
		.attr('id', 'quiverArrowB')
		.attr('viewBox', '0 0 10 10')
		.attr('markerWidth', 5)
		.attr('markerHeight', 4)
		.attr('refX', 2)
		.attr('refY', 5)
		.attr('orient', 'auto')
		.append('path')
			.attr('d', 'M0,0 L0,10 L10,5 L0,0')
			.attr('fill', '#e89f49')
			.attr('style', 'stroke-width: 0px')

	d3.selectAll('#flowL svg, #flowR svg').append('g')
		.attr('class', 'arrowB');
	d3.selectAll('#flowL svg, #flowR svg').append('g')
		.attr('class', 'quiverB');
	d3.selectAll('#flowL svg, #flowR svg').append('g')
		.attr('class', 'arrowA');
	d3.selectAll('#flowL svg, #flowR svg').append('g')
		.attr('class', 'quiverA');
}

var updateFlowVis = function() {
	// arrows/glyphs
	var data = {
		left: {
			a: discSampler.getFlowData(modelA.analogLeft.Q(), modelA.analogLeft.sums()),
			b: discSampler.getFlowData(modelB.analogLeft.Q(), modelB.analogLeft.sums())
		},
		right: {
			a: discSampler.getFlowData(modelA.analogRight.Q(), modelA.analogRight.sums()),
			b: discSampler.getFlowData(modelB.analogRight.Q(), modelB.analogRight.sums())
		}
	}

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

	// glyph A
	var selection = d3.select('#flowL svg g.arrowA').selectAll('path.glyph').data(data.left.a);
	selection.enter()
		.append('path')
		.attr('class', 'glyph ' + ((settings.vectorADisplay === 'arrow') ? '' : 'hidden'));
	selection // update
		.attr('d', pathSpec);

	var selection = d3.select('#flowR svg g.arrowA').selectAll('path.glyph').data(data.right.a);
	selection.enter()
		.append('path')
		.attr('class', 'glyph ' + ((settings.vectorADisplay === 'arrow') ? '' : 'hidden'));
	selection // update
		.attr('d', pathSpec);

	// glyph B
	var selection = d3.select('#flowL svg g.arrowB').selectAll('path.glyphB').data(data.left.b);
	selection.enter()
		.append('path')
		.attr('class', 'glyphB ' + ((settings.vectorADisplay === 'arrow') ? '' : 'hidden'));
	selection // update
		.attr('d', pathSpec);

	var selection = d3.select('#flowR svg g.arrowB').selectAll('path.glyphB').data(data.right.b);
	selection.enter()
		.append('path')
		.attr('class', 'glyphB ' + ((settings.vectorADisplay === 'arrow') ? '' : 'hidden'));
	selection // update
		.attr('d', pathSpec);


	// quiver plot
	var sites = discSampler.getSites();
	for (var i = 0; i < arrowsLeftA.length; i++) {
		pos = arrowsLeftA[i].pos;

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

		var sumLeftA = {x: 0, y: 0};
		var sumLeftB = {x: 0, y: 0};
		var sumRightA = {x: 0, y: 0};
		var sumRightB = {x: 0, y: 0};
		var weightSum = 0;
		for (var k = 0; k < 3; k++) {
			var pair = sorted[k];
			var siteCenterLeftA = {x: data.left.a[pair.siteId].centerX, y: data.left.a[pair.siteId].centerY}
			var siteCenterLeftB = {x: data.left.b[pair.siteId].centerX, y: data.left.b[pair.siteId].centerY}
			var siteCenterRightA = {x: data.right.a[pair.siteId].centerX, y: data.right.a[pair.siteId].centerY}
			var siteCenterRightB = {x: data.right.b[pair.siteId].centerX, y: data.right.b[pair.siteId].centerY}

			if (pair.distance === 0) {
				sumLeftA = siteCenterLeftA;
				sumLeftB = siteCenterLeftB;
				sumRightA = siteCenterRightA;
				sumRightB = siteCenterrightB;
				weightsSum = 1;
				break;
			}

			weight = 1 / Math.pow(pair.distance, 1);
			sumLeftA = mad(sumLeftA, siteCenterLeftA, weight);
			sumLeftB = mad(sumLeftB, siteCenterLeftB, weight);
			sumRightA = mad(sumRightA, siteCenterRightA, weight);
			sumRightB = mad(sumRightB, siteCenterRightB, weight);
			weightSum += weight;
		}
		sumLeftA = mul(sumLeftA, 1 / weightSum);
		sumLeftB = mul(sumLeftB, 1 / weightSum);
		sumRightA = mul(sumRightA, 1 / weightSum);
		sumRightB = mul(sumRightB, 1 / weightSum);

		arrowsLeftA[i].center = sumLeftA;
		arrowsLeftB[i].center = sumLeftB;
		arrowsRightA[i].center = sumRightA;
		arrowsRightB[i].center = sumRightB;
	}

	var quiverPathSpec = function(d) {
		var dirVector = {
			x: (d.center.x - d.pos.x) / 5,
			y: (d.center.y - d.pos.y) / 5
		};

		return 'M' + x(d.pos.x) + ',' + x(d.pos.y)
			+ ' L' + x(d.pos.x + dirVector.x) + ',' + x(d.pos.y + dirVector.y);
	};

	// data A
	var selection = d3.select('#flowL svg g.quiverA').selectAll('path.quiver').data(arrowsLeftA);
	selection.enter()
		.append('path')
		.attr('class', 'quiver ' + ((settings.vectorADisplay === 'quiver') ? '' : 'hidden'));
	selection // update
		.attr('d', quiverPathSpec);

	var selection = d3.select('#flowR svg g.quiverA').selectAll('path.quiver').data(arrowsRightA);
	selection.enter()
		.append('path')
		.attr('class', 'quiver ' + ((settings.vectorADisplay === 'quiver') ? '' : 'hidden'));
	selection // update
		.attr('d', quiverPathSpec);

	// data B
	var selection = d3.select('#flowL svg g.quiverB').selectAll('path.quiverB').data(arrowsLeftB);
	selection.enter()
		.append('path')
		.attr('class', 'quiverB ' + ((settings.vectorBDisplay === 'quiver') ? '' : 'hidden'));
	selection // update
		.attr('d', quiverPathSpec);

	var selection = d3.select('#flowR svg g.quiverB').selectAll('path.quiverB').data(arrowsRightB);
	selection.enter()
		.append('path')
		.attr('class', 'quiverB ' + ((settings.vectorBDisplay === 'quiver') ? '' : 'hidden'));
	selection // update
		.attr('d', quiverPathSpec);

	// error plot
	var mapErr = function(data) {
		return function(d, i) {
			var diff = sub({x: (d.dirX || 0), y: (d.dirY || 0)},
				{x: (data.b[i].dirX || 0), y: (data.b[i].dirY || 0)});
			return norm2(diff) * 3; // FIXME: arbitrary scaling value!!!
		}
	}
	var errorLeft = data.left.a.map(mapErr(data.left));
	var errorRight = data.right.a.map(mapErr(data.right));

	errorLeft.forEach(function(d, i) {
		d3.select('#flowL-cell-' + i)
			.attr('fill', (settings.vectorError === 'diff') ? c(d) : c(0))
	});
	errorRight.forEach(function(d, i) {
		d3.select('#flowR-cell-' + i)
			.attr('fill', (settings.vectorError === 'diff') ? c(d) : c(0))
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

function distance(a, b) {
	var v = {
		x: b.x - a.x,
		y: b.y - a.y,
	}

	return (v.x * v.x) + (v.y * v.y);
}

function area2D(a, b) {
	return Math.abs(a.x * b.y - a.y * b.x);
}

var add = function(a, b) {
	return {x: a.x + b.x, y: a.y + b.y};
}

var sub = function(a, b) {
	return {x: a.x - b.x, y: a.y - b.y};
}

var mul = function(a, s) {
	return {x: a.x * s, y: a.y * s};
}

var mad = function(a, b, s) {
	return {x: a.x + b.x * s, y: a.y + b.y * s};
}

var norm2 = function(a) {
	return a.x * a.x + a.y * a.y;
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
