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
    [KEYPOINTS.LEFT_SHOULDER, KEYPOINTS.LEFT_HIP],
    [KEYPOINTS.RIGHT_SHOULDER, KEYPOINTS.RIGHT_HIP],
    [KEYPOINTS.LEFT_HIP, KEYPOINTS.RIGHT_HIP],
    [KEYPOINTS.LEFT_HIP, KEYPOINTS.LEFT_ANKLE],
    [KEYPOINTS.RIGHT_HIP, KEYPOINTS.RIGHT_ANKLE]
];

const RELEVANT_KEYPOINTS = [
    KEYPOINTS.LEFT_SHOULDER,
    KEYPOINTS.RIGHT_SHOULDER,
    KEYPOINTS.LEFT_HIP,
    KEYPOINTS.RIGHT_HIP,
    KEYPOINTS.LEFT_ANKLE,
    KEYPOINTS.RIGHT_ANKLE
];

// ============================================
// APP STATE
// ============================================
const AppState = {
    INITIALIZING: 'initializing',
    READY: 'ready',
    LYING: 'lying',
    MEASURING: 'measuring',
    COMPLETED: 'completed',
    TIMEOUT: 'timeout'
};

let detector = null;
let currentState = AppState.INITIALIZING;
let currentPose = 'unknown';
let timerStartTime = null;
let lastMeasuredTime = 0;
let animationFrameId = null;

const MAX_TIME = 20;

// Stats
let bestTime = null;
let repsCount = 0;

// DOM Elements
let video, canvas, ctx;
let videoContainer;
let timerOverlay, timerValue;
let bestTimeEl, repsCountEl;
let celebration;
let loadingOverlay, loadingText;
let statusDot;

// Debug Elements
let debugPanel, debugBackend, debugVideo, debugFps;
let debugKeypoints, debugPose, debugVdiff, debugAngle;

// FPS Tracking
let lastFrameTime = 0;
let frameCount = 0;
let fps = 0;

// Keypoint Smoother - One Euro Filter für adaptive Glättung
let smoother = null;

// ============================================
// INITIALIZATION
// ============================================
function initDOMElements() {
    video = document.getElementById('video');
    canvas = document.getElementById('skeleton-canvas');
    ctx = canvas.getContext('2d');
    videoContainer = document.querySelector('.video-container');

    timerOverlay = document.getElementById('timer-overlay');
    timerValue = document.getElementById('timer-value');
    bestTimeEl = document.getElementById('best-time');
    repsCountEl = document.getElementById('reps-count');
    celebration = document.getElementById('celebration');
    loadingOverlay = document.getElementById('loading-overlay');
    loadingText = document.getElementById('loading-text');
    statusDot = document.getElementById('status-dot');

    // Debug Panel
    debugPanel = document.getElementById('debug-panel');
    debugBackend = document.getElementById('debug-backend');
    debugVideo = document.getElementById('debug-video');
    debugFps = document.getElementById('debug-fps');
    debugKeypoints = document.getElementById('debug-keypoints');
    debugPose = document.getElementById('debug-pose');
    debugVdiff = document.getElementById('debug-vdiff');
    debugAngle = document.getElementById('debug-angle');
}

async function init() {
    initDOMElements();

    // Initialize smoother
    smoother = new OneEuroKeypointSmoother({
        minCutoff: 1.0,  // Mehr Glättung bei langsamen Bewegungen
        beta: 0.007,     // Weniger Glättung bei schnellen Bewegungen
        minScore: 0.2
    });

    // Load saved best time from localStorage
    const savedBest = localStorage.getItem('surfpop-best-time');
    if (savedBest) {
        bestTime = parseFloat(savedBest);
        bestTimeEl.textContent = bestTime.toFixed(2) + 's';
    }

    // Debug toggle
    const btnDebug = document.getElementById('btn-debug');
    const debugClose = document.getElementById('debug-close');
    btnDebug.addEventListener('click', () => debugPanel.classList.toggle('hidden'));
    debugClose.addEventListener('click', () => debugPanel.classList.add('hidden'));

    try {
        loadingText.textContent = 'Initialisiere TensorFlow.js...';
        await tf.setBackend('webgl');
        await tf.ready();
        debugBackend.textContent = tf.getBackend();

        loadingText.textContent = 'Starte Kamera...';

        const videoConstraints = [
            { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
            { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
            { facingMode: 'user' }
        ];

        let stream;
        for (const constraints of videoConstraints) {
            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: constraints, audio: false });
                break;
            } catch (e) {
                console.log('Failed with constraints:', constraints);
            }
        }

        if (!stream) throw new Error('Keine Kamera verfügbar');

        video.srcObject = stream;
        await new Promise(resolve => video.onloadedmetadata = resolve);
        await video.play();

        updateCanvasSize();
        window.addEventListener('resize', updateCanvasSize);

        loadingText.textContent = 'Lade MoveNet Lightning...';
        detector = await poseDetection.createDetector(
            poseDetection.SupportedModels.MoveNet,
            {
                modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
                enableSmoothing: true,
                minPoseScore: 0.2
            }
        );

        loadingOverlay.classList.add('hidden');
        setState(AppState.READY);
        detectPose();

    } catch (error) {
        console.error('Initialization error:', error);
        loadingText.textContent = 'Fehler: ' + error.message;
    }
}

function updateCanvasSize() {
    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
}

// ============================================
// STATE MANAGEMENT
// ============================================
function setState(newState) {
    currentState = newState;

    // Update timer overlay classes
    timerOverlay.className = 'timer-overlay';

    // Update video container border
    videoContainer.className = 'video-container';

    // Update status dot color
    statusDot.style.background = getStateColor();

    switch (newState) {
        case AppState.READY:
            timerValue.textContent = '0.00';
            break;

        case AppState.LYING:
            timerValue.textContent = '0.00';
            videoContainer.classList.add('state-lying');
            break;

        case AppState.MEASURING:
            timerOverlay.classList.add('counting');
            videoContainer.classList.add('state-measuring');
            break;

        case AppState.COMPLETED:
            timerOverlay.classList.add('stopped');
            videoContainer.classList.add('state-completed');
            repsCount++;
            repsCountEl.textContent = repsCount;

            // Check for new best time
            if (bestTime === null || lastMeasuredTime < bestTime) {
                bestTime = lastMeasuredTime;
                bestTimeEl.textContent = bestTime.toFixed(2) + 's';
                localStorage.setItem('surfpop-best-time', bestTime.toString());
                showCelebration();
            }
            break;

        case AppState.TIMEOUT:
            timerValue.textContent = '20.00';
            videoContainer.classList.add('state-timeout');
            break;
    }
}

function getStateColor() {
    switch (currentState) {
        case AppState.LYING: return '#10b981';
        case AppState.MEASURING: return '#f59e0b';
        case AppState.COMPLETED: return '#2dd4bf';
        case AppState.TIMEOUT: return '#ef4444';
        default: return '#2dd4bf';
    }
}

function showCelebration() {
    celebration.classList.remove('hidden');
    setTimeout(() => {
        celebration.classList.add('hidden');
    }, 2000);
}

function resetApp() {
    timerStartTime = null;
    lastMeasuredTime = 0;
    timerValue.textContent = '0.00';
    celebration.classList.add('hidden');
    if (smoother) smoother.reset();
    setState(AppState.READY);
}

// ============================================
// POSE DETECTION
// ============================================
async function detectPose() {
    if (!detector || !video.videoWidth) return;

    frameCount++;
    const now = performance.now();
    if (now - lastFrameTime >= 1000) {
        fps = frameCount;
        frameCount = 0;
        lastFrameTime = now;
        debugFps.textContent = fps;
    }

    const poses = await detector.estimatePoses(video);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    debugVideo.textContent = `${video.videoWidth}×${video.videoHeight}`;

    if (poses.length > 0) {
        const pose = poses[0];
        const keypoints = pose.keypoints;

        const validKeypoints = keypoints.filter(kp => kp.score > 0.2).length;
        debugKeypoints.textContent = `${validKeypoints}/17`;

        // Scale keypoints
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
            x: canvas.width - (kp.x * scaleX + offsetX),
            y: kp.y * scaleY + offsetY
        }));

        // Geglättete Keypoints nur für die Anzeige
        const smoothedKeypoints = smoother ? smoother.smooth(scaledKeypoints) : scaledKeypoints;

        drawSkeleton(smoothedKeypoints);
        drawKeypoints(smoothedKeypoints);

        // Analyse mit echten (nicht geglätteten) Keypoints für schnelle Reaktion
        analyzePose(scaledKeypoints);
    }

    // Update timer
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

    RELEVANT_KEYPOINTS.forEach((index) => {
        const kp = keypoints[index];
        if (kp.score > 0.2) {
            ctx.beginPath();
            ctx.arc(kp.x, kp.y, 8, 0, 2 * Math.PI);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    });

    // Head center
    const headCenter = getHeadCenter(keypoints);
    if (headCenter && headCenter.score > 0.2) {
        ctx.beginPath();
        ctx.arc(headCenter.x, headCenter.y, 8, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

function drawSkeleton(keypoints) {
    const color = getSkeletonColor();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;

    SKELETON_CONNECTIONS.forEach(([i, j]) => {
        const kp1 = keypoints[i];
        const kp2 = keypoints[j];

        if (kp1.score > 0.2 && kp2.score > 0.2) {
            ctx.beginPath();
            ctx.moveTo(kp1.x, kp1.y);
            ctx.lineTo(kp2.x, kp2.y);
            ctx.stroke();
        }
    });

    // Head to shoulder connection
    const headCenter = getHeadCenter(keypoints);
    const leftShoulder = keypoints[KEYPOINTS.LEFT_SHOULDER];
    const rightShoulder = keypoints[KEYPOINTS.RIGHT_SHOULDER];

    if (headCenter && leftShoulder.score > 0.2 && rightShoulder.score > 0.2) {
        const shoulderCenterX = (leftShoulder.x + rightShoulder.x) / 2;
        const shoulderCenterY = (leftShoulder.y + rightShoulder.y) / 2;
        ctx.beginPath();
        ctx.moveTo(headCenter.x, headCenter.y);
        ctx.lineTo(shoulderCenterX, shoulderCenterY);
        ctx.stroke();
    }
}

function getSkeletonColor() {
    switch (currentState) {
        case AppState.LYING: return '#2dd4bf';
        case AppState.MEASURING: return '#f59e0b';
        case AppState.COMPLETED: return '#2dd4bf';
        case AppState.TIMEOUT: return '#ef4444';
        default: return '#2dd4bf';
    }
}

// ============================================
// POSE ANALYSIS
// ============================================
function getHeadCenter(keypoints) {
    const nose = keypoints[KEYPOINTS.NOSE];
    const leftEar = keypoints[KEYPOINTS.LEFT_EAR];
    const rightEar = keypoints[KEYPOINTS.RIGHT_EAR];
    const minScore = 0.2;

    const validPoints = [];
    if (nose.score > minScore) validPoints.push(nose);
    if (leftEar.score > minScore) validPoints.push(leftEar);
    if (rightEar.score > minScore) validPoints.push(rightEar);

    if (validPoints.length === 0) return null;

    const avgX = validPoints.reduce((sum, p) => sum + p.x, 0) / validPoints.length;
    const avgY = validPoints.reduce((sum, p) => sum + p.y, 0) / validPoints.length;
    const avgScore = validPoints.reduce((sum, p) => sum + p.score, 0) / validPoints.length;

    return { x: avgX, y: avgY, score: avgScore };
}

function analyzePose(keypoints) {
    const leftShoulder = keypoints[KEYPOINTS.LEFT_SHOULDER];
    const rightShoulder = keypoints[KEYPOINTS.RIGHT_SHOULDER];
    const leftHip = keypoints[KEYPOINTS.LEFT_HIP];
    const rightHip = keypoints[KEYPOINTS.RIGHT_HIP];
    const leftAnkle = keypoints[KEYPOINTS.LEFT_ANKLE];
    const rightAnkle = keypoints[KEYPOINTS.RIGHT_ANKLE];

    const headCenter = getHeadCenter(keypoints);

    const minScore = 0.2;
    const hasRequiredPoints =
        headCenter && headCenter.score > minScore &&
        leftHip.score > minScore && rightHip.score > minScore &&
        leftAnkle.score > minScore && rightAnkle.score > minScore;

    if (!hasRequiredPoints) {
        currentPose = 'unknown';
        debugPose.textContent = 'unknown';
        return;
    }

    const headY = headCenter.y;
    const hipY = (leftHip.y + rightHip.y) / 2;
    const feetY = (leftAnkle.y + rightAnkle.y) / 2;
    const verticalDiff = feetY - headY;

    const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
    const shoulderX = (leftShoulder.x + rightShoulder.x) / 2;
    const hipX = (leftHip.x + rightHip.x) / 2;
    const torsoAngle = Math.atan2(Math.abs(hipX - shoulderX), Math.abs(hipY - shoulderY)) * (180 / Math.PI);

    debugVdiff.textContent = Math.round(verticalDiff);
    debugAngle.textContent = torsoAngle.toFixed(1) + '°';

    const heightThreshold = canvas.height * 0.35;

    if (verticalDiff > heightThreshold && torsoAngle < 30) {
        currentPose = 'standing';
    } else if (verticalDiff < heightThreshold * 0.25 && torsoAngle > 60) {
        currentPose = 'lying';
    } else {
        currentPose = 'transition';
    }

    debugPose.textContent = currentPose;
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
            } else if (currentPose === 'lying') {
                timerStartTime = null;
                lastMeasuredTime = 0;
                timerValue.textContent = '0.00';
                setState(AppState.LYING);
            }
            break;

        case AppState.COMPLETED:
        case AppState.TIMEOUT:
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
