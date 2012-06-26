/**
 * Animation timer class
 *
 * Runs and manages an interval for processing CSS-augmented animation.
 *
 * This timer works in one of a few ways, depending on browser features available.
 * 	- In fully-enabled mode, we use transitionEnd DOM events to trigger the start of the next
 * 	  animation frame. This ensures consistent timing and reduces transition jitter sometimes apparent
 * 	  in the half-enabled mode.
 * 	- In half-enabled mode, transitions are still used to smooth between frames but no events are
 *    available to signify the end of transitions. In this case we just use an interval to try to
 *    sync the javascript CSS updates with the end of the CSS transitions - but this *can* get out
 *    of sync slightly which leads to tearing in the animation. Fortunately this mode is unlikely
 *    to be executed.
 *  - In fallback mode, we simply sample at a higher framerate to compensate for the lack of browser
 *    transition support.
 *
 * TransitionIntervals require three parameters:
 * 	- a callback to execute for every tick of the timer. The context of the callback is the timer object,
 * 	  which contains a frameCount variable which may be of use in callbacks.
 * 	- a sampling rate for the animation when running in CSS-enabled browsers
 * 	- a fallback sampling rate when transition smoothing is not available
 *
 * After construction, call addElements() to append DOM elements under the control of the TransitionInterval's
 * animation timer. These need to be registered in order to apply the correct CSS attributes necessary for
 * transition timing on the elements.
 *
 * @requires jcparallax.js
 */
(function($) {

jcparallax.TransitionInterval = function(cb, framerate, fbFramerate, extraCssAnimCheckCb)
{
	this.elements = jQuery([]);
	this.setFramerates(framerate, fbFramerate, extraCssAnimCheckCb);

	this.callback = cb;
	this.frameCount = 0;
};

$.extend(jcparallax.TransitionInterval.prototype, {

	_running : false,

	timeout : null,		// frame timeout reference (fallback mode)
	update : null,		// underlying registered timer update callback

	start : function()
	{
		// ignore if already running
		if (this._running) {
			return;
		}

		var that = this;

		if (jcparallax.support.transitionEndEvent) {
			this.update = function() {
				// if callback returns to flag no movement, check again at our frame interval
				if (!that.callback.call(that)) {
					clearTimeout( that.timeout );
					that.timeout = setTimeout(function() {
						that.timeout = null;
						that.update();
					}, that.framerate);
				} else {

					// this check is placed here to failsafe in the event that browser rendering stutters,
					// resulting in the transition end event never being called and the animation failing
					// to restart.
					clearTimeout( that.timeout );
					that.timeout = setTimeout(function() {
						that.timeout = null;
						that.update();
					}, that.framerate * 2);

					++that.frameCount;
				}
			};

			// bind to the first element, we only need it to run once since all framerates are the same
			this.elements.on(jcparallax.support.transitionEndEvent, that.update);
		} else {
			var supported = jcparallax.support.transitions && (!this.useFallbackCheckCb || (this.useFallbackCheckCb && this.useFallbackCheckCb()));

			this.update = function() {
				that.callback.call(that);
				that.timeout = setTimeout(that.update, supported ? that.framerate : that.fbFramerate);

				++that.frameCount;
			};
			this.timeout = setTimeout(this.update, supported ? this.framerate : this.fbFramerate);
		}
		this._running = true;

		this.update();	// run to first frame
	},

	stop : function()
	{
		if (this._running) {
			if (jcparallax.support.transitionEndEvent) {
				this.elements.off(jcparallax.support.transitionEndEvent, this.update);
			} else {
				clearTimeout( this.timeout );
				this.timeout = null;
			}
			this._running = false;
		}
	},

	setFramerates : function(cssFramerate, fallbackFramerate, extraCssAnimCheckCb)
	{
		this.framerate = cssFramerate;
		this.fbFramerate = fallbackFramerate;
		this.useFallbackCheckCb = extraCssAnimCheckCb;
		this._applyCss();
	},

	addElements : function(els)
	{
		if ($.isArray(els)) {
			this.elements.pushStack(els);
		} else {
			this.elements = this.elements.add(els);
		}
		this._applyCss();
	},

	_applyCss : function()
	{
		var that = this,
			cssFramerate = (this.framerate / 1000) + 's';

		// set transition-duration for CSS sample tweening
		$.each(jcparallax.cssDomPrefixes, function(i, prefix) {
			that.elements.css(prefix + 'transition-duration', cssFramerate);
		});
		this.elements.css('transition-duration', cssFramerate);
	}
});

})(jQuery);
