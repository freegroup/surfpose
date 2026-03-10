/**
 * SURFPOP - Shared Keypoint Configuration
 * Single source of truth for keypoints used across training and detection
 */

const Keypoints = {
    // All 17 core keypoints (shared between MoveNet and BlazePose)
    CORE: [
        'nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear',
        'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
        'left_wrist', 'right_wrist', 'left_hip', 'right_hip',
        'left_knee', 'right_knee', 'left_ankle', 'right_ankle'
    ],

    // Body-relevant keypoints for visualization (no eyes/ears)
    VISIBLE: [
        'nose',
        'left_shoulder', 'right_shoulder',
        'left_elbow', 'right_elbow',
        'left_wrist', 'right_wrist',
        'left_hip', 'right_hip',
        'left_knee', 'right_knee',
        'left_ankle', 'right_ankle'
    ],

    // Skeleton connections for drawing
    SKELETON: [
        ['left_shoulder', 'right_shoulder'],
        ['left_shoulder', 'left_elbow'],
        ['left_elbow', 'left_wrist'],
        ['right_shoulder', 'right_elbow'],
        ['right_elbow', 'right_wrist'],
        ['left_shoulder', 'left_hip'],
        ['right_shoulder', 'right_hip'],
        ['left_hip', 'right_hip'],
        ['left_hip', 'left_knee'],
        ['left_knee', 'left_ankle'],
        ['right_hip', 'right_knee'],
        ['right_knee', 'right_ankle']
    ],

    // Keypoints used for angle calculations
    ANGLE_KEYPOINTS: [
        'left_shoulder', 'right_shoulder',
        'left_elbow', 'right_elbow',
        'left_wrist', 'right_wrist',
        'left_hip', 'right_hip',
        'left_knee', 'right_knee',
        'left_ankle', 'right_ankle'
    ],

    /**
     * Check if a keypoint name is in the core set
     */
    isCore(name) {
        return this.CORE.includes(name);
    },

    /**
     * Check if a keypoint should be drawn
     */
    isVisible(name) {
        return this.VISIBLE.includes(name);
    },

    /**
     * Extract only core keypoints from a full keypoint array
     */
    extractCore(keypoints) {
        const core = {};
        keypoints.forEach((kp, index) => {
            const name = kp.name || this.CORE[index];
            if (this.isCore(name)) {
                core[name] = {
                    x: kp.x,
                    y: kp.y,
                    score: kp.score
                };
            }
        });
        return core;
    },

    /**
     * Create a keypoint map from array
     */
    toMap(keypoints) {
        const map = {};
        keypoints.forEach(kp => {
            map[kp.name] = kp;
        });
        return map;
    }
};
