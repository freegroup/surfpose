/**
 * SURFPOP - Pose Matchers
 * Exchangeable algorithms for pose comparison
 */

/**
 * Base class for all pose matchers
 */
class PoseMatcher {
    constructor() {
        this.name = 'Base Matcher';
        this.description = 'Abstract base class';
    }

    /**
     * Compare current pose against reference poses
     * @param {Object} currentAngles - Current pose angles from PoseDB.calculateAngles()
     * @param {Array} referencePoses - Array of reference poses from PoseDB
     * @param {Object} options - Matcher-specific options
     * @returns {Object} { match: boolean, score: 0-1, matchedPose: pose|null, details: {} }
     */
    compare(currentAngles, referencePoses, options = {}) {
        throw new Error('compare() must be implemented by subclass');
    }

    /**
     * Get default options for this matcher
     */
    getDefaultOptions() {
        return {};
    }
}

/**
 * Strict Angle Matcher
 * Compares joint angles with tight tolerance, no mirroring
 */
class StrictAngleMatcher extends PoseMatcher {
    constructor() {
        super();
        this.name = 'Strict Angle';
        this.description = 'Tight tolerance (±10°), no mirroring';
    }

    getDefaultOptions() {
        return {
            tolerance: 10,  // degrees
            minAnglesRequired: 4,
            weights: {
                leftKnee: 1,
                rightKnee: 1,
                leftHip: 1,
                rightHip: 1,
                leftElbow: 0.5,
                rightElbow: 0.5,
                leftShoulder: 0.5,
                rightShoulder: 0.5,
                torsoVertical: 1.5
            }
        };
    }

    compare(currentAngles, referencePoses, options = {}) {
        const opts = { ...this.getDefaultOptions(), ...options };
        let bestMatch = { match: false, score: 0, matchedPose: null, details: {} };

        for (const pose of referencePoses) {
            const result = this._compareSingle(currentAngles, pose.angles, opts);
            if (result.score > bestMatch.score) {
                bestMatch = { ...result, matchedPose: pose };
            }
        }

        return bestMatch;
    }

    _compareSingle(current, reference, opts) {
        const { tolerance, weights, minAnglesRequired } = opts;
        let totalWeight = 0;
        let matchedWeight = 0;
        let angleCount = 0;
        const details = {};

        for (const [angleName, weight] of Object.entries(weights)) {
            const currentVal = current[angleName];
            const refVal = reference[angleName];

            if (currentVal === null || refVal === null) continue;

            angleCount++;
            totalWeight += weight;
            const diff = Math.abs(currentVal - refVal);
            details[angleName] = { current: currentVal, reference: refVal, diff };

            if (diff <= tolerance) {
                matchedWeight += weight;
            } else if (diff <= tolerance * 2) {
                // Partial credit for close matches
                matchedWeight += weight * (1 - (diff - tolerance) / tolerance);
            }
        }

        if (angleCount < minAnglesRequired) {
            return { match: false, score: 0, details: { error: 'Not enough angles detected' } };
        }

        const score = matchedWeight / totalWeight;
        return {
            match: score >= 0.7,
            score,
            details
        };
    }
}

/**
 * Relaxed Angle Matcher
 * More forgiving tolerance for casual use
 */
class RelaxedAngleMatcher extends StrictAngleMatcher {
    constructor() {
        super();
        this.name = 'Relaxed Angle';
        this.description = 'Loose tolerance (±20°), no mirroring';
    }

    getDefaultOptions() {
        return {
            ...super.getDefaultOptions(),
            tolerance: 20
        };
    }
}

/**
 * Mirrored Angle Matcher
 * Automatically checks both regular and goofy stance
 */
class MirroredAngleMatcher extends PoseMatcher {
    constructor() {
        super();
        this.name = 'Mirrored Angle';
        this.description = 'Auto-mirrors for Regular/Goofy stance (±15°)';
    }

    getDefaultOptions() {
        return {
            tolerance: 15,
            minAnglesRequired: 4,
            weights: {
                leftKnee: 1,
                rightKnee: 1,
                leftHip: 1,
                rightHip: 1,
                leftElbow: 0.5,
                rightElbow: 0.5,
                leftShoulder: 0.5,
                rightShoulder: 0.5,
                torsoVertical: 1.5
            }
        };
    }

    compare(currentAngles, referencePoses, options = {}) {
        const opts = { ...this.getDefaultOptions(), ...options };
        let bestMatch = { match: false, score: 0, matchedPose: null, details: {}, mirrored: false };

        for (const pose of referencePoses) {
            // Try normal comparison
            const normalResult = this._compareSingle(currentAngles, pose.angles, opts);
            if (normalResult.score > bestMatch.score) {
                bestMatch = { ...normalResult, matchedPose: pose, mirrored: false };
            }

            // Try mirrored comparison
            const mirroredRef = this._mirrorAngles(pose.angles);
            const mirroredResult = this._compareSingle(currentAngles, mirroredRef, opts);
            if (mirroredResult.score > bestMatch.score) {
                bestMatch = { ...mirroredResult, matchedPose: pose, mirrored: true };
            }
        }

        return bestMatch;
    }

    _mirrorAngles(angles) {
        return {
            leftKnee: angles.rightKnee,
            rightKnee: angles.leftKnee,
            leftHip: angles.rightHip,
            rightHip: angles.leftHip,
            leftElbow: angles.rightElbow,
            rightElbow: angles.leftElbow,
            leftShoulder: angles.rightShoulder,
            rightShoulder: angles.leftShoulder,
            torsoVertical: angles.torsoVertical  // Symmetric, stays the same
        };
    }

    _compareSingle(current, reference, opts) {
        const { tolerance, weights, minAnglesRequired } = opts;
        let totalWeight = 0;
        let matchedWeight = 0;
        let angleCount = 0;
        const details = {};

        for (const [angleName, weight] of Object.entries(weights)) {
            const currentVal = current[angleName];
            const refVal = reference[angleName];

            if (currentVal === null || refVal === null) continue;

            angleCount++;
            totalWeight += weight;
            const diff = Math.abs(currentVal - refVal);
            details[angleName] = { current: currentVal, reference: refVal, diff };

            if (diff <= tolerance) {
                matchedWeight += weight;
            } else if (diff <= tolerance * 2) {
                matchedWeight += weight * (1 - (diff - tolerance) / tolerance);
            }
        }

        if (angleCount < minAnglesRequired) {
            return { match: false, score: 0, details: { error: 'Not enough angles detected' } };
        }

        const score = matchedWeight / totalWeight;
        return {
            match: score >= 0.7,
            score,
            details
        };
    }
}

/**
 * Torso-Only Matcher
 * Only checks torso angle - simple standing/lying detection
 */
class TorsoOnlyMatcher extends PoseMatcher {
    constructor() {
        super();
        this.name = 'Torso Only';
        this.description = 'Only checks torso angle (simple standing/lying)';
    }

    getDefaultOptions() {
        return {
            tolerance: 20
        };
    }

    compare(currentAngles, referencePoses, options = {}) {
        const opts = { ...this.getDefaultOptions(), ...options };
        let bestMatch = { match: false, score: 0, matchedPose: null, details: {} };

        const currentTorso = currentAngles.torsoVertical;
        if (currentTorso === null) {
            return { match: false, score: 0, matchedPose: null, details: { error: 'Torso not detected' } };
        }

        for (const pose of referencePoses) {
            const refTorso = pose.angles.torsoVertical;
            if (refTorso === null) continue;

            const diff = Math.abs(currentTorso - refTorso);
            const score = Math.max(0, 1 - diff / 90);  // 0° diff = 1.0, 90° diff = 0

            if (score > bestMatch.score) {
                bestMatch = {
                    match: diff <= opts.tolerance,
                    score,
                    matchedPose: pose,
                    details: { currentTorso, refTorso, diff }
                };
            }
        }

        return bestMatch;
    }
}

/**
 * Weighted Key Angles Matcher
 * Focuses on the most important angles for surf pop-up
 */
class SurfPopupMatcher extends PoseMatcher {
    constructor() {
        super();
        this.name = 'Surf Popup';
        this.description = 'Optimized for surf pop-up detection (knees, hips, torso)';
    }

    getDefaultOptions() {
        return {
            tolerance: 15,
            minAnglesRequired: 3,
            // Higher weight on angles most important for pop-up
            weights: {
                leftKnee: 2,
                rightKnee: 2,
                leftHip: 1.5,
                rightHip: 1.5,
                torsoVertical: 2,
                leftElbow: 0,   // Arms don't matter much
                rightElbow: 0,
                leftShoulder: 0,
                rightShoulder: 0
            },
            autoMirror: true
        };
    }

    compare(currentAngles, referencePoses, options = {}) {
        const opts = { ...this.getDefaultOptions(), ...options };
        let bestMatch = { match: false, score: 0, matchedPose: null, details: {}, mirrored: false };

        for (const pose of referencePoses) {
            // Try normal
            const normalResult = this._compareSingle(currentAngles, pose.angles, opts);
            if (normalResult.score > bestMatch.score) {
                bestMatch = { ...normalResult, matchedPose: pose, mirrored: false };
            }

            // Try mirrored if enabled
            if (opts.autoMirror) {
                const mirroredRef = this._mirrorAngles(pose.angles);
                const mirroredResult = this._compareSingle(currentAngles, mirroredRef, opts);
                if (mirroredResult.score > bestMatch.score) {
                    bestMatch = { ...mirroredResult, matchedPose: pose, mirrored: true };
                }
            }
        }

        return bestMatch;
    }

    _mirrorAngles(angles) {
        return {
            leftKnee: angles.rightKnee,
            rightKnee: angles.leftKnee,
            leftHip: angles.rightHip,
            rightHip: angles.leftHip,
            leftElbow: angles.rightElbow,
            rightElbow: angles.leftElbow,
            leftShoulder: angles.rightShoulder,
            rightShoulder: angles.leftShoulder,
            torsoVertical: angles.torsoVertical
        };
    }

    _compareSingle(current, reference, opts) {
        const { tolerance, weights, minAnglesRequired } = opts;
        let totalWeight = 0;
        let matchedWeight = 0;
        let angleCount = 0;
        const details = {};

        for (const [angleName, weight] of Object.entries(weights)) {
            if (weight === 0) continue;  // Skip disabled angles

            const currentVal = current[angleName];
            const refVal = reference[angleName];

            if (currentVal === null || refVal === null) continue;

            angleCount++;
            totalWeight += weight;
            const diff = Math.abs(currentVal - refVal);
            details[angleName] = { current: currentVal, reference: refVal, diff };

            if (diff <= tolerance) {
                matchedWeight += weight;
            } else if (diff <= tolerance * 2) {
                matchedWeight += weight * (1 - (diff - tolerance) / tolerance);
            }
        }

        if (angleCount < minAnglesRequired) {
            return { match: false, score: 0, details: { error: 'Not enough angles detected' } };
        }

        const score = matchedWeight / totalWeight;
        return {
            match: score >= 0.65,  // Slightly lower threshold
            score,
            details
        };
    }
}

/**
 * Registry of all available matchers
 */
const PoseMatchers = {
    strict: new StrictAngleMatcher(),
    relaxed: new RelaxedAngleMatcher(),
    mirrored: new MirroredAngleMatcher(),
    torsoOnly: new TorsoOnlyMatcher(),
    surfPopup: new SurfPopupMatcher(),

    /**
     * Get matcher by name
     */
    get(name) {
        return this[name] || this.mirrored;  // Default to mirrored
    },

    /**
     * Get all available matchers
     */
    getAll() {
        return {
            strict: this.strict,
            relaxed: this.relaxed,
            mirrored: this.mirrored,
            torsoOnly: this.torsoOnly,
            surfPopup: this.surfPopup
        };
    },

    /**
     * Get matcher info for UI
     */
    getInfo() {
        return Object.entries(this.getAll()).map(([key, matcher]) => ({
            key,
            name: matcher.name,
            description: matcher.description
        }));
    }
};
