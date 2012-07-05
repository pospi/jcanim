/**
 * Parallax viewport class
 *
 * Creates a new parallax viewport controller on the given element, which will animate child elements as layers.
 *
 * @requires jcparallax.js
 * @requires jcp-animator.js
 * @requires jcp-timer.js
 * @requires jcp-layer.js
 *
 * @param {jQuery} el           element to read input coordinates from for animating the parallax
 * @param {object} options      default options for each layer's movement
 * @param {object} layerOptions array of options corresponding to each layer resulting from running
 *                              options.layerSelector against the viewport element (or against each element
 *                              in options.layerSelector if it is provided as a jQuery collection)
 */
(function($) {

jcparallax.Viewport = function(el, options, layerOptions)
{
	// setup element & cache dimensions
	this.element = el;
	this.refreshCoords();

	// default options
	var defaults = {
		layerSelector:	'.jcp-layer',

		movementRangeX:	true,
		movementRangeY: true,

		inputEvent:		null,		// for use when using a custom inputHandler callback
		inputHandler:	'mousemove',

		animHandler:	'position',
		framerate:		120,		// sampling rate (in ms) when using CSS transitions to tween between samples
		fbFramerate:	null,		// sampling rate for fallback plain-js mode. Calculated from framerate if not provided.
		transitionCheckCb : null
	};

	// determine layer movement ranges if set to automatic
	this.options = $.extend(true, defaults, options);

	// set layer opts for passing on to child layers
	this.layerOptions = layerOptions;

	// create the timer handler for updating the effect (:TODO: disable when inactive, reuse synced timers)
	var that = this;
	this.timer = new jcparallax.TransitionInterval(function() {
		return that.updateLayers.call(that);
	}, this.options.framerate, this.options.fbFramerate, function() {
		that._checkFramerate.call(that);
	});

	// find layers
	var layers;
	if (options.layerSelector.jquery) {
		layers = options.layerSelector;
	} else {
		layers = $(options.layerSelector, el);
	}

	// initialise layers
	this.addLayers(layers);

	// start our animation timer
	this.timer.start();
};

$.extend(jcparallax.Viewport.prototype, {

	// cached viewport coordinate data
	offsetX : null,
	offsetY : null,
	sizeX : null,
	sizeY : null,
	scrollX : null,
	scrollY : null,

	/**
	 * Add elements as layers to this viewport
	 * @param {jQuery} layerEls jQuery collection containing new layer elements to create
	 */
	addLayers : function(layerEls)
	{
		var that = this;

		this.layers = [];

		layerEls.each(function(i) {
			var opts = $.extend({}, that.options),
				layer = $(this),
				handler;

			// build options by merging in layer-specific overrides
			if (that.layerOptions && that.layerOptions[i]) {
				$.extend(opts, that.layerOptions[i]);
			}

			// create and store the new layer handler
			handler = new jcparallax.Layer(that, layer, opts);

			layer.data(jcparallax.layerStorageKey, handler);

			that.layers.push(handler);
		});

		this.timer.addElements(layerEls);	// add layer elements for control by the timer
	},

	/**
	 * Call for a redraw in the positions of all layers
	 * This moves the layers in response to their Animator's last sampled input
	 * position from its input callback, and should be run at a regular interval
	 * for best success.
	 *
	 * @return true if the input event coordinates were different to last time - required for CSS transition timing to function
	 */
	updateLayers : function()
	{
		// redraw the layer elements
		var changed = false;
		$.each(this.layers, function(i, layer) {
			if (layer.redraw()) {
				changed = true;
			}
		});
		return changed;		// return to indicate whether layers needed updating
	},

	/**
	 * Refreshes the coordinates of the viewport used in input normalisation,
	 * as well as refreshing the movement ranges for all layers under the control
	 * of the viewport.
	 */
	refreshCoords : function()
	{
		var offset = this.element.offset();

		this.offsetX = offset.left;
		this.offsetY = offset.top;
		this.sizeX = this.element.width();
		this.sizeY = this.element.height();
		this.scrollX = this.element[0].scrollWidth - this.sizeX;
		this.scrollY = this.element[0].scrollHeight - this.sizeY;

		if (this.layers) {
			$.each(this.layers, function(i, layer) {
				layer.refreshCoords();
			});
		}
	},

	/**
	 * Checks input jcparallax options and returns the appropriate framerate for
	 * animation depending on available browser support.
	 *
	 * Used internally by Viewport and Layer classes to determine animation speed.
	 *
	 * @param  {object}   opts             input options map to jcparallax.Viewport or jcparallax.Layer
	 * @param  {function} transitionCheckCb (optional) callback for additional custom checking of the input options, to enable future expansion.
	 *                                     This callback should return TRUE if CSS transitions can be used for the animHandler given in the options.
	 * @return {int} the sampling interval to animate this transition at, in ms
	 */
	_checkFramerate : function()
	{
		return ((!jcparallax.support.backgroundTransitions && this.options.animHandler == 'background')
		 || (!jcparallax.support.textShadowTransitions && this.options.animHandler == 'textShadow')
		 || (this.options.transitionCheckCb && !this.options.transitionCheckCb.call(this, this.options)));
	}
});

//------------------------------------------------------------------------------
// Input event handlers
//------------------------------------------------------------------------------

jcparallax.Viewport.inputHandlers = {

	mousemove : function(el, evt)
	{
		var xPos = evt.pageX - this.viewport.offsetX,
			yPos = evt.pageY - this.viewport.offsetY;

		this.updateLastSamplePos(xPos / this.viewport.sizeX, yPos / this.viewport.sizeY);
	},

	scroll : function(el, evt)
	{
		var xPos = el.scrollLeft(),
			yPos = el.scrollTop();

		// :NOTE: scroll offsets are often calculated smaller than the available space due to scrollbar space
		this.updateLastSamplePos(this.viewport.scrollX ? Math.min(1, xPos / this.viewport.scrollX) : 0,
								 this.viewport.scrollY ? Math.min(1, yPos / this.viewport.scrollY) : 0);
	},

	click : function(el, evt)
	{
		var xPos = evt.pageX - this.viewport.offsetX,
			yPos = evt.pageY - this.viewport.offsetY;

		// :TODO: start a timer to animate the parallax over the specified duration
		this.updateLastSamplePos(xPos / this.viewport.sizeX, yPos / this.viewport.sizeY);
	},

	// the following advanced events would need to have inputEvent provided in options as well

	mousemove_xcentered : function(el, evt)
	{
		var xPos = evt.pageX - this.viewport.offsetX,
			yPos = evt.pageY - this.viewport.offsetY,
			halfX = this.viewport.sizeX / 2;
		if (xPos > halfX) {
			xPos -= halfX;
			xPos = halfX - xPos;
		}
		this.updateLastSamplePos((xPos / this.viewport.sizeX) * 2, yPos / this.viewport.sizeY);
	}
};

})(jQuery);
