/**
 * Parallax layer class
 *
 * Create a new jcparallax layer within the given viewport with the target element.
 *
 * @requires jcparallax.js
 * @requires jcp-viewport.js
 *
 * @param {Viewport} viewport jcparallax.Viewport object responsible for animating this layer
 * @param {jQuery}   el       target layer element for animation
 * @param {object}   options  options for this layer. Same as the Viewport options - @see jcp-viewport.js
 */
(function($) {

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
		this.animHandler = jcparallax.Layer.animHandlers[this.options.animHandler];
	}

	// compute movement range
	this._updateMovementRange(this.options.movementRangeX, this.options.movementRangeY);
};

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
			rangeCallback = jcparallax.Layer.rangeCalculators[rangeCallback];
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
// Layer animation handlers
//------------------------------------------------------------------------------

jcparallax.Layer.animHandlers = {

	position : function(el, xVal, yVal)
	{
		el.css({
			left : this.minMaxX[0] + (xVal * (this.minMaxX[1] - this.minMaxX[0])),
			top : this.minMaxY[0] + (yVal * (this.minMaxY[1] - this.minMaxY[0])),
		});
	},

	padding : function(el, xVal, yVal)
	{

	},

	margins : function(el, xVal, yVal)
	{

	},

	background : function(el, xVal, yVal)
	{

	},

	stretch : function(el, xVal, yVal)
	{

	},

	textShadow : function(el, xVal, yVal)
	{

	},

	opacity : function(el, xVal, yVal)
	{

	}
};

//------------------------------------------------------------------------------
// Automatic layer movement range calculation callbacks
//------------------------------------------------------------------------------

jcparallax.Layer.rangeCalculators = {

	width : function(el, vp)
	{
		var wDelta = vp.sizeX - el.width();
		return [0, wDelta];
	},

	height : function(el, vp)
	{
		var hDelta = vp.sizeY - el.height();
		return [hDelta, 0];
	},

	scrollWidth : function(el, vp)
	{
		return [0, el.attr('scrollWidth')];
	},

	scrollHeight : function(el, vp)
	{
		return [0, el.attr('scrollHeight')];
	},

	fontSize : function(el, vp)
	{
		return [0, el.css('font-size')];
	},

	lineHeight : function(el, vp)
	{
		return [0, el.css('line-height')];
	},

	opacity : function(el, vp)
	{
		return [0, el.css('opacity') || 1];
	}
};

})(jQuery);
