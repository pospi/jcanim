/**
 * jc-parallax - Javascript & Css Parallax
 * =======================================
 *
 * Manages input coordinates and converts into the appropriate css attributes
 * for coordinate positioning of layer elements for a parallax effect.
 *
 * By default the library will attempt to use CSS transitions, if supported
 * by the browser, to decrease the sampling rate of the mouse (or other) input.
 * This has the effect of dramatically lowering the CPU usage of the effect, reducing
 * stuttering considerably. The resulting animation is usually offloaded to the GPU,
 * resulting in a much higher framerate and smoother effect.
 *
 * Usage:
 * 		$('#parallax-viewport').jcparallax(options, layerOpts);
 *
 * To create a parallax effect over the whole page, simply run .jcparallax on the document
 * element.
 *
 * To retrive the underlying jcparallax handler:
 * 		var p = $('#parallax-viewport').data('jcparallax');
 *
 * Or to call methods directly:
 * 		$('#parallax-viewport').jcparallax(
 *
 * Options
 * =======
 * All options can be given in the options argument or one of the elements of the
 * layerOpts argument (except where noted), which is an array corresponding to each
 * layer in the layerSelector result. These options, if given, extend the base
 * options supplied to the host viewport.
 *
 * :TODO: document options
 *
 * Layer ranges & range callbacks
 * ------------------------------
 * 	By default, layers will move so that their left/topmost side is flush with the left/top
 * 	of the viewport at one extreme, and the bottom/rightmost side is flush at the other. In the
 * 	cases of non-positional animation handlers (see below), the range is from 0 - 1 or from
 * 	one extreme to the other.
 *
 * 	The 'zero' sizes and positions of the layer elements and viewport are precomputed when initialised,
 * 	as are the ranges of layer motion as computed by callbacks passed as these parameters.
 *  To refresh viewports or layers in response to DOM updates, @see refreshCoords
 *  By default, coordinates are refreshed when the screen is resized.
 *
 * 	When present, layer ranges should be given as two-element arrays specifying the minimum and maximum
 * 	values for the range of the layer's movement. How each animation handler interprets these is up to it,
 * 	but is usually fairly straightforward.
 *
 * 	The builtin range callbacks are:
 * 		RANGECB_WIDTH & RANGECB_HEIGHT:
 *   		Returns the width and height of the element, as maximum X and Y offsets.
 *
 * 		RANGECB_SCROLLWIDTH & RANGECB_SCROLLHEIGHT:
 *   		Returns the maximum scroll range of the element as maximum X and Y offsets.
 *
 * 		RANGECB_FONTSIZE & RANGECB_LINEHEIGHT:
 *   		Returns the current font size and line height of the element, as maximum X and Y offsets for the text shadow.
 *
 * 		RANGECB_CURROPACITY:
 * 			Returns the current opacity of the element as the maximum Y offset.
 *
 * Input handlers
 * --------------
 * 	Control the input for the parallax effect. These are simply functions which return
 * 	two values in the range 0 - 1, indicating the relative position of each input axis.
 * 	The X axis input is always returned first.
 *
 * 	The builtin handlers are:
 * 		INPUT_MOUSE (coerces inputEvent to 'mousemove'):
 * 			Receives and handles mouse coordinates (either document relative,
 * 			or relative to some viewport element).
 *
 * 		INPUT_SCROLL (coerces inputEvent to 'scroll'):
 * 			Reads the scrollTop and scrollLeft properties of an element.
 *
 * Animation handlers
 * ------------------
 * 	Control the output behaviour of the transformations applied to layer elements. These
 * 	take the form of callbacks which manipulate the element's coordinates in response
 * 	to the outputs from an input handler.
 *
 * 	These are the builtin handlers:
 * 		ANIM_POSITION:
 * 			Animates the width & height properties of the target elements.
 *    		This handler achieves the effect by ofsetting the targeted elements directly.
 *
 * 		ANIM_PADDING & ANIM_MARGINS:
 *   		Animates the padding-top and padding-left or margin-top and margin-left attributes of the target elements
 *   		to achieve the same effect as ANIM_POSITION.
 *   		This handler achieves the effect by moving the target element's contents inward by affecting their container.
 *
 * 		ANIM_BACKGROUND: (css mode not supported in opera)
 *    		Animates the background-position attribute of target elements to achieve the same effect as ANIM_POSITION.
 *    		This handler causes the target element's background image to shift to achieve the parallax effect.
 *
 * 		ANIM_STRETCH:
 * 			Animate the width and / or height attribute of the target elements. This handler can be used to stretch any
 * 			element aligned horizontally or vertically with the perspective plane of your designs, to achieve a faux-3d effect.
 *
 *    	ANIM_TEXTSHADOW: (css mode not supported in opera, blur not working in safari but not being animated)
 *    		Animates the text-shadow's position attribute of the target elements.
 *    		This handler causes the text shadow of an element to move in parallax.
 *
 * 		ANIM_OPACITY:
 * 			Possibly quirky, this handler is supplied anyway for animating the opacity of elements
 * 			in response to a parallax effect. This could be useful for fading out layers as they cross
 * 			or other such effects. Only responds to one axis of motion.
 *
 * TODO
 * ----
 * - make use of transitionEnd events where available
 * - detect mouse exiting viewport & update last position
 * - allow toggling the behaviour
 * - dont add transition duration properties if we dont need it
 * - replace out higher-level jQuery stuff (.css(), etc)
 * - input handler for click
 *
 * @requires	jquery 1.7.1	http://jquery.com
 * @requires	js-parallax.css
 *
 * @author Sam Pospischil <pospi@spadgos.com>
 * @license MIT
 */

// exports
var jcparallax = {};

(function($) {

//------------------------------------------------------------------------------
// Globals
//------------------------------------------------------------------------------

$.extend(jcparallax, {
	viewportStorageKey : 'jcparallax-vp',
	layerStorageKey :	 'jcparallax-l',
	jsDomPrefixes :		 'Moz O Webkit ms'.split(' '),
	cssDomPrefixes :	 '-moz- -o- -webkit- -ms-'.split(' '),

	// detect transition support flags: general support, background support & text-shadow position support
	detectSupport : function()
	{
		var ok = false,		// transitions supported at all
			bgOk = true,	// background-position transition supported (not in opera as of 22/6/12 @see http://www.quirksmode.org/css/transitions.html)
			tsOk = true;	// text-shadow transition supported (not in opera)
		if ($.browser.msie) {
			return [false, false, false];
		} else {
			// check browser transition support via style DOM object. Credits to Modernizr here for the method.
			var props = ('Transition ' + jcparallax.jsDomPrefixes.join('Transition ') + 'Transition').split(' '),
				testEl = document.createElement('jcparallax'),
    			styleObj = testEl.style;

			for (var i in props) {
				if (styleObj[ props[i] ] !== undefined) {
					ok = true;
					break;
				}
			}

			// flag background and text-shadow to use fallback mode in opera
			if ($.browser.opera) {
				bgOk = false;
				tsOk = false;
			}
		}

		return [ok, bgOk, tsOk];
	}
});
jcparallax.support = jcparallax.detectSupport();

//------------------------------------------------------------------------------
// Viewport class
//------------------------------------------------------------------------------

/**
 * Create a new parallax viewport on the given element.
 * @param {jQuery} el           element to read input coordinates from for animating the parallax
 * @param {object} options      default options for each layer's movement
 * @param {object} layerOptions array of options corresponding to each layer resulting from running
 *                              options.layerSelector against the viewport element (or against each element
 *                              in options.layerSelector if it is provided as a jQuery collection)
 */
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

		inputEvent:		'mousemove',
		inputHandler:	'INPUT_MOUSE',

		animHandler:	'ANIM_POSITION',
		framerate:		120,		// sampling rate (in ms) when using CSS transitions to tween between samples
		fbFramerate:	null,		// sampling rate for fallback plain-js mode. Calculated from framerate if not provided.
		framerateCheckCb : null
	};

	// extend defaults & assign interpreted options
	this.options = jcparallax.Viewport._handleOptions($.extend(true, defaults, options));

	// set instance opts
	this.layerOptions = layerOptions;

	// find layers
	var layers;
	if (options.layerSelector.jquery) {
		layers = options.layerSelector;
	} else {
		layers = $(options.layerSelector, el);
	}

	// initialise layers
	this.addLayers(layers);

	// check sampling rate based on support for the animation type specified
	this.setFramerate(jcparallax.Viewport._checkFramerate(this.options, this.options.framerateCheckCb));

	// bind input event & store our event handler callback
	if ($.isFunction(this.options.inputHandler)) {
		this.bindEvent(this.options.inputEvent, this.options.inputHandler);
	} else {
		this.bindEvent(this.options.inputEvent, jcparallax.Viewport[this.options.inputHandler]);
	}
};

// SINGLE-INSTANCE METHODS

$.extend(jcparallax.Viewport, {

	// input event handlers

	INPUT_MOUSE : function(el, evt)
	{
		var xPos = evt.pageX - this.offsetX,
			yPos = evt.pageY - this.offsetY;

		this._updateLastSamplePos(xPos / this.sizeX, yPos / this.sizeY);
	},

	INPUT_SCROLL : function(el, evt)
	{
		var xPos = el.scrollLeft(),
			yPos = el.scrollTop();

		this._updateLastSamplePos(xPos / this.scrollX, yPos / this.scrollY);
	},

	INPUT_CLICK : function(el, evt)
	{
		var xPos = evt.pageX - this.offsetX,
			yPos = evt.pageY - this.offsetY;

		// :TODO: start a timer to animate the parallax over the specified duration
		this._updateLastSamplePos(xPos / this.sizeX, yPos / this.sizeY);
	},

	/**
	 * Handles default values for class options by filling
	 * advanced parameters based on the presence of default values.
	 * @param  {object} options incoming options object
	 * @return the processed options
	 */
	_handleOptions : function(options)
	{
		// set default range calculation callbacks
		if (options.movementRangeX === true || options.movementRangeY === true && !$.isFunction(options.animHandler)) {
			// infer layer movement range calculators for builtin animation handlers
			switch (options.animHandler) {
				case 'ANIM_POSITION':
				case 'ANIM_PADDING':
				case 'ANIM_MARGINS':
				case 'ANIM_BACKGROUND':
				case 'ANIM_STRETCH':
					switch (options.inputHandler) {
						case 'INPUT_MOUSE':
							options.movementRangeX = 'RANGECB_WIDTH';
							options.movementRangeY = 'RANGECB_HEIGHT';
							break;
						case 'INPUT_SCROLL':
							options.movementRangeX = 'RANGECB_SCROLLWIDTH';
							options.movementRangeY = 'RANGECB_SCROLLHEIGHT';
							break;
					}
					break;
				case 'ANIM_TEXTSHADOW':
					options.movementRangeX = 'RANGECB_FONTSIZE';
					options.movementRangeY = 'RANGECB_LINEHEIGHT';
					break;
				case 'ANIM_OPACITY':
					options.movementRangeX = 0;
					options.movementRangeY = 'RANGECB_CURROPACITY';
					break;
			}

			// infer input event for builtin input handlers
			switch (options.inputHandler) {
				case 'INPUT_MOUSE':
					options.inputEvent = 'mousemove';
					break;
				case 'INPUT_SCROLL':
					options.inputEvent = 'scroll';
					break;
				case 'INPUT_CLICK':
					options.inputEvent = 'click';
					break;
			}
		}

		return options;
	},

	/**
	 * Checks input jcparallax options and returns the appropriate framerate for
	 * animation depending on available browser support.
	 *
	 * Used internally by Viewport and Layer classes to determine animation speed.
	 *
	 * @param  {object}   opts             input options map to jcparallax.Viewport or jcparallax.Layer
	 * @param  {function} framerateCheckCb (optional) callback for additional custom checking of the input options, to enable future expansion.
	 *                                     This callback should return TRUE if CSS transitions can be used for the animHandler given in the options.
	 * @return {int} the sampling interval to animate this transition at, in ms
	 */
	_checkFramerate : function(opts, framerateCheckCb)
	{
		if (!jcparallax.support[0]
		 || (!jcparallax.support[1] && opts.animHandler == 'ANIM_BACKGROUND')
		 || (!jcparallax.support[2] && opts.animHandler == 'ANIM_TEXTSHADOW')
		 || (framerateCheckCb && !framerateCheckCb(opts))) {
			return opts.fbFramerate;
		}

		return opts.framerate;
	}
});

// PER-INSTANCE METHODS & PROPERTIES

$.extend(jcparallax.Viewport.prototype,
{
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

	boundEvent : null,	// name of the raw DOM event bound to
	inputCb : null,		// actual bound event listener function
	framerate : 120,	// :TODO: find good default

	/**
	 * Binds the DOM event responsible for handling our updates
	 * @param  {string}   eventName name of the DOM event to bind to for updates
	 * @param  {function} handler   Callback for handling the event.
	 *                              Accepts the bound layer element, x position (0 <= x <= 1), y position and event object as parameters.
	 */
	bindEvent : function(eventName, handler)
	{
		var that = this;

		eventName += '.jcparallax';

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
	},

	setFramerate : function(ms)
	{
		// set it
		this.framerate = ms;

		// update the layer framerates (sets transition-duration properties as required)
		$.each(this.layers, function(i, layer) {
			layer.setFramerate(ms);
		});

		// start the timer for updating the effect (:TODO: disable when inactive, reuse synced timers)
		var that = this;
		this.timer = new jcparallax.Timer(function() {
			that.updateLayers.call(that);
		}, this.framerate);
	},

	/**
	 * Update the positions of all layers in response to an input event
	 * @param  {float} xVal input X value, in the range of 0 < x < 1. If ommitted the last sampled X value is used.
	 * @param  {float} yVal input Y value, in the range of 0 < y < 1. If ommitted the last sampled Y value is used.
	 */
	updateLayers : function(xVal, yVal)
	{
		// when positions not passed, just redraw
		if (xVal === undefined && yVal === undefined) {
			xVal = this.lastSampledX;
			yVal = this.lastSampledY;
		}

		// redraw the layer elements
		$.each(this.layers, function(i, layer) {
			layer.animHandler.call(layer, layer.element, xVal, yVal);
		});
	},

	/**
	 * Updates the sampled input position for calculating the effect.
	 * This method runs for every event encountered to set the X and Y
	 * values, which are then applied at the next frame interval.
	 */
	_updateLastSamplePos : function(xVal, yVal)
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
	}
});

//------------------------------------------------------------------------------
// Layer class
//------------------------------------------------------------------------------

/**
 * Create a new jcparallax layer within the given viewport with the target element.
 * @param {Viewport} viewport Viewport object responsible for animating this layer
 * @param {jQuery}   el       target layer element for animation
 * @param {object}   options  options for this layer. Same as the Viewport options.
 */
jcparallax.Layer = function(viewport, el, options)
{
	// setup instance options
	this.viewport = viewport;
	this.element = el;
	this.options = options;

	jcparallax.Viewport._handleOptions(this.options);

	this.setFramerate(jcparallax.Viewport._checkFramerate(this.options, this.options.framerateCheckCb));

	// store animation event handler to be called by our Viewport
	if ($.isFunction(this.options.animHandler)) {
		this.animHandler = this.options.animHandler;
	} else {
		this.animHandler = jcparallax.Layer[this.options.animHandler];
	}

	// compute movement range
	this._updateMovementRange(this.options.movementRangeX, this.options.movementRangeY);
};

// SINGLE-INSTANCE METHODS

$.extend(jcparallax.Layer, {

	// animation handler callbacks

	ANIM_POSITION : function(el, xVal, yVal)
	{
		el.css({
			left : this.minMaxX[0] + (xVal * (this.minMaxX[1] - this.minMaxX[0])),
			top : this.minMaxY[0] + (yVal * (this.minMaxY[1] - this.minMaxY[0])),
		});
	},

	ANIM_PADDING : function(el, xVal, yVal)
	{

	},

	ANIM_MARGINS : function(el, xVal, yVal)
	{

	},

	ANIM_BACKGROUND : function(el, xVal, yVal)
	{

	},

	ANIM_STRETCH : function(el, xVal, yVal)
	{

	},

	ANIM_TEXTSHADOW : function(el, xVal, yVal)
	{

	},

	ANIM_OPACITY : function(el, xVal, yVal)
	{

	},

	// movement range calculation callbacks

	RANGECB_WIDTH : function(el, vp)
	{
		var wDelta = vp.sizeX - el.width();
		return [0, wDelta];
	},

	RANGECB_HEIGHT : function(el, vp)
	{
		var hDelta = vp.sizeY - el.height();
		return [hDelta, 0];
	},

	RANGECB_SCROLLWIDTH : function(el, vp)
	{
		return [0, el.attr('scrollWidth')];
	},

	RANGECB_SCROLLHEIGHT : function(el, vp)
	{
		return [0, el.attr('scrollHeight')];
	},

	RANGECB_FONTSIZE : function(el, vp)
	{
		return [0, el.css('font-size')];
	},

	RANGECB_LINEHEIGHT : function(el, vp)
	{
		return [0, el.css('line-height')];
	},

	RANGECB_CURROPACITY : function(el, vp)
	{
		return [0, el.css('opacity') || 1];
	}
});

// PER-INSTANCE METHODS & PROPERTIES

$.extend(jcparallax.Layer.prototype, {
	// cached layer coordinates for speeding up animation
	minMaxX : null,
	minMaxY : null,

	setFramerate : function(ms)
	{
		this.framerate = ms;
		this._addCss(ms);
	},

	/**
	 * Refreshes the cached coordinates of the layer after some external DOM manipulation
	 */
	refreshCoords : function()
	{
		if (!$.isArray(this.options.movementRangeX) || !$.isArray(this.options.movementRangeY)) {
			this._updateMovementRange(this.options.movementRangeX, this.options.movementRangeY);
		}
	},

	_updateMovementRange : function(xRange, yRange)
	{
		this.minMaxX = $.isArray(xRange) ? xRange : this._calculateMovementRange(xRange);
		this.minMaxY = $.isArray(yRange) ? yRange : this._calculateMovementRange(yRange);
	},

	_calculateMovementRange : function(rangeCallback)
	{
		if (!$.isFunction(rangeCallback)) {
			rangeCallback = jcparallax.Layer[rangeCallback];
		}

		return rangeCallback.call(this, this.element, this.viewport);
	},

	_addCss : function(framerate)
	{
		var that = this;
		framerate = (framerate / 1000) + 's';

		$.each(jcparallax.cssDomPrefixes, function(i, prefix) {
			that.element.css(prefix + 'transition-duration', framerate);
		});
		that.element.css('transition-duration', framerate);
	}
});

//------------------------------------------------------------------------------
// Animation timer class
//------------------------------------------------------------------------------

jcparallax.Timer = function(cb, framerate, doNotStart)
{
	this.framerate = framerate;
	this.callback = cb;
	this.frameCount = -1;

	if (!doNotStart) this.start();
};

// PER-INSTANCE METHODS & PROPERTIES

$.extend(jcparallax.Timer.prototype, {
	interval : null,

	start : function()
	{
		var that = this,
			update = function() {
				++that.frameCount;
				that.callback.call(that);
			};

		update();	// run to first frame

		this.interval = setInterval(update, this.framerate);
	},

	stop : function()
	{
		clearInterval( this.interval );
		this.interval = null;
	}
});

//------------------------------------------------------------------------------
// jQuery integration layer
//------------------------------------------------------------------------------

$.fn.jcparallax = function(func) {
	var args = arguments;

	// constructor to create an object and bind it to our elements
	var init = function(options, layerOptions) {
		this.data(jcparallax.viewportStorageKey, new jcparallax.Viewport(this, options, layerOptions));
	};

	var fnCall = false;	// function calls can either chain when no results are returned or return arrays of results
	var results = [];

	this.each(function() {
		var t = $(this);
		var myObject = t.data(jcparallax.viewportStorageKey);

		// Run the appropriate behaviour
		if (func != undefined && myObject != undefined) {
			if (typeof myObject[func] == 'function') {
				// object function call
				fnCall = true;
				results.push(myObject[func].apply( myObject, Array.prototype.slice.call( args, 1 )));
				return true;
			} else {
				// intance variable request
				results.push(myObject[func]);
				return true;
			}
		} else if (typeof func === 'object' || !func ) {
			// create a new object, optionally passing options map
			init.apply( t, args );
			return true;	// continue creating for each matched element
		} else {
			$.error( 'Method ' +  func + ' does not exist in jcparallax' );
		}
	});

	// if the results from all function calls are undefined, there are no results!
	if (fnCall) {
		var allUndef = true;
		for (var i = 0; i < results.length; i++) {
			if (typeof results[i] != 'undefined') {
				allUndef = false;
				break;
			}
		}
		if (allUndef) {
			results = [];
		}
	}

	return results.length ? (results.length == 1 ? results[0] : results) : this;
};

})(jQuery);
