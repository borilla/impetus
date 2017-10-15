const doc = document;
const stopThresholdDefault = 0.3;

// options to send to `addEventListener` to make event passive (ie can't use `preventDefault`)
const eventOptionsPassive = isPassiveSupported() ? {passive: true} : false;

export default class Impetus {
    constructor({
        source: sourceEl = document,
        update: updateCallback,
        multiplier = 1,
        friction = 0.92,
        positionX = 0
    }) {
        var pointerLastX, pointerCurrentX, pointerId, velocityX;
        var stopThreshold = stopThresholdDefault * multiplier;
        var ticking = false;
        var pointerActive = false;
        var paused = false;
        var decelerating = false;
        var trackingPoints = [];

        /**
         * Initialize instance
         */
        (function init() {
            sourceEl = (typeof sourceEl === 'string') ? doc.querySelector(sourceEl) : sourceEl;

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
        this.destroy = function() {
            sourceEl.removeEventListener('touchstart', onDown);
            sourceEl.removeEventListener('mousedown', onDown);
            // however it won't "destroy" a reference
            // to instance if you'd like to do that
            // it returns null as a convenience.
            // ex: `instance = instance.destroy();`
            return null;
        };

        /**
         * Disable movement processing
         * @public
         */
        this.pause = function() {
            pointerActive = false;
            paused = true;
        };

        /**
         * Enable movement processing
         * @public
         */
        this.resume = function() {
            paused = false;
        };

        /**
         * Update the current x value
         * @public
         * @param {Number} x
         */
        this.setX = function(x) {
            positionX = x;
        };

        /**
         * Update the multiplier value
         * @public
         * @param {Number} val
         */
        this.setMultiplier = function(val) {
            multiplier = val;
            stopThreshold = stopThresholdDefault * multiplier;
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
            } else { // mouse events
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
            if (!pointerActive && !paused) {
                pointerActive = true;
                decelerating = false;
                pointerId = event.id;

                pointerLastX = pointerCurrentX = event.x;
                trackingPoints = [];
                addTrackingPoint(pointerLastX);

                const addDocumentEvent = doc.addEventListener;
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

            const removeDocumentEvent = doc.removeEventListener;
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

            trackingPoints.push({x, time});
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

            var D = (timeOffset / 15) / multiplier;

            velocityX = (xOffset / D) || 0; // prevent NaN

            if (Math.abs(velocityX) > 1) {
                decelerating = true;
                requestAnimationFrame(stepDecelAnim);
            }
        }

        /**
         * Animates values slowing down
         */
        function stepDecelAnim() {
            if (!decelerating) {
                return;
            }

            velocityX *= friction;
            positionX += velocityX;

            if (Math.abs(velocityX) > stopThreshold) {
                callUpdateCallback();
                requestAnimationFrame(stepDecelAnim);
            } else {
                decelerating = false;
            }
        }
    }
}

function isPassiveSupported() {
    let _isPassiveSupported = false;

    try {
        const name = 'test';
        const noop = () => {};
        const options = Object.defineProperty({}, 'passive', {
            get: () => { _isPassiveSupported = true; }
        });

        addEventListener(name, noop, options);
        removeEventListener(name, noop, options);
    } catch (err) {}

    return _isPassiveSupported;
}
