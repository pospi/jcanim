/**
 * Parallax layer class
 *
 * Create a new jcparallax layer within the given viewport with the target element.
 *
 * @param {Viewport} viewport jcparallax.Viewport object responsible for animating this layer
 * @param {jQuery}   el       target layer element for animation
 * @param {object}   options  options for this layer. Same as the Viewport options - @see jcp-viewport.js
 *
 * @requires jcparallax.js
 * @requires jcp-animator.js
 * @requires jcp-viewport.js
 * @author Sam Pospischil <pospi@spadgos.com>
 */
(function($) {

jcparallax.Layer = function(viewport, el, options)
{
	var that = this;

	// setup instance options
	this.viewport = viewport;
	this.element = el;
	this.options = options;

	// check for arrays of animation controllers for this layer
	if ($.isArray(options.animHandler)
	 || $.isArray(options.inputHandler)
	 ||	$.isArray(options.movementRangeX)
	 || $.isArray(options.movementRangeY)
	 || $.isArray(options.inputEvent)) {
		this._createAnimators(options.animHandler, options.inputHandler, options.movementRangeX, options.movementRangeY, options.inputEvent);
	} else {
		// create a single animator
		this.animators = [ new jcparallax.Animator(this, options) ];
	}
};

$.extend(jcparallax.Layer.prototype, {

	// previous CSS attributes of the layer
	prevFrameCss : {},

	/**
	 * Refreshes the cached coordinates of the layer after some external DOM manipulation
	 * to synchronise new animation positioning
	 */
	refreshCoords : function()
	{
		$.each(this.animators, function(i, anim) {
			anim.refreshCoords();
		});
	},

	/**
	 * Redraw the layer, using current input values for all our animators to generate
	 * a merged CSS object to apply on our element.
	 * @return true if the layer needed re-rendering
	 */
	redraw : function()
	{
		var newCss = {},
			i = 0,
			l = this.animators.length;

		for (; i < l; ++i) {
			$.extend(newCss, this.animators[i].makeCss());
		}

		if (this._cssChanged(newCss)) {
			this.prevFrameCss = newCss;
			this.element.css(newCss);
			return true;
		}

		return false;
	},

	_createAnimators : function(animHandlers, inputHandlers, movementRangeXs, movementRangeYs, inputEvents)
	{
		this.animators = [];

		// coerce everything to equal length arrays
		var maxLen = Math.max($.isArray(animHandlers) ? animHandlers.length : 0, $.isArray(inputHandlers) ? inputHandlers.length : 0,
							$.isArray(movementRangeXs) ? movementRangeXs.length : 0, $.isArray(movementRangeYs) ? movementRangeYs.length : 0,
							$.isArray(inputEvents) ? inputEvents.length : 0),
			i, anim;

		for (i = 0; i < maxLen; ++i) {
			anim = new jcparallax.Animator(this, {
				animHandler : $.isArray(animHandlers) ? animHandlers[i] : animHandlers,
				inputEvent : $.isArray(inputEvents) ? inputEvents[i] : inputEvents,
				inputHandler : $.isArray(inputHandlers) ? inputHandlers[i] : inputHandlers,
				movementRangeX : $.isArray(movementRangeXs) ? movementRangeXs[i] : movementRangeXs,
				movementRangeY : $.isArray(movementRangeYs) ? movementRangeYs[i] : movementRangeYs
			});
			this.animators.push(anim);
		}
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
// Automatic layer movement range calculation callbacks
//------------------------------------------------------------------------------

jcparallax.Layer.rangeCalculators = {

	width : function(el, vp)
	{
		return [0, vp.sizeX - el.width()];
	},

	height : function(el, vp)
	{
		return [vp.sizeY - el.height(), 0];
	},

	scrollWidth : function(el, vp)
	{
		return [-(el.get(0).scrollWidth - vp.sizeX), 0];
	},

	scrollHeight : function(el, vp)
	{
		return [0, el.get(0).scrollHeight - vp.sizeY];
	},

	fontSize : function(el, vp)
	{
		return [0, el.css('font-size')];
	},

	lineHeight : function(el, vp)
	{
		return [el.css('line-height'), 0];
	},

	opacity : function(el, vp)
	{
		return [0, el.css('opacity') || 1];
	},

	dataRangeX : function(el, vp) 	// reads data attribute 'jcp-xrange'
	{
		return el.data('jcp-xrange').split(',');
	},

	dataRangeY : function(el, vp)  	// reads data attribute 'jcp-yrange'
	{
		return el.data('jcp-yrange').split(',');
	}
};

})(jQuery);
