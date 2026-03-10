/**
 * SURFPOP - Pose Painter
 * Centralized skeleton drawing with optional smoothing
 */

class PosePainter {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // Default options
        this.options = {
            // Colors
            lineColor: '#38bdf8',
            pointColorGood: '#22c55e',
            pointColorWeak: '#f59e0b',
            pointStrokeColor: '#fff',

            // Sizes
            lineWidth: 3,
            pointRadius: 6,
            pointStrokeWidth: 2,

            // Thresholds
            minScore: 0.3,
            goodScore: 0.6,

            // What to draw
            drawConnections: true,
            drawKeypoints: true,
            drawHeadConnection: true,   // head center to shoulder center
            useHeadCenter: true,        // use calculated head center (nose+ears) instead of just nose

            // Smoothing
            smoothing: true,
            smoothingConfig: {
                minCutoff: 1.0,
                beta: 0.5,
                dCutoff: 1.0
            },

            // Mirror (for selfie camera)
            mirror: true,

            ...options
        };

        // Smoother instance (lazy init)
        this.smoother = null;
    }

    /**
     * Update options
     */
    configure(options) {
        this.options = { ...this.options, ...options };

        // Reset smoother if smoothing config changed
        if (options.smoothingConfig) {
            this.smoother = null;
        }
    }

    /**
     * Initialize smoother if needed
     */
    _initSmoother() {
        if (!this.smoother && typeof OneEuroKeypointSmoother !== 'undefined') {
            this.smoother = new OneEuroKeypointSmoother(this.options.smoothingConfig);
        }
    }

    /**
     * Draw skeleton from keypoints
     * @param {Array} keypoints - Raw keypoints from pose detector
     * @returns {Array} - Processed keypoints (smoothed if enabled)
     */
    draw(keypoints) {
        if (!keypoints || keypoints.length === 0) {
            this.clear();
            return null;
        }

        // Apply smoothing if enabled
        let drawKeypoints = keypoints;
        if (this.options.smoothing) {
            this._initSmoother();
            if (this.smoother) {
                drawKeypoints = this.smoother.smooth(keypoints);
            }
        }

        // Clear canvas
        this.clear();

        // Create keypoint map for easy lookup
        const keypointMap = Keypoints.toMap(drawKeypoints);

        // Draw connections
        if (this.options.drawConnections) {
            this._drawConnections(keypointMap);
        }

        // Draw head connection (head center to shoulder center)
        if (this.options.drawHeadConnection) {
            this._drawHeadConnection(keypointMap);
        }

        // Draw keypoints
        if (this.options.drawKeypoints) {
            this._drawKeypoints(drawKeypoints, keypointMap);
        }

        return drawKeypoints;
    }

    /**
     * Clear the canvas
     */
    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * Reset smoother state
     */
    reset() {
        if (this.smoother) {
            this.smoother.reset();
        }
    }

    /**
     * Draw skeleton connections
     */
    _drawConnections(keypointMap) {
        const { ctx } = this;
        const { lineColor, lineWidth, minScore } = this.options;

        ctx.strokeStyle = lineColor;
        ctx.lineWidth = lineWidth;

        for (const [startName, endName] of Keypoints.SKELETON) {
            const start = keypointMap[startName];
            const end = keypointMap[endName];

            if (start && end && start.score > minScore && end.score > minScore) {
                ctx.beginPath();
                ctx.moveTo(start.x, start.y);
                ctx.lineTo(end.x, end.y);
                ctx.stroke();
            }
        }
    }

    /**
     * Draw head connection (head center to shoulder center)
     * Head center is calculated from nose and ears (whatever is visible)
     */
    _drawHeadConnection(keypointMap) {
        const { ctx } = this;
        const { lineColor, lineWidth, minScore } = this.options;

        const leftShoulder = keypointMap['left_shoulder'];
        const rightShoulder = keypointMap['right_shoulder'];

        if (!leftShoulder || !rightShoulder ||
            leftShoulder.score <= minScore ||
            rightShoulder.score <= minScore) {
            return;
        }

        // Calculate head center from available points (nose, ears)
        const headCenter = this._getHeadCenter(keypointMap);
        if (!headCenter) return;

        const shoulderCenter = {
            x: (leftShoulder.x + rightShoulder.x) / 2,
            y: (leftShoulder.y + rightShoulder.y) / 2
        };

        ctx.strokeStyle = lineColor;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        ctx.moveTo(headCenter.x, headCenter.y);
        ctx.lineTo(shoulderCenter.x, shoulderCenter.y);
        ctx.stroke();
    }

    /**
     * Calculate head center from nose and ears
     * Uses whatever points are available with sufficient confidence
     */
    _getHeadCenter(keypointMap) {
        const { minScore } = this.options;
        const nose = keypointMap['nose'];
        const leftEar = keypointMap['left_ear'];
        const rightEar = keypointMap['right_ear'];

        const validPoints = [];
        if (nose && nose.score > minScore) validPoints.push(nose);
        if (leftEar && leftEar.score > minScore) validPoints.push(leftEar);
        if (rightEar && rightEar.score > minScore) validPoints.push(rightEar);

        if (validPoints.length === 0) return null;

        const avgX = validPoints.reduce((sum, p) => sum + p.x, 0) / validPoints.length;
        const avgY = validPoints.reduce((sum, p) => sum + p.y, 0) / validPoints.length;
        const avgScore = validPoints.reduce((sum, p) => sum + p.score, 0) / validPoints.length;

        return { x: avgX, y: avgY, score: avgScore };
    }

    /**
     * Draw keypoints
     */
    _drawKeypoints(keypoints, keypointMap) {
        const {
            minScore,
            goodScore,
            useHeadCenter
        } = this.options;

        // Draw body keypoints (skip nose if we use head center instead)
        for (const kp of keypoints) {
            if (useHeadCenter && kp.name === 'nose') continue;

            if (kp.score > minScore && Keypoints.isVisible(kp.name)) {
                this._drawPoint(kp.x, kp.y, kp.score > goodScore);
            }
        }

        // Draw head center point (calculated from nose + ears)
        if (useHeadCenter) {
            const headCenter = this._getHeadCenter(keypointMap);
            if (headCenter && headCenter.score > minScore) {
                this._drawPoint(headCenter.x, headCenter.y, headCenter.score > goodScore);
            }
        }
    }

    /**
     * Draw a single point
     */
    _drawPoint(x, y, isGood) {
        const { ctx } = this;
        const { pointRadius, pointStrokeWidth, pointStrokeColor, pointColorGood, pointColorWeak } = this.options;

        ctx.beginPath();
        ctx.arc(x, y, pointRadius, 0, 2 * Math.PI);
        ctx.fillStyle = isGood ? pointColorGood : pointColorWeak;
        ctx.fill();
        ctx.strokeStyle = pointStrokeColor;
        ctx.lineWidth = pointStrokeWidth;
        ctx.stroke();
    }

    /**
     * Resize canvas to match video dimensions
     */
    resizeToVideo(video) {
        if (video.videoWidth && video.videoHeight) {
            this.canvas.width = video.videoWidth;
            this.canvas.height = video.videoHeight;
        }
    }
}
