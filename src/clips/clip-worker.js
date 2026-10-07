// Clip worker: encodes every camera frame (with logo/badge burned in) into a ring buffer and,
// on a stand, cuts [stand − pre, stand + post] out of it as an MP4. Protocol:
//   in:  init { width, height, mirror } | frame { frame: VideoFrame, t } | overlay { logo?, badge? }
//        | trigger { standT } | finish
//   out: ready { supported } | clip { mp4, thumbnail, startT, standOffset, duration } | error { message }
import { BufferTarget, EncodedPacket, EncodedVideoPacketSource, Mp4OutputFormat, Output } from 'mediabunny';
import { CLIPS } from '../config.js';

// H.264 baseline/main/high – plays everywhere and is accepted by the share targets
const CODECS = ['avc1.42001f', 'avc1.4d001f', 'avc1.640028'];
const THUMB_WIDTH = 320;

/** @type {VideoEncoder | null} */
let encoder = null;
/** @type {OffscreenCanvas} */
let canvas;
/** @type {OffscreenCanvasRenderingContext2D} */
let ctx;
let mirror = true;
/** @type {VideoDecoderConfig | undefined} */
let decoderConfig;
/** @type {ImageBitmap | null} */
let logo = null;
/** @type {ImageBitmap | null} */
let badge = null;
let lastKeyT = -Infinity;

/** @type {EncodedVideoChunk[]} */
let ring = [];
/**
 * @type {{ standUs: number, endUs: number, chunks: EncodedVideoChunk[], thumbnail: Promise<Blob> | null } | null}
 */
let capture = null;

/** @param {{ width: number, height: number }} size */
async function init({ width, height }) {
  for (const codec of CODECS) {
    /** @type {VideoEncoderConfig} */
    const config = {
      codec, width, height,
      bitrate: CLIPS.bitrate,
      framerate: CLIPS.fps,
      latencyMode: 'realtime',
      avc: { format: 'avc' },
    };
    if (!(await VideoEncoder.isConfigSupported(config)).supported) continue;

    canvas = new OffscreenCanvas(width, height);
    ctx = /** @type {OffscreenCanvasRenderingContext2D} */ (canvas.getContext('2d'));
    encoder = new VideoEncoder({
      output: onChunk,
      error: (error) => self.postMessage({ type: 'error', message: String(error) }),
    });
    encoder.configure(config);
    return true;
  }
  return false;
}

/** @param {VideoFrame} frame @param {number} t ms */
function encodeFrame(frame, t) {
  if (!encoder || encoder.encodeQueueSize > 2) {
    frame.close(); // encoder busy – drop instead of queueing
    return;
  }
  const { width, height } = canvas;
  ctx.save();
  if (mirror) {
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(frame, 0, 0, width, height);
  ctx.restore();
  frame.close();

  const margin = Math.round(height * 0.04);
  if (logo) ctx.drawImage(logo, margin, margin);
  if (badge) ctx.drawImage(badge, (width - badge.width) / 2, height - badge.height - margin);

  if (capture && !capture.thumbnail && t * 1000 >= capture.standUs) capture.thumbnail = thumbnail();

  const composed = new VideoFrame(canvas, { timestamp: Math.round(t * 1000), duration: Math.round(1e6 / CLIPS.fps) });
  const keyFrame = t - lastKeyT >= CLIPS.keyFrameIntervalMs;
  if (keyFrame) lastKeyT = t;
  encoder.encode(composed, { keyFrame });
  composed.close();
}

function thumbnail() {
  const thumb = new OffscreenCanvas(THUMB_WIDTH, Math.round((THUMB_WIDTH * canvas.height) / canvas.width));
  /** @type {OffscreenCanvasRenderingContext2D} */ (thumb.getContext('2d')).drawImage(canvas, 0, 0, thumb.width, thumb.height);
  return thumb.convertToBlob({ type: 'image/jpeg', quality: 0.75 });
}

/** @param {EncodedVideoChunk} chunk @param {EncodedVideoChunkMetadata} [meta] */
function onChunk(chunk, meta) {
  if (meta?.decoderConfig) decoderConfig = meta.decoderConfig;

  ring.push(chunk);
  const cutoff = chunk.timestamp - (CLIPS.preMs + 2000) * 1000;
  while (ring.length && ring[0].timestamp < cutoff) ring.shift();
  while (ring.length && ring[0].type !== 'key') ring.shift();

  if (!capture) return;
  capture.chunks.push(chunk);
  if (chunk.timestamp >= capture.endUs) finishCapture();
}

/** @param {number} standT ms */
function startCapture(standT) {
  finishCapture();
  const standUs = standT * 1000;
  const fromUs = standUs - CLIPS.preMs * 1000;
  // latest keyframe at or before the wanted start – a clip must begin with a keyframe
  let start = ring.findLastIndex((c) => c.type === 'key' && c.timestamp <= fromUs);
  if (start < 0) start = 0;
  capture = { standUs, endUs: standUs + CLIPS.postMs * 1000, chunks: ring.slice(start), thumbnail: null };
}

async function finishCapture() {
  const c = capture;
  capture = null;
  if (!c || !c.chunks.length || !decoderConfig) return;

  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
  const source = new EncodedVideoPacketSource('avc');
  output.addVideoTrack(source, { frameRate: CLIPS.fps });
  await output.start();
  const t0 = c.chunks[0].timestamp;
  for (const [i, chunk] of c.chunks.entries()) {
    const packet = EncodedPacket.fromEncodedChunk(chunk).clone({ timestamp: (chunk.timestamp - t0) / 1e6 });
    await source.add(packet, i === 0 ? { decoderConfig } : undefined);
  }
  await output.finalize();

  const mp4 = /** @type {ArrayBuffer} */ (output.target.buffer);
  const last = c.chunks[c.chunks.length - 1];
  self.postMessage({
    type: 'clip',
    mp4,
    thumbnail: c.thumbnail ? await c.thumbnail : null,
    startT: t0 / 1000,
    standOffset: (c.standUs - t0) / 1e6,
    duration: (last.timestamp - t0) / 1e6,
  }, { transfer: [mp4] });
}

self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'init') {
      mirror = data.mirror;
      self.postMessage({ type: 'ready', supported: await init(data) });
    } else if (data.type === 'frame') {
      encodeFrame(data.frame, data.t);
    } else if (data.type === 'overlay') {
      if ('logo' in data) logo = data.logo;
      if ('badge' in data) badge = data.badge;
    } else if (data.type === 'trigger') {
      startCapture(data.standT);
    } else if (data.type === 'finish') {
      await finishCapture();
    }
  } catch (error) {
    self.postMessage({ type: 'error', message: String(error) });
  }
};
