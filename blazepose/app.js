// ============================================
// BLAZEPOSE KEYPOINT DEFINITIONS (33 Keypoints)
// ============================================
const KEYPOINTS = {
    NOSE: 0,
    LEFT_EYE_INNER: 1,
    LEFT_EYE: 2,
    LEFT_EYE_OUTER: 3,
    RIGHT_EYE_INNER: 4,
    RIGHT_EYE: 5,
    RIGHT_EYE_OUTER: 6,
    LEFT_EAR: 7,
    RIGHT_EAR: 8,
    MOUTH_LEFT: 9,
    MOUTH_RIGHT: 10,
    LEFT_SHOULDER: 11,
    RIGHT_SHOULDER: 12,
    LEFT_ELBOW: 13,
    RIGHT_ELBOW: 14,
    LEFT_WRIST: 15,
    RIGHT_WRIST: 16,
    LEFT_PINKY: 17,
    RIGHT_PINKY: 18,
    LEFT_INDEX: 19,
    RIGHT_INDEX: 20,
    LEFT_THUMB: 21,
    RIGHT_THUMB: 22,
    LEFT_HIP: 23,
    RIGHT_HIP: 24,
    LEFT_KNEE: 25,
    RIGHT_KNEE: 26,
    LEFT_ANKLE: 27,
    RIGHT_ANKLE: 28,
    LEFT_HEEL: 29,
    RIGHT_HEEL: 30,
    LEFT_FOOT_INDEX: 31,
    RIGHT_FOOT_INDEX: 32
};

const SKELETON_CONNECTIONS = [
    // Face
    [KEYPOINTS.NOSE, KEYPOINTS.LEFT_EYE_INNER],
    [KEYPOINTS.LEFT_EYE_INNER, KEYPOINTS.LEFT_EYE],
    [KEYPOINTS.LEFT_EYE, KEYPOINTS.LEFT_EYE_OUTER],
    [KEYPOINTS.NOSE, KEYPOINTS.RIGHT_EYE_INNER],
    [KEYPOINTS.RIGHT_EYE_INNER, KEYPOINTS.RIGHT_EYE],
    [KEYPOINTS.RIGHT_EYE, KEYPOINTS.RIGHT_EYE_OUTER],
    // Torso
    [KEYPOINTS.LEFT_SHOULDER, KEYPOINTS.RIGHT_SHOULDER],
    [KEYPOINTS.LEFT_SHOULDER, KEYPOINTS.LEFT_HIP],
    [KEYPOINTS.RIGHT_SHOULDER, KEYPOINTS.RIGHT_HIP],
    [KEYPOINTS.LEFT_HIP, KEYPOINTS.RIGHT_HIP],
    // Left arm
    [KEYPOINTS.LEFT_SHOULDER, KEYPOINTS.LEFT_ELBOW],
    [KEYPOINTS.LEFT_ELBOW, KEYPOINTS.LEFT_WRIST],
    [KEYPOINTS.LEFT_WRIST, KEYPOINTS.LEFT_PINKY],
    [KEYPOINTS.LEFT_WRIST, KEYPOINTS.LEFT_INDEX],
    [KEYPOINTS.LEFT_WRIST, KEYPOINTS.LEFT_THUMB],
    [KEYPOINTS.LEFT_PINKY, KEYPOINTS.LEFT_INDEX],
    // Right arm
    [KEYPOINTS.RIGHT_SHOULDER, KEYPOINTS.RIGHT_ELBOW],
    [KEYPOINTS.RIGHT_ELBOW, KEYPOINTS.RIGHT_WRIST],
    [KEYPOINTS.RIGHT_WRIST, KEYPOINTS.RIGHT_PINKY],
    [KEYPOINTS.RIGHT_WRIST, KEYPOINTS.RIGHT_INDEX],
    [KEYPOINTS.RIGHT_WRIST, KEYPOINTS.RIGHT_THUMB],
    [KEYPOINTS.RIGHT_PINKY, KEYPOINTS.RIGHT_INDEX],
    // Left leg
    [KEYPOINTS.LEFT_HIP, KEYPOINTS.LEFT_KNEE],
    [KEYPOINTS.LEFT_KNEE, KEYPOINTS.LEFT_ANKLE],
    [KEYPOINTS.LEFT_ANKLE, KEYPOINTS.LEFT_HEEL],
    [KEYPOINTS.LEFT_ANKLE, KEYPOINTS.LEFT_FOOT_INDEX],
    [KEYPOINTS.LEFT_HEEL, KEYPOINTS.LEFT_FOOT_INDEX],
    // Right leg
    [KEYPOINTS.RIGHT_HIP, KEYPOINTS.RIGHT_KNEE],
    [KEYPOINTS.RIGHT_KNEE, KEYPOINTS.RIGHT_ANKLE],
    [KEYPOINTS.RIGHT_ANKLE, KEYPOINTS.RIGHT_HEEL],
    [KEYPOINTS.RIGHT_ANKLE, KEYPOINTS.RIGHT_FOOT_INDEX],
    [KEYPOINTS.RIGHT_HEEL, KEYPOINTS.RIGHT_FOOT_INDEX]
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
let keypointsDisplay;

let useFrontCamera = true; // Toggle für Kamera

// Debug Panel Elements
let debugPanel, debugBackend, debugVideo, debugCanvas, debugFps;
let debugPoses, debugKeypoints, debugPose, debugHead, debugFeet, debugVdiff, debugAngle;

// FPS Tracking
let lastFrameTime = 0;
let frameCount = 0;
let fps = 0;

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
    keypointsDisplay = document.getElementById('keypoints-display');

    // Debug Panel
    debugPanel = document.getElementById('debug-panel');
    debugBackend = document.getElementById('debug-backend');
    debugVideo = document.getElementById('debug-video');
    debugCanvas = document.getElementById('debug-canvas');
    debugFps = document.getElementById('debug-fps');
    debugPoses = document.getElementById('debug-poses');
    debugKeypoints = document.getElementById('debug-keypoints');
    debugPose = document.getElementById('debug-pose');
    debugHead = document.getElementById('debug-head');
    debugFeet = document.getElementById('debug-feet');
    debugVdiff = document.getElementById('debug-vdiff');
    debugAngle = document.getElementById('debug-angle');
}

async function init() {
    initDOMElements();

    // Reset button
    btnReset.addEventListener('click', resetApp);

    // Debug toggle
    const btnDebug = document.getElementById('btn-debug');
    const debugClose = document.getElementById('debug-close');
    btnDebug.addEventListener('click', () => debugPanel.classList.toggle('hidden'));
    debugClose.addEventListener('click', () => debugPanel.classList.add('hidden'));

    try {
        // Initialize TensorFlow backend
        loadingText.textContent = 'Initialisiere...';
        await tf.setBackend('webgl');
        await tf.ready();
        const backend = tf.getBackend();
        console.log('TensorFlow.js Backend:', backend);
        debugBackend.textContent = backend + ' + MediaPipe';

        // Setup camera
        loadingText.textContent = 'Starte Kamera...';

        let stream;
        const facingMode = useFrontCamera ? 'user' : 'environment';
        const videoConstraints = [
            { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode, aspectRatio: { ideal: 16/9 } },
            { width: { ideal: 640 }, height: { ideal: 480 }, facingMode, aspectRatio: { ideal: 4/3 } },
            { facingMode }
        ];

        for (const constraints of videoConstraints) {
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: constraints,
                    audio: false
                });
                console.log('Camera started with:', constraints);
                break;
            } catch (e) {
                console.log('Failed with constraints:', constraints, e.message);
            }
        }

        if (!stream) {
            throw new Error('Keine Kamera verfügbar');
        }

        video.srcObject = stream;

        await new Promise((resolve) => {
            video.onloadedmetadata = () => {
                console.log('Video dimensions:', video.videoWidth, 'x', video.videoHeight);
                resolve();
            };
        });

        await video.play();

        // Set canvas size to match video
        updateCanvasSize();
        window.addEventListener('resize', updateCanvasSize);

        console.log('Video ready:', video.videoWidth, 'x', video.videoHeight);

        // Load BlazePose with MediaPipe runtime
        loadingText.textContent = 'Lade BlazePose Full...';
        detector = await poseDetection.createDetector(
            poseDetection.SupportedModels.BlazePose,
            {
                runtime: 'mediapipe',
                modelType: 'full',  // 'lite', 'full', or 'heavy'
                solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/pose',
                enableSmoothing: true,
                enableSegmentation: false
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
    if (!detector || !video.videoWidth) return;

    // FPS calculation
    frameCount++;
    const now = performance.now();
    if (now - lastFrameTime >= 1000) {
        fps = frameCount;
        frameCount = 0;
        lastFrameTime = now;
        debugFps.textContent = fps;
    }

    const poses = await detector.estimatePoses(video);

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Update debug panel
    debugVideo.textContent = `${video.videoWidth}×${video.videoHeight}`;
    debugCanvas.textContent = `${canvas.width}×${canvas.height}`;
    debugPoses.textContent = poses.length;

    if (poses.length > 0) {
        const pose = poses[0];
        const keypoints = pose.keypoints;

        // Count only required keypoints for pose detection
        const requiredIndices = [
            KEYPOINTS.NOSE,
            KEYPOINTS.LEFT_SHOULDER, KEYPOINTS.RIGHT_SHOULDER,
            KEYPOINTS.LEFT_HIP, KEYPOINTS.RIGHT_HIP,
            KEYPOINTS.LEFT_ANKLE, KEYPOINTS.RIGHT_ANKLE
        ];
        const getScore = (kp) => kp && kp.score !== undefined ? kp.score : 0;
        const validRequired = requiredIndices.filter(i => getScore(keypoints[i]) > 0.1).length;
        keypointsDisplay.textContent = `${validRequired}/7`;

        // Debug: all keypoints
        const validKeypoints = keypoints.filter(kp => (kp.score !== undefined ? kp.score : 1) > 0.1).length;
        debugKeypoints.textContent = `${validKeypoints}/33`;

        // Debug: Log first pose data once
        if (!window._blazePoseLogged && keypoints.length > 0) {
            console.log('BlazePose keypoints sample:', keypoints.slice(0, 5));
            window._blazePoseLogged = true;
        }

        // Scale keypoints to canvas size
        const videoAspect = video.videoWidth / video.videoHeight;
        const canvasAspect = canvas.width / canvas.height;

        let scaleX, scaleY, offsetX = 0, offsetY = 0;

        if (canvasAspect > videoAspect) {
            scaleX = canvas.width / video.videoWidth;
            scaleY = scaleX;
            offsetY = (canvas.height - video.videoHeight * scaleY) / 2;
        } else {
            scaleY = canvas.height / video.videoHeight;
            scaleX = scaleY;
            offsetX = (canvas.width - video.videoWidth * scaleX) / 2;
        }

        const scaledKeypoints = keypoints.map(kp => ({
            ...kp,
            x: canvas.width - (kp.x * scaleX + offsetX), // Mirror X
            y: kp.y * scaleY + offsetY
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
        // BlazePose uses 'score' for confidence - use lower threshold
        const confidence = kp.score !== undefined ? kp.score : 1;
        if (confidence > 0.1) {
            ctx.beginPath();
            ctx.arc(kp.x, kp.y, 6, 0, 2 * Math.PI);
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
    ctx.lineWidth = 3;

    SKELETON_CONNECTIONS.forEach(([i, j]) => {
        const kp1 = keypoints[i];
        const kp2 = keypoints[j];

        if (!kp1 || !kp2) return;

        const score1 = kp1.score !== undefined ? kp1.score : 1;
        const score2 = kp2.score !== undefined ? kp2.score : 1;

        if (score1 > 0.1 && score2 > 0.1) {
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
            return '#10b981';
        case AppState.MEASURING:
            return '#f59e0b';
        case AppState.COMPLETED:
            return '#3b82f6';
        case AppState.TIMEOUT:
            return '#ef4444';
        default:
            return '#ffffff';
    }
}

// ============================================
// POSE ANALYSIS
// ============================================
function analyzePose(keypoints) {
    // BlazePose uses different indices
    const nose = keypoints[KEYPOINTS.NOSE];
    const leftShoulder = keypoints[KEYPOINTS.LEFT_SHOULDER];
    const rightShoulder = keypoints[KEYPOINTS.RIGHT_SHOULDER];
    const leftHip = keypoints[KEYPOINTS.LEFT_HIP];
    const rightHip = keypoints[KEYPOINTS.RIGHT_HIP];
    const leftAnkle = keypoints[KEYPOINTS.LEFT_ANKLE];
    const rightAnkle = keypoints[KEYPOINTS.RIGHT_ANKLE];

    // Check confidence - BlazePose may have different score format
    const minScore = 0.1;
    const getScore = (kp) => kp && kp.score !== undefined ? kp.score : 0;
    const hasRequiredPoints =
        getScore(nose) > minScore &&
        getScore(leftHip) > minScore && getScore(rightHip) > minScore &&
        getScore(leftAnkle) > minScore && getScore(rightAnkle) > minScore;

    if (!hasRequiredPoints) {
        currentPose = 'unknown';
        debugPose.textContent = 'unknown';
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

    // Update debug panel
    debugHead.textContent = Math.round(headY);
    debugFeet.textContent = Math.round(feetY);
    debugVdiff.textContent = Math.round(verticalDiff);
    debugAngle.textContent = torsoAngle.toFixed(1) + '°';

    // Determine pose - stricter standing detection
    const heightThreshold = canvas.height * 0.35; // 35% statt 25% für strengere Erkennung

    if (verticalDiff > heightThreshold && torsoAngle < 30) {
        // Aufrecht stehen: großer vertikaler Abstand UND Oberkörper fast senkrecht
        currentPose = 'standing';
    } else if (verticalDiff < heightThreshold * 0.25 && torsoAngle > 60) {
        // Liegen: kleiner vertikaler Abstand UND Oberkörper horizontal (streng!)
        currentPose = 'lying';
    } else {
        currentPose = 'transition';
    }

    debugPose.textContent = currentPose;

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
            if (currentPose !== 'lying') {
                timerStartTime = Date.now();
                setState(AppState.MEASURING);
            }
            break;

        case AppState.MEASURING:
            if (currentPose === 'standing') {
                lastMeasuredTime = (Date.now() - timerStartTime) / 1000;
                timerValue.textContent = lastMeasuredTime.toFixed(2);
                setState(AppState.COMPLETED);
            }
            // Wenn Person wieder liegt -> Reset und zurück zu LYING
            else if (currentPose === 'lying') {
                timerStartTime = null;
                lastMeasuredTime = 0;
                timerValue.textContent = '0.00';
                setState(AppState.LYING);
            }
            break;

        case AppState.COMPLETED:
        case AppState.TIMEOUT:
            // Auto-Reset wenn Person sich wieder hinlegt
            if (currentPose === 'lying') {
                timerStartTime = null;
                lastMeasuredTime = 0;
                timerValue.textContent = '0.00';
                setState(AppState.LYING);
            }
            break;
    }
}

// ============================================
// START APP
// ============================================
document.addEventListener('DOMContentLoaded', init);
