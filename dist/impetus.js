(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global.Impetus = factory());
}(this, (function () { 'use strict';

function isPassiveSupported() {
	var _isPassiveSupported = false;

	try {
		var name = 'test';
		var noop = function noop() {};
		var options = Object.defineProperty({}, 'passive', {
			get: function get() {
				_isPassiveSupported = true;
			}
		});

		addEventListener(name, noop, options);
		removeEventListener(name, noop);
	} catch (err) {}

	return _isPassiveSupported;
}

var classCallCheck = function (instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
};

var doc = document;

// options to send to `addEventListener` to make event passive (ie can't use `preventDefault`)
var eventOptionsPassive = isPassiveSupported() ? { passive: true } : false;

var Impetus = function Impetus(_ref) {
	var _ref$source = _ref.source,
	    sourceEl = _ref$source === undefined ? document : _ref$source,
	    updateCallback = _ref.update,
	    _ref$multiplier = _ref.multiplier,
	    multiplier = _ref$multiplier === undefined ? 1 : _ref$multiplier,
	    _ref$positionX = _ref.positionX,
	    positionX = _ref$positionX === undefined ? 0 : _ref$positionX,
	    width = _ref.width;
	classCallCheck(this, Impetus);

	var pointerLastX, pointerCurrentX, pointerId, velocityX;
	var ticking = false;
	var pointerActive = false;
	var trackingPoints = [];

	/**
  * Initialize instance
  */
	(function init() {
		sourceEl = typeof sourceEl === 'string' ? doc.querySelector(sourceEl) : sourceEl;

		if (positionX !== 0) {
			callUpdateCallback();
		}

		sourceEl.addEventListener('touchstart', onDown, eventOptionsPassive);
		sourceEl.addEventListener('mousedown', onDown);
	})();

	/**
  * In edge cases where you may need to
  * reinstantiate Impetus on the same sourceEl
  * this will remove the previous event listeners
  */
	this.destroy = function () {
		sourceEl.removeEventListener('touchstart', onDown);
		sourceEl.removeEventListener('mousedown', onDown);
		// however it won't "destroy" a reference
		// to instance if you'd like to do that
		// it returns null as a convenience.
		// ex: `instance = instance.destroy();`
		return null;
	};

	/**
  * Update the current x value
  * @public
  * @param {Number} x
  */
	this.setX = function (x) {
		positionX = x;
	};

	/**
  * Update the multiplier value
  * @public
  * @param {Number} val
  */
	this.setMultiplier = function (val) {
		multiplier = val;
	};

	/**
  * Executes the update function
  */
	function callUpdateCallback() {
		updateCallback.call(sourceEl, positionX);
	}

	/**
  * Creates a custom normalized event object from touch and mouse events
  * @param  {Event} ev
  * @returns {Object} with x, y, and id properties
  */
	function normalizeEvent(ev) {
		if (ev.type === 'touchmove' || ev.type === 'touchstart' || ev.type === 'touchend') {
			var touch = ev.targetTouches[0] || ev.changedTouches[0];
			return {
				x: touch.clientX,
				y: touch.clientY,
				id: touch.identifier
			};
		} else {
			// mouse events
			return {
				x: ev.clientX,
				y: ev.clientY,
				id: null
			};
		}
	}

	/**
  * Initializes movement tracking
  * @param  {Object} ev event (not yet normalized)
  */
	function onDown(ev) {
		var event = normalizeEvent(ev);
		if (!pointerActive) {
			pointerActive = true;
			pointerId = event.id;

			pointerLastX = pointerCurrentX = event.x;
			trackingPoints = [];
			addTrackingPoint(pointerLastX);

			var addDocumentEvent = doc.addEventListener;
			addDocumentEvent('touchmove', onMove, eventOptionsPassive);
			addDocumentEvent('touchend', onUp);
			addDocumentEvent('touchcancel', stopTracking);
			addDocumentEvent('mousemove', onMove, eventOptionsPassive);
			addDocumentEvent('mouseup', onUp);
		}
	}

	/**
  * Handles move events
  * @param  {Object} ev Normalized event
  */
	function onMove(ev) {
		var event = normalizeEvent(ev);

		if (pointerActive && event.id === pointerId) {
			pointerCurrentX = event.x;
			addTrackingPoint(pointerLastX);
			requestTick();
		}
	}

	/**
  * Handles up/end events
  * @param {Object} ev Normalized event
  */
	function onUp(ev) {
		var event = normalizeEvent(ev);

		if (pointerActive && event.id === pointerId) {
			stopTracking();
		}
	}

	/**
  * Stops movement tracking, starts animation
  */
	function stopTracking() {
		pointerActive = false;
		addTrackingPoint(pointerLastX);
		startDecelAnim();

		var removeDocumentEvent = doc.removeEventListener;
		removeDocumentEvent('touchmove', onMove);
		removeDocumentEvent('touchend', onUp);
		removeDocumentEvent('touchcancel', stopTracking);
		removeDocumentEvent('mouseup', onUp);
		removeDocumentEvent('mousemove', onMove);
	}

	/**
  * Records movement for the last 100ms
  * @param {number} x
  */
	function addTrackingPoint(x) {
		var time = Date.now();
		while (trackingPoints.length > 0) {
			if (time - trackingPoints[0].time <= 100) {
				break;
			}
			trackingPoints.shift();
		}

		trackingPoints.push({ x: x, time: time });
	}

	/**
  * Calculate new values, call update function
  */
	function updateAndRender() {
		var pointerChangeX = pointerCurrentX - pointerLastX;

		positionX += pointerChangeX * multiplier;

		callUpdateCallback();

		pointerLastX = pointerCurrentX;
		ticking = false;
	}

	/**
  * prevents animating faster than current framerate
  */
	function requestTick() {
		if (!ticking) {
			requestAnimationFrame(updateAndRender);
		}
		ticking = true;
	}

	/**
  * Initialize animation of values coming to a stop
  */
	function startDecelAnim() {
		var firstPoint = trackingPoints[0];
		var lastPoint = trackingPoints[trackingPoints.length - 1];

		var xOffset = lastPoint.x - firstPoint.x;
		var timeOffset = lastPoint.time - firstPoint.time;

		var D = timeOffset / 15 / multiplier;

		velocityX = xOffset / D || 0; // prevent NaN

		requestAnimationFrame(stepDecelAnim);
	}

	/**
  * Consider effect of two closest attractors to given position
  */
	function considerAttractors(position, velocity) {
		var ACCELERATION = 3;
		var SLOWING_FACTOR = 0.92;
		var SPEED_THRESHOLD = 0.04 * width;
		var DISTANCE_THRESHOLD = SPEED_THRESHOLD;

		// approximate mid-position for animation step
		var midPosition = position + velocity / 2;

		// positions of previous and next attractors
		var attractor0 = Math.floor(midPosition / width) * width;
		var attractor1 = attractor0 + width;

		// distances to previous and next attractors
		var distance0 = midPosition - attractor0;
		var distance1 = width - distance0;

		// calculate new velocity and position
		velocityX += (distance0 - distance1) / width * ACCELERATION;
		velocityX *= SLOWING_FACTOR;
		positionX += velocityX;

		// are we close enough to an attractor and going slowly enough?
		if (velocity > -SPEED_THRESHOLD && positionX < attractor0 + DISTANCE_THRESHOLD) {
			velocityX = 0;
			positionX = attractor0;
			callUpdateCallback();
			return;
		}
		// else
		if (velocity < SPEED_THRESHOLD && positionX > attractor1 - DISTANCE_THRESHOLD) {
			velocityX = 0;
			positionX = attractor1;
			callUpdateCallback();
			return;
		}

		callUpdateCallback();
		requestAnimationFrame(stepDecelAnim);
	}

	/**
  * Animates values slowing down
  */
	function stepDecelAnim() {
		considerAttractors(positionX, velocityX);
	}
};

return Impetus;

})));
//# sourceMappingURL=impetus.js.map
