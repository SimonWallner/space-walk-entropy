// sampling on a disc
var DiscSampler = function() {

	var voronoi = new Voronoi();
	var bbox = {xl: -1, xr: 1, yt: -1, yb: 1};
	var sites = [{x: 0, y: 0}, {x: 0.75, y: 0.75}, {x: -0.75, y: 0.75}, {x: -0.75, y: -0.75}, {x: 0.75, y: -0.75}];
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