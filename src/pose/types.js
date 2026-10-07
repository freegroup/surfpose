// Shared data shapes (JSDoc only – this file exports nothing at runtime).

/**
 * Image landmark: x/y normalized to the (unmirrored) video frame, 0..1.
 * @typedef {{ x: number, y: number, z: number, visibility: number }} ImageLandmark
 */

/**
 * World landmark: meters, origin between the hips, y pointing down.
 * @typedef {{ x: number, y: number, z: number }} Vec3
 */

/**
 * One analyzed video frame.
 * @typedef {object} PoseFrame
 * @property {number} t           frame timestamp in ms
 * @property {number} width       video frame width in px (for aspect correction)
 * @property {number} height      video frame height in px
 * @property {ImageLandmark[]} image  33 landmarks, BlazePose topology (see landmarks.js)
 * @property {Vec3[]} world       33 landmarks in meters
 */

/**
 * Exchangeable pose model. Exactly one implementation is used in operation.
 * @typedef {object} PoseSource
 * @property {() => Promise<void>} init
 * @property {(image: ImageBitmap, t: number) => PoseFrame | null} detect
 * @property {() => void} dispose
 */

export {};
