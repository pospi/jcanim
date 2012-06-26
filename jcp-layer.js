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

	jcparallax.Viewport._calcMovementRanges(this.options);

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
	minX : null,
	minY : null,
	rangeX : null,
	rangeY : null,

	// previous CSS attributes of the layer
	prevFrameCss : {},

	/**
	 * Refreshes the cached coordinates of the layer after some external DOM manipulation
	 */
	refreshCoords : function()
	{
		if (!$.isArray(this.options.movementRangeX) || !$.isArray(this.options.movementRangeY)) {
			this._updateMovementRange(this.options.movementRangeX, this.options.movementRangeY);
		}
	},

	/**
	 * Redraw the layer, given new input values
	 * @return true if the layer needed re-rendering
	 */
	redraw : function(xVal, yVal)
	{
		var newCss = this.animHandler.call(this, xVal, yVal);

		if (this._cssChanged(newCss)) {
			this.prevFrameCss = newCss;
			this.element.css(newCss);
			return true;
		}

		return false;
	},

	_updateMovementRange : function(xRangeOrCb, yRangeOrCb)
	{
		var xRange, yRange;

		if ($.isArray(xRangeOrCb)) {
			xRange = xRangeOrCb;
		} else {
			xRange = this._calculateMovementRange(xRangeOrCb);
		}
		if ($.isArray(yRangeOrCb)) {
			yRange = yRangeOrCb;
		} else {
			yRange = this._calculateMovementRange(yRangeOrCb);
		}
		this.minX = xRange[0];
		this.rangeX = xRange[1] - xRange[0];
		this.minY = yRange[0];
		this.rangeY = yRange[1] - yRange[0];
	},

	_calculateMovementRange : function(rangeCallback)
	{
		if (!$.isFunction(rangeCallback)) {
			rangeCallback = jcparallax.Layer.rangeCalculators[rangeCallback];
		}

		return rangeCallback.call(this, this.element, this.viewport);
	},

	_cssChanged : function(newCss)
	{
		for (var i in newCss) {
			if (this.prevFrameCss[i] === undefined || this.prevFrameCss[i] != newCss[i]) {
				return true;
			}
		}
		return false;
	}
});

//------------------------------------------------------------------------------
// Layer animation handlers
//------------------------------------------------------------------------------

jcparallax.Layer.animHandlers = {

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

	},

	stretch : function(xVal, yVal)
	{

	},

	textShadow : function(xVal, yVal)
	{

	},

	opacity : function(xVal, yVal)
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
