/**
 * Parallax viewport class
 *
 * Creates a new parallax viewport controller on the given element, which will animate child elements as layers.
 *
 * @requires jcparallax.js
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
	this.options = jcparallax.Viewport._calcMovementRanges($.extend(true, defaults, options));

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

	// bind input event & store our event handler callback
	if ($.isFunction(this.options.inputHandler)) {
		this.bindEvent(this.options.inputEvent, this.options.inputHandler);
	} else {
		this.bindEvent(this.options.inputHandler, jcparallax.Viewport.inputHandlers[this.options.inputHandler]);
	}

	// start our animation timer
	this.timer.start();
};

$.extend(jcparallax.Viewport, {

	/**
	 * Handles default values for class options by filling
	 * advanced parameters based on the presence of default values.
	 * @param  {object} options incoming options object
	 * @return the processed options
	 */
	_calcMovementRanges : function(options)
	{
		// set default range calculation callbacks
		if (options.movementRangeX === true || options.movementRangeY === true && !$.isFunction(options.animHandler)) {
			// infer layer movement range calculators for builtin animation handlers
			switch (options.animHandler) {
				case 'position':
				case 'padding':
				case 'margins':
				case 'background':
				case 'stretch':
					switch (options.inputHandler) {
						case 'mousemove':
							options.movementRangeX = 'width';
							options.movementRangeY = 'height';
							break;
						case 'scroll':
							options.movementRangeX = 'scrollWidth';
							options.movementRangeY = 'scrollHeight';
							break;
					}
					break;
				case 'textShadow':
					options.movementRangeX = 'fontSize';
					options.movementRangeY = 'lineHeight';
					break;
				case 'opacity':
					options.movementRangeX = 0;
					options.movementRangeY = 'opacity';
					break;
			}
		}

		return options;
	}
});

$.extend(jcparallax.Viewport.prototype, {

	// cached viewport coordinate data
	offsetX : null,
	offsetY : null,
	sizeX : null,
	sizeY : null,
	scrollX : null,
	scrollY : null,

	// last input sampling coordinates
	lastSampledX : 0,
	lastSampledY : 0,
	lastProcessedX : 0,
	lastProcessedY : 0,

	boundEvent : null,	// name of the raw DOM event bound to
	inputCb : null,		// actual bound event listener function

	/**
	 * Binds the DOM event responsible for handling our updates
	 * @param  {string}   eventName name of the DOM event to bind to for updates
	 * @param  {function} handler   Callback for handling the event.
	 *                              Accepts the bound layer element, x position (0 <= x <= 1), y position and event object as parameters.
	 */
	bindEvent : function(eventName, handler)
	{
		var that = this;

		eventName += jcparallax.eventNamespace;

		// detach old callback first if present
		if (this.inputCb && this.boundEvent) {
			this.element.off(this.boundEvent, this.inputCb);
		}

		// create new callback & bind it to the viewport
		this.inputCb = function(e) {
			handler.call(that, that.element, e);
		};
		this.boundEvent = eventName;
		this.element.on(eventName, this.inputCb);
	},

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
	 * Update the positions of all layers in response to an input event
	 * @param  {float} xVal input X value, in the range of 0 < x < 1. If ommitted the last sampled X value is used.
	 * @param  {float} yVal input Y value, in the range of 0 < y < 1. If ommitted the last sampled Y value is used.
	 *
	 * @return true if the input event coordinates were different to last time - required for CSS transition timing to function
	 */
	updateLayers : function(xVal, yVal)
	{
		// when positions not passed, just redraw
		if (xVal === undefined && yVal === undefined) {
			xVal = this.lastSampledX;
			yVal = this.lastSampledY;
		}

		if (xVal == this.lastProcessedX && yVal == this.lastProcessedY) {
			return false;	// no change in input
		}
		this.lastProcessedX = xVal;
		this.lastProcessedY = yVal;

		// redraw the layer elements
		var changed = false;
		$.each(this.layers, function(i, layer) {
			if (layer.redraw.call(layer, xVal, yVal)) {
				changed = true;
			}
		});
		return changed;		// return to indicate whether layers needed updating
	},

	/**
	 * Updates the sampled input position for calculating the effect.
	 * This method should be called for every event encountered to update
	 * the X and Y values, which are then applied at the next frame interval.
	 */
	updateLastSamplePos : function(xVal, yVal)
	{
		this.lastSampledX = xVal;
		this.lastSampledY = yVal;
	},

	/**
	 * Refreshes the coordinates of the viewport used in parallax calculation
	 */
	refreshCoords : function()
	{
		var offset = this.element.offset();

		this.offsetX = offset.left;
		this.offsetY = offset.top;
		this.sizeX = this.element.width();
		this.sizeY = this.element.height();
		this.scrollX = this.element.attr('scrollWidth');
		this.scrollY = this.element.attr('scrollHeight');

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
		var xPos = evt.pageX - this.offsetX,
			yPos = evt.pageY - this.offsetY;

		this.updateLastSamplePos(xPos / this.sizeX, yPos / this.sizeY);
	},

	scroll : function(el, evt)
	{
		var xPos = el.scrollLeft(),
			yPos = el.scrollTop();

		this.updateLastSamplePos(xPos / this.scrollX, yPos / this.scrollY);
	},

	click : function(el, evt)
	{
		var xPos = evt.pageX - this.offsetX,
			yPos = evt.pageY - this.offsetY;

		// :TODO: start a timer to animate the parallax over the specified duration
		this.updateLastSamplePos(xPos / this.sizeX, yPos / this.sizeY);
	}
};

})(jQuery);
