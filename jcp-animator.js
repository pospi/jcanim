/**
 * Animation handler class
 *
 * Manages animation events & timing between a Viewport and Layer.
 * This level of abstraction allows multiple animations to exist on
 * and update a layer simultaneously - these animations may or may not be tied
 * to the same input event.
 *
 * @requires jcparallax.js
 * @requires jcp-viewport.js
 * @requires jcp-layer.js
 * @author Sam Pospischil <pospi@spadgos.com>
 */
jcparallax.Animator = function(layer, options)
{
	var defaults = {
		movementRangeX : true,	// autodetect
		movementRangeY : true,

		inputEvent : 'mousemove',
		inputHandler : 'mousemove',

		animHandler : 'position',
	};

	this.layer = layer;
	this.viewport = layer.viewport;
	options = $.extend(true, defaults, options);

	// set default range calculation callbacks for builtin animHandlers passed as strings
	if (options.movementRangeX === true || options.movementRangeY === true && !$.isFunction(options.animHandler)) {
		// infer layer movement range calculators for builtin animation handlers
		switch (options.animHandler) {
			case 'position':
			case 'padding':
			case 'margins':
			case 'background':
			case 'stretch':
				switch (options.inputHandler) {
					case 'scroll':
						options.movementRangeX = jcparallax.Layer.rangeCalculators.scrollWidth;
						options.movementRangeY = jcparallax.Layer.rangeCalculators.scrollHeight;
						break;
					default:
						options.movementRangeX = jcparallax.Layer.rangeCalculators.width;
						options.movementRangeY = jcparallax.Layer.rangeCalculators.height;
						break;
				}
				break;
			case 'textShadow':
				options.movementRangeX = jcparallax.Layer.rangeCalculators.fontSize;
				options.movementRangeY = jcparallax.Layer.rangeCalculators.lineHeight;
				break;
			case 'opacity':
				options.movementRangeX = [0, 0];
				options.movementRangeY = jcparallax.Layer.rangeCalculators.opacity;
				break;
		}
	}
	if (typeof options.movementRangeX == 'string') {
		options.movementRangeX = jcparallax.Layer.rangeCalculators[options.movementRangeX];
	}
	if (typeof options.movementRangeY == 'string') {
		options.movementRangeY = jcparallax.Layer.rangeCalculators[options.movementRangeY];
	}

	// interpret animation handler
	if ($.isFunction(options.animHandler)) {			// custom handler callback
		this.animHandler = options.animHandler;
	} else {												// single callback from the predefined set
		this.animHandler = jcparallax.Animator.animHandlers[options.animHandler];
	}

	this.options = options;

	// refresh target element coordinates
	this.refreshCoords();

	// bind input events
	this.bindEvent(options.inputEvent, options.inputHandler);
};

$.extend(jcparallax.Animator.prototype, {

	inputEvent : null,		// DOM input event this animation is bound to
	inputHandler : null,	// input event handler callback to output range normalised value
	animHandler : null,		// animation update handler callback

	minX : null,
	minY : null,
	rangeX : null,	// scaling factors for the animation over input 0-1
	rangeY : null,	// call refreshCoords() to update from the callbacks supplied in options

	// last input sampling coordinates
	lastSampledX : 0,
	lastSampledY : 0,
	lastProcessedX : 0,
	lastProcessedY : 0,

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

		// infer handler from predefined set if a string
		if (typeof handler == 'string') {
			handler = jcparallax.Viewport.inputHandlers[handler];
		}

		// detach old callback first if present
		if (this.inputHandler && this.inputEvent) {
			this.viewport.element.off(this.inputEvent, this.inputHandler);
		}

		// create new callback & bind it to the viewport
		this.inputHandler = function(e) {
			handler.call(that, that.viewport.element, e);
		};
		this.inputEvent = eventName;
		this.viewport.element.on(eventName, this.inputHandler);
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
	 * Refreshes all computed coordinates from our movement range handler
	 * callbacks after layer DOM element is modified externally.
	 */
	refreshCoords : function()
	{
		var xRange, yRange;

		if ($.isFunction(this.options.movementRangeX)) {
			xRange = this.options.movementRangeX.call(this.layer, this.layer.element, this.viewport);
		} else {
			xRange = this.options.movementRangeX;
		}
		if ($.isFunction(this.options.movementRangeY)) {
			yRange = this.options.movementRangeY.call(this.layer, this.layer.element, this.viewport);
		} else {
			yRange = this.options.movementRangeY;
		}

		this.minX = parseFloat(xRange[0]);
		this.rangeX = parseFloat(xRange[1] - xRange[0]);
		this.minY = parseFloat(yRange[0]);
		this.rangeY = parseFloat(yRange[1] - yRange[0]);
	},

	/**
	 * Generate a CSS object for modification of our layer,
	 * using our last sampled input values or the ones provided.
	 * Input values should be 0 < x < 1.
	 *
	 * @return {object} CSS properties to pass to jQuery .css()
	 */
	makeCss : function(xVal, yVal)
	{
		// when positions not passed, just redraw
		if (xVal === undefined && yVal === undefined) {
			xVal = this.lastSampledX;
			yVal = this.lastSampledY;
		}

		if (xVal == this.lastProcessedX && yVal == this.lastProcessedY) {
			return {};	// no change in input
		}
		this.lastProcessedX = xVal;
		this.lastProcessedY = yVal;

		return this.animHandler.call(this, xVal, yVal);
	}
});

//------------------------------------------------------------------------------
// Layer animation handlers
//------------------------------------------------------------------------------

jcparallax.Animator.animHandlers = {

	// standard css attributes - minimal support

	position : function(xVal, yVal)
	{
		return {
			left : this.minX + (xVal * this.rangeX),
			top : this.minY + (yVal * this.rangeY),
		};
	},

	padding : function(xVal, yVal)
	{

	},

	margins : function(xVal, yVal)
	{

	},

	background : function(xVal, yVal)
	{
		return {
			'background-position' : (this.minX + (xVal * this.rangeX)) + 'px ' + (this.minY + (yVal * this.rangeY)) + 'px',
		};
	},

	stretch : function(xVal, yVal)
	{

	},

	// CSS3 attributes

	Xrotate : function(xVal, yVal)	// rotate based on X input
	{
		var css = {};
		css[jcparallax.support.transforms] = 'rotate(' + (this.minX + (xVal * this.rangeX)) + 'deg)';
		return css;
	},

	Yrotate : function(xVal, yVal)	// rotate based on Y input
	{
		var css = {};
		css[jcparallax.support.transforms] = 'rotate(' + (this.minY + (yVal * this.rangeY)) + 'deg)';
		return css;
	},

	textShadow : function(xVal, yVal)
	{

	},

	opacity : function(xVal, yVal)
	{

	}
};
