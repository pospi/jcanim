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
 * 		$('#parallax-viewport').jcparallax('updateLayers', 0.5, 0.5);	// set all layers to their center positions
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
 *
 *  To refresh viewports or layers in response to DOM updates, use the refreshCoords() method.
 *  By default, coordinates are refreshed when the screen is resized.
 *
 * 	When present, layer ranges should be given as two-element arrays specifying the minimum and maximum
 * 	values for the range of the layer's movement. How each animation handler interprets these is up to it,
 * 	but is usually fairly straightforward.
 *
 * 	The builtin range callbacks are:
 * 		width & height:
 *   		Returns the width and height of the element, as maximum X and Y offsets.
 *
 * 		scrollWidth & scrollHeight:
 *   		Returns the maximum scroll range of the element as maximum X and Y offsets.
 *
 * 		fontSize & lineHeight:
 *   		Returns the current font size and line height of the element, as maximum X and Y offsets for the text shadow.
 *
 * 		opacity:
 * 			Returns the current opacity of the element as the maximum Y offset.
 *
 * Input handlers
 * --------------
 * 	Control the input for the parallax effect. These are simply functions which return
 * 	two values in the range 0 - 1, indicating the relative position of each input axis.
 * 	The X axis input is always returned first.
 *
 * 	The builtin handlers are:
 * 		mousemove:
 * 			Receives and handles mouse coordinates (either document relative,
 * 			or relative to some viewport element).
 *
 * 		scroll:
 * 			Reads the scrollTop and scrollLeft properties of an element.
 *
 *		click:
 *			(:TODO:) transitions smoothly between layer positions based on the
 *			coordinates of click events on the viewport element.
 *
 * Animation handlers
 * ------------------
 * 	Control the output behaviour of the transformations applied to layer elements. These
 * 	take the form of callbacks which manipulate the element's coordinates in response
 * 	to the outputs from an input handler.
 *
 * 	These are the builtin handlers:
 * 		position:
 * 			Animates the left & top properties of the target elements.
 *    		This handler achieves the effect by ofsetting the targeted elements directly.
 *
 * 		padding & margins:
 *   		Animates the padding-top and padding-left or margin-top and margin-left attributes of the target elements
 *   		to achieve the same effect as position.
 *   		This handler achieves the effect by moving the target element's contents inward by affecting their container.
 *
 * 		background: (css mode not supported in opera)
 *    		Animates the background-position attribute of target elements to achieve the same effect as position.
 *    		This handler causes the target element's background image to shift to achieve the parallax effect.
 *
 * 		stretch:
 * 			Animate the width and / or height attribute of the target elements. This handler can be used to stretch any
 * 			element aligned horizontally or vertically with the perspective plane of your designs, to achieve a faux-3d effect.
 *
 *    	textShadow: (css mode not supported in opera, blur not working in safari but not being animated)
 *    		Animates the text-shadow's position attribute of the target elements.
 *    		This handler causes the text shadow of an element to move in parallax.
 *
 * 		opacity:
 * 			Possibly quirky, this handler is supplied anyway for animating the opacity of elements
 * 			in response to a parallax effect. This could be useful for fading out layers as they cross
 * 			or other such effects. Only responds to one axis of motion.
 *
 * TODO
 * ----
 * - detect mouse exiting viewport & update last position
 * - allow toggling the behaviour
 * - dont add transition duration properties if we dont need it
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
// Globals & feature detection
//------------------------------------------------------------------------------

$.extend(jcparallax, {

	viewportStorageKey : 'jcparallax-viewport',
	layerStorageKey :	 'jcparallax-layer',

	eventNamespace : 	 '.jcparallax',

	jsDomPrefixes :		 'Moz O Webkit ms'.split(' '),
	cssDomPrefixes :	 '-moz- -o- -webkit- -ms-'.split(' '),

	// detect transition support flags: general support, background support & text-shadow position support
	detectSupport : function()
	{
		var ok = false,		// transitions supported at all
			bgOk = true,	// background-position transition supported (not in opera as of 22/6/12 @see http://www.quirksmode.org/css/transitions.html)
			tsOk = true,	// text-shadow transition supported (not in opera)

			eventNames = {	// mapping of js DOM prefixes to the transition event needed by TransitionInterval to signify the end of a transition
				MozTransition:    'transitionend',
				OTransition:      'oTransitionEnd',
				WebkitTransition: 'webkitTransitionEnd',
				msTransition:     'MSTransitionEnd'
			},

			returnSupport = function(ok, bgOk, tsOk) {
				return {
					transitions : !!ok,
					backgroundTransitions : bgOk || false,
					textShadowTransitions : tsOk || false,
					transitionEndEvent : ok ? eventNames[ok] + jcparallax.eventNamespace : null
				};
			};

		if ($.browser.msie) {
			return returnSupport(false, false, false);
		} else {
			// check browser transition support via style DOM object. Credits to Modernizr here for the method.
			var props = ('Transition ' + jcparallax.jsDomPrefixes.join('Transition ') + 'Transition').split(' '),
				testEl = document.createElement('jcparallax'),
    			styleObj = testEl.style;

			for (var i in props) {
				if (styleObj[ props[i] ] !== undefined) {
					ok = props[i];
					break;
				}
			}

			// flag background and text-shadow to use fallback mode in opera
			if ($.browser.opera) {
				bgOk = false;
				tsOk = false;
			}
		}

		return returnSupport(ok, bgOk, tsOk);
	}
});
jcparallax.support = jcparallax.detectSupport();

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
