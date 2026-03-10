/**
 * SURFPOP - Pose Training App
 * Record reference poses for matching
 */

// DOM Elements
const video = document.getElementById('video');
const canvas = document.getElementById('skeleton-canvas');
const loadingOverlay = document.getElementById('loading-overlay');
const loadingText = document.getElementById('loading-text');
const flashOverlay = document.getElementById('flash-overlay');
const poseStatus = document.getElementById('pose-status');
const statusText = poseStatus.querySelector('.status-text');
const galleryScroll = document.getElementById('gallery-scroll');
const galleryCount = document.getElementById('gallery-count');
const galleryEmpty = document.getElementById('gallery-empty');
const poseLabelSelect = document.getElementById('pose-label');
const autoRecordCheckbox = document.getElementById('auto-record-checkbox');
const autoRecordProgress = document.getElementById('auto-record-progress');
const progressRing = document.getElementById('progress-ring');
const progressSeconds = document.getElementById('progress-seconds');

// State
let detector = null;
let painter = null;
let currentKeypoints = null;
let isRecording = false;

// Auto-record state
const AUTO_RECORD_DURATION = 5; // seconds to hold pose
const STABILITY_THRESHOLD = 35; // max pixel movement allowed (average across keypoints)
let stableStartTime = null;
let referenceKeypoints = null;

/**
 * Initialize the application
 */
async function init() {
    try {
        loadingText.textContent = 'Initialisiere Kamera...';
        await setupCamera();

        // Initialize painter (no smoothing for training - we want raw positions)
        painter = new PosePainter(canvas, {});

        loadingText.textContent = 'Lade MoveNet...';
        await setupDetector();

        loadingText.textContent = 'Lade gespeicherte Posen...';
        await PoseDB.init();
        await refreshGallery();

        loadingOverlay.classList.add('hidden');

        setupKeyboardShortcuts();
        detectPose();

    } catch (error) {
        console.error('Initialization error:', error);
        loadingText.textContent = 'Fehler: ' + error.message;
    }
}

/**
 * Setup camera stream
 */
async function setupCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({
        video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 }
        },
        audio: false
    });

    video.srcObject = stream;

    return new Promise((resolve) => {
        video.onloadedmetadata = () => {
            video.play();
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            resolve();
        };
    });
}

/**
 * Setup pose detector (MoveNet Lightning for fast feedback)
 */
async function setupDetector() {
    await tf.setBackend('webgl');
    await tf.ready();

    detector = await poseDetection.createDetector(
        poseDetection.SupportedModels.MoveNet,
        {
            modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING
        }
    );
}

/**
 * Setup keyboard shortcuts
 */
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', async (e) => {
        if (e.code === 'Space' || e.code === 'Enter') {
            e.preventDefault();
            await recordPose();
        }
    });
}

/**
 * Main pose detection loop
 */
async function detectPose() {
    if (!detector) {
        requestAnimationFrame(detectPose);
        return;
    }

    try {
        const poses = await detector.estimatePoses(video);

        if (poses.length > 0 && poses[0].keypoints) {
            currentKeypoints = poses[0].keypoints;
            painter.draw(currentKeypoints);
            updatePoseStatus(true, currentKeypoints);

            // Check auto-record stability
            if (autoRecordCheckbox.checked) {
                checkAutoRecord(currentKeypoints);
            }
        } else {
            currentKeypoints = null;
            painter.clear();
            updatePoseStatus(false);
            resetAutoRecord();
        }
    } catch (error) {
        console.error('Detection error:', error);
    }

    requestAnimationFrame(detectPose);
}

/**
 * Update pose status indicator
 */
function updatePoseStatus(detected, keypoints = null) {
    if (detected && keypoints) {
        // Count high-confidence keypoints
        const goodKeypoints = keypoints.filter(kp => kp.score > 0.5).length;

        if (goodKeypoints >= 12) {
            poseStatus.classList.add('ready');
            statusText.textContent = 'Bereit zum Aufnehmen';
        } else {
            poseStatus.classList.remove('ready');
            statusText.textContent = `${goodKeypoints}/12 Keypoints erkannt`;
        }
    } else {
        poseStatus.classList.remove('ready');
        statusText.textContent = 'Keine Pose erkannt';
    }
}

/**
 * Record current pose
 */
async function recordPose() {
    if (isRecording) return;
    if (!currentKeypoints) {
        Toast.warning('Keine Pose erkannt - tritt ins Bild');
        return;
    }

    // Check if enough keypoints are detected
    const goodKeypoints = currentKeypoints.filter(kp => kp.score > 0.5).length;
    if (goodKeypoints < 12) {
        Toast.warning(`Nicht genug erkannt (${goodKeypoints}/12) - zeig mehr vom Körper`);
        return;
    }

    isRecording = true;

    // Flash effect
    flashOverlay.classList.add('flash');
    setTimeout(() => flashOverlay.classList.remove('flash'), 300);

    try {
        const label = poseLabelSelect.value;
        const pose = await PoseDB.savePose(currentKeypoints, video, label);

        // Add to gallery
        addPoseToGallery(pose);
        updateGalleryCount();

        console.log('Pose saved:', pose.id);
    } catch (error) {
        console.error('Error saving pose:', error);
        Toast.error('Fehler: ' + error.message);
    }

    isRecording = false;
}

/**
 * Refresh gallery from database
 */
async function refreshGallery() {
    const poses = await PoseDB.getAllPoses();

    // Clear existing cards (except empty state)
    const existingCards = galleryScroll.querySelectorAll('.pose-card');
    existingCards.forEach(card => card.remove());

    if (poses.length === 0) {
        galleryEmpty.style.display = 'block';
    } else {
        galleryEmpty.style.display = 'none';
        poses.forEach(pose => addPoseToGallery(pose, false));
    }

    updateGalleryCount();
}

/**
 * Add a pose card to gallery
 */
function addPoseToGallery(pose, prepend = true) {
    galleryEmpty.style.display = 'none';

    const card = document.createElement('div');
    card.className = 'pose-card';
    card.dataset.poseId = pose.id;

    // Create thumbnail URL
    const thumbnailUrl = URL.createObjectURL(pose.thumbnail);

    card.innerHTML = `
        <img src="${thumbnailUrl}" alt="${pose.label}">
        <button class="delete-btn" title="Löschen">×</button>
        <div class="pose-card-info">${pose.label}</div>
    `;

    // Delete button handler
    const deleteBtn = card.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await deletePose(pose.id, card);
    });

    // Tooltip on hover
    card.addEventListener('mouseenter', () => showPoseTooltip(pose, card, thumbnailUrl));
    card.addEventListener('mouseleave', hidePoseTooltip);

    // Insert into gallery
    if (prepend) {
        galleryScroll.insertBefore(card, galleryScroll.firstChild);
        // Scroll to show new card
        galleryScroll.scrollLeft = 0;
    } else {
        galleryScroll.appendChild(card);
    }
}

/**
 * Delete a pose
 */
async function deletePose(id, cardElement) {
    // Hide tooltip immediately
    hidePoseTooltip();

    try {
        await PoseDB.deletePose(id);

        // Animate removal
        cardElement.style.transform = 'scale(0.8)';
        cardElement.style.opacity = '0';

        setTimeout(() => {
            cardElement.remove();
            updateGalleryCount();

            // Show empty state if no poses left
            const remainingCards = galleryScroll.querySelectorAll('.pose-card');
            if (remainingCards.length === 0) {
                galleryEmpty.style.display = 'block';
            }
        }, 200);

    } catch (error) {
        console.error('Error deleting pose:', error);
    }
}

/**
 * Update gallery count display
 */
async function updateGalleryCount() {
    const count = await PoseDB.getCount();
    galleryCount.textContent = `${count} ${count === 1 ? 'Pose' : 'Posen'}`;
}

/**
 * Check if pose is stable enough for auto-record
 */
function checkAutoRecord(keypoints) {
    const goodKeypoints = keypoints.filter(kp => kp.score > 0.5).length;

    // Need at least 12 keypoints
    if (goodKeypoints < 12) {
        resetAutoRecord();
        return;
    }

    // If no reference, set current as reference
    if (!referenceKeypoints) {
        referenceKeypoints = keypoints.map(kp => ({ ...kp }));
        stableStartTime = Date.now();
        return;
    }

    // Calculate movement from reference
    const movement = calculateMovement(keypoints, referenceKeypoints);

    if (movement > STABILITY_THRESHOLD) {
        // Too much movement, reset
        resetAutoRecord();
        return;
    }

    // Still stable, update progress
    const elapsed = (Date.now() - stableStartTime) / 1000;
    const remaining = Math.max(0, AUTO_RECORD_DURATION - elapsed);

    updateAutoRecordProgress(elapsed / AUTO_RECORD_DURATION, Math.ceil(remaining));

    // Time to record!
    if (elapsed >= AUTO_RECORD_DURATION) {
        recordPose();
        resetAutoRecord();
    }
}

/**
 * Calculate average movement between two keypoint sets
 */
function calculateMovement(current, reference) {
    let totalMovement = 0;
    let count = 0;

    for (let i = 0; i < current.length; i++) {
        const curr = current[i];
        const ref = reference[i];

        if (curr.score > 0.5 && ref.score > 0.5) {
            const dx = curr.x - ref.x;
            const dy = curr.y - ref.y;
            totalMovement += Math.sqrt(dx * dx + dy * dy);
            count++;
        }
    }

    return count > 0 ? totalMovement / count : Infinity;
}

/**
 * Update auto-record progress UI
 */
function updateAutoRecordProgress(progress, secondsRemaining) {
    autoRecordProgress.classList.remove('hidden');

    // Progress ring (circumference = 2 * PI * r = 2 * 3.14159 * 16 ≈ 100.53)
    const circumference = 100.53;
    const offset = circumference * (1 - progress);
    progressRing.style.strokeDashoffset = offset;

    progressSeconds.textContent = secondsRemaining;
}

/**
 * Reset auto-record state
 */
function resetAutoRecord() {
    stableStartTime = null;
    referenceKeypoints = null;
    autoRecordProgress.classList.add('hidden');
    progressRing.style.strokeDashoffset = 100.53;
    progressSeconds.textContent = AUTO_RECORD_DURATION;
}

// Tooltip state
let tooltipElement = null;

/**
 * Show pose tooltip with skeleton overlay
 */
function showPoseTooltip(pose, card, thumbnailUrl) {
    hidePoseTooltip();

    const TOOLTIP_SCALE = 4;
    const rect = card.getBoundingClientRect();

    // Create tooltip container
    tooltipElement = document.createElement('div');
    tooltipElement.className = 'pose-tooltip';

    // Create image
    const img = new Image();
    img.src = thumbnailUrl;
    img.style.cssText = `
        border-radius: 8px;
        display: block;
    `;

    // Create canvas overlay for skeleton
    const canvas = document.createElement('canvas');
    canvas.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        border-radius: 8px;
    `;

    tooltipElement.appendChild(img);
    tooltipElement.appendChild(canvas);
    document.body.appendChild(tooltipElement);

    // Position and draw once image is loaded
    img.onload = () => {
        const width = img.naturalWidth * TOOLTIP_SCALE;
        const height = img.naturalHeight * TOOLTIP_SCALE;

        img.style.width = `${width}px`;
        img.style.height = `${height}px`;

        canvas.width = width;
        canvas.height = height;

        // Calculate position - prefer above card, centered
        let left = rect.left + rect.width / 2 - width / 2;
        let top = rect.top - height - 12;

        // Keep within viewport bounds
        const padding = 10;

        // Horizontal bounds
        if (left < padding) {
            left = padding;
        } else if (left + width > window.innerWidth - padding) {
            left = window.innerWidth - width - padding;
        }

        // Vertical bounds - if no space above, show below
        if (top < padding) {
            top = rect.bottom + 12;
        }

        // If still out of bounds, just position at top
        if (top + height > window.innerHeight - padding) {
            top = padding;
        }

        tooltipElement.style.cssText = `
            position: fixed;
            left: ${left}px;
            top: ${top}px;
            z-index: 1000;
            pointer-events: none;
        `;

        // Draw skeleton
        if (pose.thumbnailKeypoints) {
            drawTooltipSkeleton(canvas, pose.thumbnailKeypoints, TOOLTIP_SCALE);
        }
    };
}

/**
 * Hide pose tooltip
 */
function hidePoseTooltip() {
    if (tooltipElement) {
        tooltipElement.remove();
        tooltipElement = null;
    }
}

/**
 * Draw skeleton on tooltip canvas from thumbnail keypoints
 */
function drawTooltipSkeleton(canvas, thumbnailKeypoints, scale) {
    const ctx = canvas.getContext('2d');

    // Scale keypoints to tooltip size
    const keypoints = {};
    for (const [name, kp] of Object.entries(thumbnailKeypoints)) {
        keypoints[name] = {
            x: kp.x * scale,
            y: kp.y * scale,
            score: kp.score
        };
    }

    // Draw connections
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

    for (const [startName, endName] of Keypoints.SKELETON) {
        const start = keypoints[startName];
        const end = keypoints[endName];

        if (start && end && start.score > 0.3 && end.score > 0.3) {
            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();
        }
    }

    // Draw keypoints
    for (const [name, kp] of Object.entries(keypoints)) {
        if (kp.score > 0.3 && Keypoints.isVisible(name)) {
            ctx.beginPath();
            ctx.arc(kp.x, kp.y, 5, 0, 2 * Math.PI);
            ctx.fillStyle = kp.score > 0.6 ? '#22c55e' : '#f59e0b';
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }
}

// Start the app
init();
