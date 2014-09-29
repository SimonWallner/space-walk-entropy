// sampling on a disc
var DiscSampler = function() {

	var voronoi = new Voronoi();
	var bbox = {xl: -1, xr: 1, yt: -1, yb: 1};

	var circleDistances = [0.3, 0.6, 0.95];
	var circleCounts = [5, 10, 20];
	var sites = [{x: 0, y: 0}]

	circleDistances.forEach(function(distance, index) {
		var count = circleCounts[index];
			
		var angleInc = (2 * Math.PI) / count;
		for (var i = 0; i < count; i++) {
			var point = {
				x: distance * Math.cos(angleInc * i),
				y: distance * Math.sin(angleInc * i),
			}
			sites.push(point);
		}
	})


	 // {x: 0.75, y: 0.75}, {x: -0.75, y: 0.75}, {x: -0.75, y: -0.75}, {x: 0.75, y: -0.75}];
	var diagram = voronoi.compute(sites, bbox);

	this.getID = function(x, y) {
		if (y === undefined) { // passing in an object instead of coords...
			y = x.y;
			x = x.x;
		}

		var minDistance = Infinity;
		var minIndex = -1;

		sites.forEach(function(element, index) {
			var d = distance(element, {x: x, y: y});
			if (d < minDistance) {
				minDistance = d;
				minIndex = index;
			}
		})

		if (minIndex > -1) {
			return minIndex.toString();
		}

		return 'index-not-found';
	}

	this.getAllIDs = function() {
		var that = this;
		var sorted = sites.slice();
		sorted.sort(function(a, b) {
			if (a.x !== b.x) {
				return a.y - b.y;
			} else {
				return a.x - b.x;
			}
			return 0;
		});
		return sorted.map(function(element) {
			return that.getID(element);
		})
	}

	this.getPaths = function() {
		var that = this;
		var paths = [];
		
		diagram.cells.forEach(function(cell) {
			var path = [];
			path.push(cell.halfedges[0].getStartpoint());
			cell.halfedges.forEach(function(edge) {
				path.push(edge.getEndpoint());
			})
			paths.push({
				path: path,
				id: that.getID(cell.site)
			});
		})

		return paths;
	}

	this.getSites = function() {
		return sites;
	}

	// utils

	// map x from [a, b] to [r, s]
	var map = function(a, b, r, s, x) {
		var t = (x - a) / (b - a);
		return r + (t * s - r);
	}

	var distance = function(a, b) {
		var v = {
			x: b.x - a.x,
			y: b.y - a.y,
		}

		return (v.x * v.x) + (v.y * v.y);
	}
}