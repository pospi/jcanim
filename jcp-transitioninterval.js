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
 *    of sync slightly which leads to
 *  - In fallback mode, we simply sample at a higher framerate to compensate for the lack of browser
 *    transition support.
 *
 * TransitionIntervals require three parameters:
 * 	- a callback to execute for every tick of the timer. The context of the callback is the timer object,
 * 	  which contains a frameCount variable which may be of use in callbacks.
 * 	- a sampling rate for the animation when running in CSS-enabled browsers
 * 	- a fallback sampling rate when transition smoothing is not available
 *
 * @requires jcparallax.js
 */
(function($) {

jcparallax.TransitionInterval = function(cb, framerate, doNotStart)
{
	this.framerate = framerate;
	this.callback = cb;
	this.frameCount = -1;

	if (!doNotStart) this.start();
};

$.extend(jcparallax.TransitionInterval.prototype, {

	interval : null,

	start : function()
	{
		// ignore if already running
		if (this.interval) {
			return;
		}

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

})(jQuery);
