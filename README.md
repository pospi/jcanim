## JCAnim ##

> A **J**Query & **C**SS3 **Anim**ation engine

### About ###

Originally created to drive a parallax effect, the real gem in JCAnim turned out to be the extensible animation engine underpinning it - creating unbelievably fluid animations by using CSS3 transitions to smooth out JavaScript interpolation of animation in the browser. The library basically creates smoother browser animations by allowing you to decrease the JavaScript sampling rate, offloading animation processing to the GPU and freeing up CPU resources to decrease animation stutter. Inbetween animations generally run at whatever native framerate your monitor supports and appear extremely smooth, obviously however this depends on browser support.

This kind of implementation is particularly suited to regularly sampled animation or keyframed animation. The parallax animation implemented by `jcparallax.Viewport` and `jcparallax.Layer` updates the mouse position constantly in response to input events, and then runs animations on those coordinates at regular intervals to achieve the effect.

#### Animation Engine ####

I have done my best to make JCAnim's animation system as flexible as possible, and it allows for nearly limitless combinations of effects. Combining scrolling parallax with mouse movement parallax, stretching and moving elements together or rotating to follow a point - all are possible. JCAnim basically provides its interface through `Viewports` (elements which receive input to control an animation) and `Layers` (elements being moved to achieve the effect).

- Each viewport has multiple layers under its control
- Layers can be connected to multiple viewports
- A layer may have any mumber of attributes animating
- A layer may have any number of animation inputs (such as events or timers) and output attributes running simultaneously
- Multiple inputs can be combined to effect the same attribute
- Animations may be run simultaneously at different timings
- Layers may also be viewports, and so on...

##### Input handlers #####

These callbacks read some input event and update a clamped input value for each axis in the range `0 <= x <= 1`. This is achieved in each callback by passing `this.updateLastSamplePos()` the X and Y values from that event. They receive the `Viewport` element and jQuery event as parameters. Builtin input handlers are defined at the base of `jcp-viewport.js`:

- *mousemove*:				takes a mousemove event and calculates input based on the mouse position in relation to the viewport element's bounding box
- *scroll*:					takes a scroll event and calculates input based on the scroll positions of the viewport
- *click*:					intercepts the positions of click events on the viewport element and smoothly transitions between them
- *mousemove_xcentered*:	the same as mousemove, except that it returns 1 when the mouse is in the center of the X axis and 0 at each edge

##### Animation handlers #####

Animation handlers take the output from an input handler for each axis and convert to final CSS values to be set on the layer for that frame. They receive the output X and Y values from the input handlers they are tied to. It is important to return raw values from these methods instead of CSS units - this is required for the internals of the animation engine to average multiple inputs onto the same output value. All values are in pixels (or degrees) when output. Builtin animation handlers are defined at the base of `jcp-animator.js`:

- *position*:		moves the layer directly to animate its position
- *padding*:		achieves the same effect as *position* using padding on the target element
- *margins*:		achieves the same effect as *position* using margin offsets
- *background*:		achieves the same effect as *position* using the background position of the target element
- *stretch*:		stretches the layer by animating its width and height
- *Xrotate*:		rotates the layer in response to input on the X axis
- *Yrotate*:		rotates the layer in response to input on the Y axis
- *textShadow*:		moves the text shadow of the layer in response to the parallax effect
- *opacity*:		fades layers in and out. Best used when combined with other effects.

I've chosen to implement a base set of animations for all useful CSS attributes for which transitions are widely supported. You can easily add your own to this set and even implement animation of attributes on which transitions are not supported at all - these additions will coexist with supported features nicely if configured to run at a higher framerate.

##### Range calculators #####

These are callbacks used to automatically determine the movement range of `Layer` elements, and are only required when not hardcoding animation ranges into your init options. They are called when `refreshCoords()` is called on a `Viewport` or `Layer` element and update the cached coordinates for layers used in animation handling.

They receive the layer element as parameter 0 and `Viewport` element as parameter 1, and should return a two-element array indicating the range of motion this element will take. Builtin range calculators are defined at the base of `jcp-layer.js`:

- *width*:			provides a range upward from 0 based on the difference between viewport and layer width
- *height*: 		provides a range downward to 0 based on the difference between viewport and layer height
- *scrollWidth*:	provides a range upward to 0 based on layer scroll width & viewport width
- *scrollHeight*:	provides a range upward from 0 based on layer scroll height & viewport height
- *fontSize*:		mainly useful with *textShadow* animation handler, provides a range from 0 to the font size of the layer element intended to be used for horizontal motion
- *lineHeight*:		mainly useful with *textShadow* animation handler, provides a range from the line height of the layer element to 0 intended to be used for vertical motion
- *opacity*:		provides an animation range from 0 to the current opacity of the element
- *dataRangeX*:		reads the `jcp-xrange` data attribute of each layer and splits on the token ',' to provide a hardcoded X range of motion
- *dataRangeY*:		reads the `jcp-yrange` data attribute of each layer and splits on the token ',' to provide a hardcoded Y range of motion

### API ###

:TODO: documentation coming!

### Support ###

Browsers require support for the `transition` CSS property and `transitionend` DOM event for this library to function fully. Chrome is ludicrously smooth, whilst Firefox, Safari & (especially) Opera may experience very occaisonal jitter on slower machines - but nothing outside of what would be expected with standard JavaScript animation techniques. Without these events it simply runs normal timeout-based animation at `fbFramerate` instead of `framerate` - this interval should be sufficiently quick as to make delay indistinguishable as there will be no GPU smoothing inbetween frames.

#### Finer details ####

- CSS transitions are supported in browsers as of Firefox 4, Chrome 1, Opera 10.5, Safari 3.2 and IE 10.
- Transition end events are supported in all browsers that support transitions, so though there is a facility for the library to work without events it will likely never be used.
- Rotation, skewing and other transform animations require browser support for 2D transforms and the `transform-origin` CSS attribute.
- Opera uses fallback mode when animating `background-position` or `text-shadow`, as it does not correctly support transitions of these attributes.

### TODO ###

- implement correct math for combining inputs to the same output
- pure JavaScripting timing for fallback animation handler
- detect mouse exiting viewport & update last position
- allow toggling the behaviour
- dont add transition duration properties if set to the defaults present in the stylesheet
- implement a timer to handle the click input handler

### License ###

This software is provided under an MIT open source license, read the 'LICENSE.txt' file for details.

Copyright &copy; 2012 Sam Pospischil (pospi at spadgos dot com)
