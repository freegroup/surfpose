// ============================================
// KEYPOINT DEFINITIONS
// ============================================
const KEYPOINTS = {
    NOSE: 0,
    LEFT_EYE: 1,
    RIGHT_EYE: 2,
    LEFT_EAR: 3,
    RIGHT_EAR: 4,
    LEFT_SHOULDER: 5,
    RIGHT_SHOULDER: 6,
    LEFT_ELBOW: 7,
    RIGHT_ELBOW: 8,
    LEFT_WRIST: 9,
    RIGHT_WRIST: 10,
    LEFT_HIP: 11,
    RIGHT_HIP: 12,
    LEFT_KNEE: 13,
    RIGHT_KNEE: 14,
    LEFT_ANKLE: 15,
    RIGHT_ANKLE: 16
};

const SKELETON_CONNECTIONS = [
    [KEYPOINTS.LEFT_SHOULDER, KEYPOINTS.RIGHT_SHOULDER],
    [KEYPOINTS.LEFT_SHOULDER, KEYPOINTS.LEFT_ELBOW],
    [KEYPOINTS.RIGHT_SHOULDER, KEYPOINTS.RIGHT_ELBOW],
    [KEYPOINTS.LEFT_ELBOW, KEYPOINTS.LEFT_WRIST],
    [KEYPOINTS.RIGHT_ELBOW, KEYPOINTS.RIGHT_WRIST],
    [KEYPOINTS.LEFT_SHOULDER, KEYPOINTS.LEFT_HIP],
    [KEYPOINTS.RIGHT_SHOULDER, KEYPOINTS.RIGHT_HIP],
    [KEYPOINTS.LEFT_HIP, KEYPOINTS.RIGHT_HIP],
    [KEYPOINTS.LEFT_HIP, KEYPOINTS.LEFT_KNEE],
    [KEYPOINTS.RIGHT_HIP, KEYPOINTS.RIGHT_KNEE],
    [KEYPOINTS.LEFT_KNEE, KEYPOINTS.LEFT_ANKLE],
    [KEYPOINTS.RIGHT_KNEE, KEYPOINTS.RIGHT_ANKLE]
];

// ============================================
// APP STATE
// ============================================
const AppState = {
    INITIALIZING: 'initializing',
    READY: 'ready',           // Warte auf Liegen
    LYING: 'lying',           // Person liegt - bereit zum Start
    MEASURING: 'measuring',   // Timer läuft
    COMPLETED: 'completed',   // Erfolgreich gestanden
    TIMEOUT: 'timeout'        // 20 Sekunden überschritten
};

let detector = null;
let currentState = AppState.INITIALIZING;
let currentPose = 'unknown';  // 'lying', 'standing', 'unknown'
let timerStartTime = null;
let lastMeasuredTime = 0;
let animationFrameId = null;

const MAX_TIME = 20; // Maximale Zeit in Sekunden

// DOM Elements
let video, canvas, ctx;
let frameBorder, timerContainer, timerValue, poseIndicator;
let statusBadge, statusIcon, statusText, instructionBadge;
let loadingOverlay, loadingText, btnReset;

// ============================================
// INITIALIZATION
// ============================================
function initDOMElements() {
    video = document.getElementById('video');
    canvas = document.getElementById('skeleton-canvas');
    ctx = canvas.getContext('2d');

    frameBorder = document.getElementById('frame-border');
    timerContainer = document.getElementById('timer-container');
    timerValue = document.getElementById('timer-value');
    poseIndicator = document.getElementById('pose-indicator');
    statusBadge = document.getElementById('status-badge');
    statusIcon = statusBadge.querySelector('.status-icon');
    statusText = document.getElementById('status-text');
    instructionBadge = document.getElementById('instruction-badge');
    loadingOverlay = document.getElementById('loading-overlay');
    loadingText = document.getElementById('loading-text');
    btnReset = document.getElementById('btn-reset');
}

async function init() {
    initDOMElements();

    // Reset button
    btnReset.addEventListener('click', resetApp);

    try {
        // Initialize TensorFlow
        loadingText.textContent = 'Initialisiere TensorFlow.js...';
        await tf.ready();
        console.log('TensorFlow.js Backend:', tf.getBackend());

        // Setup camera
        loadingText.textContent = 'Starte Kamera...';
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'user'
            },
            audio: false
        });

        video.srcObject = stream;
        await video.play();

        // Set canvas size to match video
        updateCanvasSize();
        window.addEventListener('resize', updateCanvasSize);

        // Load MoveNet
        loadingText.textContent = 'Lade MoveNet Model...';
        detector = await poseDetection.createDetector(
            poseDetection.SupportedModels.MoveNet,
            {
                modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
                enableSmoothing: true
            }
        );

        // Hide loading, start detection
        loadingOverlay.classList.add('hidden');
        setState(AppState.READY);
        detectPose();

    } catch (error) {
        console.error('Initialization error:', error);
        loadingText.textContent = 'Fehler: ' + error.message;
    }
}

function updateCanvasSize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

// ============================================
// STATE MANAGEMENT
// ============================================
function setState(newState) {
    currentState = newState;

    // Reset classes
    frameBorder.className = '';
    timerContainer.className = 'timer-container';
    statusBadge.className = 'status-badge';
    poseIndicator.className = 'pose-indicator';

    switch (newState) {
        case AppState.READY:
            statusIcon.textContent = '👀';
            statusText.textContent = 'Warte auf Position';
            instructionBadge.textContent = '🏊 Leg dich in die Paddling-Position (auf den Bauch)';
            poseIndicator.textContent = 'Warte auf Liegen...';
            timerValue.textContent = '0.00';
            break;

        case AppState.LYING:
            frameBorder.classList.add('ready');
            statusBadge.classList.add('ready');
            poseIndicator.classList.add('lying');
            statusIcon.textContent = '✅';
            statusText.textContent = 'Bereit';
            instructionBadge.textContent = '🚀 Spring auf! Timer startet automatisch';
            poseIndicator.textContent = '🏊 Paddling Position - Bereit!';
            timerValue.textContent = '0.00';
            break;

        case AppState.MEASURING:
            frameBorder.classList.add('active');
            timerContainer.classList.add('active');
            statusBadge.classList.add('active');
            statusIcon.textContent = '⏱️';
            statusText.textContent = 'Messung läuft';
            instructionBadge.textContent = '🏄 Spring in die Surf Stance!';
            poseIndicator.textContent = '⏱️ Messe...';
            break;

        case AppState.COMPLETED:
            frameBorder.classList.add('standing');
            timerContainer.classList.add('success');
            statusBadge.classList.add('done');
            poseIndicator.classList.add('standing');
            statusIcon.textContent = '🎉';
            statusText.textContent = 'Fertig!';
            instructionBadge.textContent = `✅ Pop-Up Zeit: ${lastMeasuredTime.toFixed(2)}s - Drücke Reset für neue Messung`;
            poseIndicator.textContent = '🏄 Surf Stance erreicht!';
            break;

        case AppState.TIMEOUT:
            frameBorder.classList.add('timeout');
            timerContainer.classList.add('timeout');
            statusIcon.textContent = '⏰';
            statusText.textContent = 'Zeit abgelaufen';
            instructionBadge.textContent = '⏰ 20 Sekunden überschritten - Drücke Reset';
            poseIndicator.textContent = '❌ Timeout';
            timerValue.textContent = '20.00';
            break;
    }
}

function resetApp() {
    timerStartTime = null;
    lastMeasuredTime = 0;
    timerValue.textContent = '0.00';
    setState(AppState.READY);
}

// ============================================
// POSE DETECTION
// ============================================
async function detectPose() {
    if (!detector) return;

    const poses = await detector.estimatePoses(video);

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (poses.length > 0) {
        const pose = poses[0];
        const keypoints = pose.keypoints;

        // Scale keypoints to canvas size
        const scaleX = canvas.width / video.videoWidth;
        const scaleY = canvas.height / video.videoHeight;

        const scaledKeypoints = keypoints.map(kp => ({
            ...kp,
            x: canvas.width - (kp.x * scaleX), // Mirror X
            y: kp.y * scaleY
        }));

        // Draw skeleton
        drawSkeleton(scaledKeypoints);
        drawKeypoints(scaledKeypoints);

        // Analyze pose
        analyzePose(scaledKeypoints);
    }

    // Update timer if measuring
    if (currentState === AppState.MEASURING && timerStartTime) {
        const elapsed = (Date.now() - timerStartTime) / 1000;

        if (elapsed >= MAX_TIME) {
            lastMeasuredTime = MAX_TIME;
            timerValue.textContent = MAX_TIME.toFixed(2);
            setState(AppState.TIMEOUT);
        } else {
            timerValue.textContent = elapsed.toFixed(2);
        }
    }

    animationFrameId = requestAnimationFrame(detectPose);
}

function drawKeypoints(keypoints) {
    const color = getSkeletonColor();

    keypoints.forEach((kp) => {
        if (kp.score > 0.3) {
            ctx.beginPath();
            ctx.arc(kp.x, kp.y, 8, 0, 2 * Math.PI);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    });
}

function drawSkeleton(keypoints) {
    const color = getSkeletonColor();
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;

    SKELETON_CONNECTIONS.forEach(([i, j]) => {
        const kp1 = keypoints[i];
        const kp2 = keypoints[j];

        if (kp1.score > 0.3 && kp2.score > 0.3) {
            ctx.beginPath();
            ctx.moveTo(kp1.x, kp1.y);
            ctx.lineTo(kp2.x, kp2.y);
            ctx.stroke();
        }
    });
}

function getSkeletonColor() {
    switch (currentState) {
        case AppState.LYING:
            return '#10b981'; // Grün
        case AppState.MEASURING:
            return '#f59e0b'; // Gelb/Orange
        case AppState.COMPLETED:
            return '#3b82f6'; // Blau
        case AppState.TIMEOUT:
            return '#ef4444'; // Rot
        default:
            return '#ffffff'; // Weiß
    }
}

// ============================================
// POSE ANALYSIS
// ============================================
function analyzePose(keypoints) {
    const nose = keypoints[KEYPOINTS.NOSE];
    const leftShoulder = keypoints[KEYPOINTS.LEFT_SHOULDER];
    const rightShoulder = keypoints[KEYPOINTS.RIGHT_SHOULDER];
    const leftHip = keypoints[KEYPOINTS.LEFT_HIP];
    const rightHip = keypoints[KEYPOINTS.RIGHT_HIP];
    const leftAnkle = keypoints[KEYPOINTS.LEFT_ANKLE];
    const rightAnkle = keypoints[KEYPOINTS.RIGHT_ANKLE];

    // Check confidence
    const minScore = 0.3;
    const hasRequiredPoints =
        nose.score > minScore &&
        leftHip.score > minScore && rightHip.score > minScore &&
        leftAnkle.score > minScore && rightAnkle.score > minScore;

    if (!hasRequiredPoints) {
        currentPose = 'unknown';
        return;
    }

    // Calculate positions
    const headY = nose.y;
    const hipY = (leftHip.y + rightHip.y) / 2;
    const feetY = (leftAnkle.y + rightAnkle.y) / 2;
    const verticalDiff = feetY - headY;

    // Calculate torso angle
    const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
    const shoulderX = (leftShoulder.x + rightShoulder.x) / 2;
    const hipX = (leftHip.x + rightHip.x) / 2;
    const torsoAngle = Math.atan2(Math.abs(hipX - shoulderX), Math.abs(hipY - shoulderY)) * (180 / Math.PI);

    // Determine pose
    const heightThreshold = canvas.height * 0.25; // 25% of screen height

    if (verticalDiff > heightThreshold && torsoAngle < 45) {
        currentPose = 'standing';
    } else if (verticalDiff < heightThreshold * 0.4 || torsoAngle > 55) {
        currentPose = 'lying';
    } else {
        currentPose = 'transition';
    }

    // State machine logic
    handleStateTransition();
}

function handleStateTransition() {
    switch (currentState) {
        case AppState.READY:
            if (currentPose === 'lying') {
                setState(AppState.LYING);
            }
            break;

        case AppState.LYING:
            // Wenn Person nicht mehr liegt -> Messung starten
            if (currentPose !== 'lying') {
                timerStartTime = Date.now();
                setState(AppState.MEASURING);
            }
            break;

        case AppState.MEASURING:
            // Wenn Person steht -> Fertig
            if (currentPose === 'standing') {
                lastMeasuredTime = (Date.now() - timerStartTime) / 1000;
                timerValue.textContent = lastMeasuredTime.toFixed(2);
                setState(AppState.COMPLETED);
            }
            break;

        case AppState.COMPLETED:
        case AppState.TIMEOUT:
            // Warte auf Reset
            break;
    }
}

// ============================================
// START APP
// ============================================
document.addEventListener('DOMContentLoaded', init);
