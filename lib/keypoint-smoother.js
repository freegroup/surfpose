/**
 * Keypoint Smoothing Module
 * Dämpft Keypoint-Positionen um Rauschen zu reduzieren
 */

class KeypointSmoother {
    constructor(options = {}) {
        // Anzahl der Frames für den Moving Average
        this.windowSize = options.windowSize || 5;
        // History für jeden Keypoint
        this.history = new Map();
        // Minimum Score um Keypoint zu berücksichtigen
        this.minScore = options.minScore || 0.1;
    }

    /**
     * Glättet die Keypoints mit einem Moving Average Filter
     * @param {Array} keypoints - Array von Keypoint-Objekten mit x, y, score
     * @returns {Array} - Geglättete Keypoints
     */
    smooth(keypoints) {
        if (!keypoints || keypoints.length === 0) return keypoints;

        return keypoints.map((kp, index) => {
            if (!kp) return kp;

            const score = kp.score !== undefined ? kp.score : 1;

            // Niedrige Confidence -> nicht glätten
            if (score < this.minScore) {
                return kp;
            }

            // History für diesen Keypoint holen oder erstellen
            if (!this.history.has(index)) {
                this.history.set(index, []);
            }
            const hist = this.history.get(index);

            // Neuen Punkt zur History hinzufügen
            hist.push({ x: kp.x, y: kp.y, score });

            // History auf windowSize begrenzen
            while (hist.length > this.windowSize) {
                hist.shift();
            }

            // Gewichteter Durchschnitt basierend auf Score
            let totalWeight = 0;
            let sumX = 0;
            let sumY = 0;

            for (const point of hist) {
                const weight = point.score;
                sumX += point.x * weight;
                sumY += point.y * weight;
                totalWeight += weight;
            }

            if (totalWeight === 0) return kp;

            return {
                ...kp,
                x: sumX / totalWeight,
                y: sumY / totalWeight
            };
        });
    }

    /**
     * Setzt die History zurück
     */
    reset() {
        this.history.clear();
    }
}

/**
 * Exponential Moving Average Smoother
 * Reagiert schneller auf Änderungen als der einfache Moving Average
 */
class EMAKeypointSmoother {
    constructor(options = {}) {
        // Alpha-Wert für EMA (0-1, höher = weniger Glättung)
        this.alpha = options.alpha || 0.4;
        // Vorherige geglättete Werte
        this.previous = new Map();
        this.minScore = options.minScore || 0.1;
    }

    smooth(keypoints) {
        if (!keypoints || keypoints.length === 0) return keypoints;

        return keypoints.map((kp, index) => {
            if (!kp) return kp;

            const score = kp.score !== undefined ? kp.score : 1;

            if (score < this.minScore) {
                // Niedrige Confidence -> vorherigen Wert beibehalten falls vorhanden
                const prev = this.previous.get(index);
                if (prev) {
                    return { ...kp, x: prev.x, y: prev.y };
                }
                return kp;
            }

            const prev = this.previous.get(index);

            if (!prev) {
                // Erster Frame
                this.previous.set(index, { x: kp.x, y: kp.y });
                return kp;
            }

            // EMA Berechnung
            const smoothedX = this.alpha * kp.x + (1 - this.alpha) * prev.x;
            const smoothedY = this.alpha * kp.y + (1 - this.alpha) * prev.y;

            this.previous.set(index, { x: smoothedX, y: smoothedY });

            return {
                ...kp,
                x: smoothedX,
                y: smoothedY
            };
        });
    }

    reset() {
        this.previous.clear();
    }
}

/**
 * One Euro Filter - Adaptive Glättung
 * Bessere Balance zwischen Glättung und Reaktionszeit
 */
class OneEuroKeypointSmoother {
    constructor(options = {}) {
        // Minimale Cutoff-Frequenz (niedrig = mehr Glättung bei langsamen Bewegungen)
        this.minCutoff = options.minCutoff || 1.0;
        // Cutoff-Steigung (höher = weniger Glättung bei schnellen Bewegungen)
        this.beta = options.beta || 0.007;
        // Derivative Cutoff
        this.dCutoff = options.dCutoff || 1.0;

        this.filters = new Map();
        this.minScore = options.minScore || 0.1;
        this.lastTime = null;
    }

    smooth(keypoints) {
        if (!keypoints || keypoints.length === 0) return keypoints;

        const now = performance.now() / 1000; // in Sekunden
        const dt = this.lastTime ? now - this.lastTime : 1/60;
        this.lastTime = now;

        return keypoints.map((kp, index) => {
            if (!kp) return kp;

            const score = kp.score !== undefined ? kp.score : 1;

            if (score < this.minScore) {
                return kp;
            }

            if (!this.filters.has(index)) {
                this.filters.set(index, {
                    x: new LowPassFilter(this.alpha(this.minCutoff, dt), kp.x),
                    y: new LowPassFilter(this.alpha(this.minCutoff, dt), kp.y),
                    dx: new LowPassFilter(this.alpha(this.dCutoff, dt), 0),
                    dy: new LowPassFilter(this.alpha(this.dCutoff, dt), 0)
                });
                return kp;
            }

            const filter = this.filters.get(index);

            // Geschwindigkeit berechnen
            const dx = (kp.x - filter.x.lastRaw) / dt;
            const dy = (kp.y - filter.y.lastRaw) / dt;

            // Geschwindigkeit filtern
            const edx = filter.dx.filter(dx, this.alpha(this.dCutoff, dt));
            const edy = filter.dy.filter(dy, this.alpha(this.dCutoff, dt));

            // Adaptive Cutoff-Frequenz
            const cutoffX = this.minCutoff + this.beta * Math.abs(edx);
            const cutoffY = this.minCutoff + this.beta * Math.abs(edy);

            // Position filtern
            const smoothedX = filter.x.filter(kp.x, this.alpha(cutoffX, dt));
            const smoothedY = filter.y.filter(kp.y, this.alpha(cutoffY, dt));

            return {
                ...kp,
                x: smoothedX,
                y: smoothedY
            };
        });
    }

    alpha(cutoff, dt) {
        const tau = 1.0 / (2 * Math.PI * cutoff);
        return 1.0 / (1.0 + tau / dt);
    }

    reset() {
        this.filters.clear();
        this.lastTime = null;
    }
}

/**
 * Einfacher Low-Pass Filter für One Euro Filter
 */
class LowPassFilter {
    constructor(alpha, initVal = 0) {
        this.lastRaw = initVal;
        this.lastFiltered = initVal;
        this.alpha = alpha;
    }

    filter(value, alpha = this.alpha) {
        this.lastRaw = value;
        this.lastFiltered = alpha * value + (1 - alpha) * this.lastFiltered;
        return this.lastFiltered;
    }
}

// Export für Browser
if (typeof window !== 'undefined') {
    window.KeypointSmoother = KeypointSmoother;
    window.EMAKeypointSmoother = EMAKeypointSmoother;
    window.OneEuroKeypointSmoother = OneEuroKeypointSmoother;
}
