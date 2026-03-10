/**
 * SURFPOP - Pose Database
 * IndexedDB storage for reference poses
 */

const PoseDB = (function() {
    const DB_NAME = 'surfpop-poses';
    const DB_VERSION = 1;
    const STORE_NAME = 'poses';

    let db = null;

    /**
     * Initialize the database
     */
    async function init() {
        if (db) return db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);

            request.onsuccess = () => {
                db = request.result;
                resolve(db);
            };

            request.onupgradeneeded = (event) => {
                const database = event.target.result;

                if (!database.objectStoreNames.contains(STORE_NAME)) {
                    const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    store.createIndex('label', 'label', { unique: false });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };
        });
    }

    /**
     * Generate a unique ID
     */
    function generateId() {
        return `pose_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Calculate angle between three points (in degrees)
     */
    function calculateAngle(a, b, c) {
        if (!a || !b || !c) return null;
        if (a.score < 0.3 || b.score < 0.3 || c.score < 0.3) return null;

        const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
        let angle = Math.abs(radians * 180 / Math.PI);
        if (angle > 180) angle = 360 - angle;
        return angle;
    }

    /**
     * Extract core keypoints from any model's output
     */
    function extractCoreKeypoints(keypoints) {
        const core = {};

        keypoints.forEach((kp, index) => {
            const name = kp.name || Keypoints.CORE[index];
            if (Keypoints.isCore(name)) {
                core[name] = {
                    x: kp.x,
                    y: kp.y,
                    score: kp.score
                };
            }
        });

        return core;
    }

    /**
     * Normalize keypoints relative to hip center and shoulder width
     */
    function normalizeKeypoints(coreKeypoints) {
        const leftHip = coreKeypoints.left_hip;
        const rightHip = coreKeypoints.right_hip;
        const leftShoulder = coreKeypoints.left_shoulder;
        const rightShoulder = coreKeypoints.right_shoulder;

        if (!leftHip || !rightHip || !leftShoulder || !rightShoulder) {
            return null;
        }

        // Center point (hip center)
        const centerX = (leftHip.x + rightHip.x) / 2;
        const centerY = (leftHip.y + rightHip.y) / 2;

        // Scale factor (shoulder width)
        const shoulderWidth = Math.sqrt(
            Math.pow(rightShoulder.x - leftShoulder.x, 2) +
            Math.pow(rightShoulder.y - leftShoulder.y, 2)
        );

        if (shoulderWidth < 10) return null; // Too small to normalize

        const normalized = {};
        for (const [name, kp] of Object.entries(coreKeypoints)) {
            normalized[name] = {
                x: (kp.x - centerX) / shoulderWidth,
                y: (kp.y - centerY) / shoulderWidth,
                score: kp.score
            };
        }

        return normalized;
    }

    /**
     * Calculate all relevant joint angles
     */
    function calculateAngles(coreKeypoints) {
        const kp = coreKeypoints;

        return {
            // Knee angles
            leftKnee: calculateAngle(kp.left_hip, kp.left_knee, kp.left_ankle),
            rightKnee: calculateAngle(kp.right_hip, kp.right_knee, kp.right_ankle),

            // Hip angles
            leftHip: calculateAngle(kp.left_shoulder, kp.left_hip, kp.left_knee),
            rightHip: calculateAngle(kp.right_shoulder, kp.right_hip, kp.right_knee),

            // Elbow angles
            leftElbow: calculateAngle(kp.left_shoulder, kp.left_elbow, kp.left_wrist),
            rightElbow: calculateAngle(kp.right_shoulder, kp.right_elbow, kp.right_wrist),

            // Shoulder angles
            leftShoulder: calculateAngle(kp.left_elbow, kp.left_shoulder, kp.left_hip),
            rightShoulder: calculateAngle(kp.right_elbow, kp.right_shoulder, kp.right_hip),

            // Body angles (for standing/lying detection)
            torsoVertical: calculateTorsoAngle(kp)
        };
    }

    /**
     * Calculate torso angle relative to vertical
     */
    function calculateTorsoAngle(kp) {
        const leftHip = kp.left_hip;
        const rightHip = kp.right_hip;
        const leftShoulder = kp.left_shoulder;
        const rightShoulder = kp.right_shoulder;

        if (!leftHip || !rightHip || !leftShoulder || !rightShoulder) return null;

        const hipCenter = {
            x: (leftHip.x + rightHip.x) / 2,
            y: (leftHip.y + rightHip.y) / 2
        };

        const shoulderCenter = {
            x: (leftShoulder.x + rightShoulder.x) / 2,
            y: (leftShoulder.y + rightShoulder.y) / 2
        };

        // Angle from vertical (0° = standing straight, 90° = lying)
        const dx = shoulderCenter.x - hipCenter.x;
        const dy = shoulderCenter.y - hipCenter.y;
        const angle = Math.abs(Math.atan2(dx, -dy) * 180 / Math.PI);

        return angle;
    }

    /**
     * Create a thumbnail from video element
     */
    function createThumbnail(video, maxSize = 160) {
        const canvas = document.createElement('canvas');
        const aspect = video.videoWidth / video.videoHeight;

        if (aspect > 1) {
            canvas.width = maxSize;
            canvas.height = maxSize / aspect;
        } else {
            canvas.height = maxSize;
            canvas.width = maxSize * aspect;
        }

        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
                resolve({
                    blob,
                    width: canvas.width,
                    height: canvas.height
                });
            }, 'image/jpeg', 0.7);
        });
    }

    /**
     * Scale keypoints to thumbnail size
     */
    function scaleKeypointsToThumbnail(keypoints, videoWidth, videoHeight, thumbWidth, thumbHeight) {
        const scaleX = thumbWidth / videoWidth;
        const scaleY = thumbHeight / videoHeight;

        const scaled = {};
        for (const kp of keypoints) {
            const name = kp.name || Keypoints.CORE[keypoints.indexOf(kp)];
            if (Keypoints.isCore(name)) {
                scaled[name] = {
                    x: kp.x * scaleX,
                    y: kp.y * scaleY,
                    score: kp.score
                };
            }
        }
        return scaled;
    }

    /**
     * Save a new pose
     */
    async function savePose(keypoints, video, label = 'STAND') {
        await init();

        const coreKeypoints = extractCoreKeypoints(keypoints);
        const normalizedKeypoints = normalizeKeypoints(coreKeypoints);
        const angles = calculateAngles(coreKeypoints);
        const thumbnailData = await createThumbnail(video);

        // Scale keypoints to thumbnail coordinates for preview
        const thumbnailKeypoints = scaleKeypointsToThumbnail(
            keypoints,
            video.videoWidth,
            video.videoHeight,
            thumbnailData.width,
            thumbnailData.height
        );

        if (!normalizedKeypoints) {
            throw new Error('Could not normalize keypoints - body not fully visible');
        }

        const pose = {
            id: generateId(),
            label: label,
            timestamp: Date.now(),
            keypoints: normalizedKeypoints,
            thumbnailKeypoints: thumbnailKeypoints,
            angles: angles,
            thumbnail: thumbnailData.blob
        };

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.add(pose);

            request.onsuccess = () => resolve(pose);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get all poses (optionally filtered by label)
     */
    async function getAllPoses(label = null) {
        await init();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);

            let request;
            if (label) {
                const index = store.index('label');
                request = index.getAll(label);
            } else {
                request = store.getAll();
            }

            request.onsuccess = () => {
                const poses = request.result.sort((a, b) => a.timestamp - b.timestamp);
                resolve(poses);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get a single pose by ID
     */
    async function getPose(id) {
        await init();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Delete a pose by ID
     */
    async function deletePose(id) {
        await init();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(id);

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Delete all poses
     */
    async function clearAllPoses() {
        await init();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.clear();

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get pose count
     */
    async function getCount() {
        await init();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.count();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Export all poses as JSON (thumbnails as base64)
     */
    async function exportPoses() {
        const poses = await getAllPoses();

        const exportData = await Promise.all(poses.map(async (pose) => {
            let thumbnailBase64 = null;
            if (pose.thumbnail) {
                const reader = new FileReader();
                thumbnailBase64 = await new Promise((resolve) => {
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(pose.thumbnail);
                });
            }

            return {
                ...pose,
                thumbnail: thumbnailBase64
            };
        }));

        return JSON.stringify(exportData, null, 2);
    }

    /**
     * Import poses from JSON
     */
    async function importPoses(jsonString) {
        const poses = JSON.parse(jsonString);
        await init();

        let imported = 0;
        for (const poseData of poses) {
            // Convert base64 thumbnail back to blob
            let thumbnail = null;
            if (poseData.thumbnail && poseData.thumbnail.startsWith('data:')) {
                const response = await fetch(poseData.thumbnail);
                thumbnail = await response.blob();
            }

            const pose = {
                ...poseData,
                id: generateId(), // Generate new ID to avoid conflicts
                thumbnail: thumbnail
            };

            await new Promise((resolve, reject) => {
                const transaction = db.transaction([STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.add(pose);
                request.onsuccess = () => { imported++; resolve(); };
                request.onerror = () => reject(request.error);
            });
        }

        return imported;
    }

    // Public API
    return {
        init,
        savePose,
        getAllPoses,
        getPose,
        deletePose,
        clearAllPoses,
        getCount,
        exportPoses,
        importPoses,
        // Utility functions exposed for matchers
        extractCoreKeypoints,
        normalizeKeypoints,
        calculateAngles
    };
})();
