const tf = require('@tensorflow/tfjs-node');
const faceapi = require('@vladmandic/face-api');
const { Canvas, Image, ImageData, loadImage } = require('canvas');
const path = require('path');

// Patch faceapi for Node.js
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

const MODEL_PATH = path.join(
  __dirname, '..', 'node_modules', '@vladmandic', 'face-api', 'model'
);

let modelsLoaded = false;

async function initFaceApi() {
  if (modelsLoaded) return;
  await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODEL_PATH);
  await faceapi.nets.faceLandmark68Net.loadFromDisk(MODEL_PATH);
  await faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_PATH);
  modelsLoaded = true;
}

/**
 * Get a 128-float face descriptor from an image buffer or base64 data URL.
 * Returns Float32Array or null if no face detected.
 */
async function getDescriptor(imageInput) {
  let img;
  if (typeof imageInput === 'string') {
    // Strip data URL prefix if present
    const base64 = imageInput.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64, 'base64');
    img = await loadImage(buffer);
  } else {
    img = await loadImage(imageInput);
  }

  const detection = await faceapi
    .detectSingleFace(img)
    .withFaceLandmarks()
    .withFaceDescriptor();

  return detection ? detection.descriptor : null;
}

/**
 * Compare a query descriptor to stored employees.
 * Returns the best matching employee or null if no match within threshold.
 */
function findMatch(queryDescriptor, employees, threshold = 0.55) {
  let bestMatch = null;
  let bestDistance = Infinity;

  for (const emp of employees) {
    if (!emp.face_descriptor || emp.face_descriptor.length !== 128) continue;
    const stored = new Float32Array(emp.face_descriptor);
    const distance = faceapi.euclideanDistance(queryDescriptor, stored);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestMatch = emp;
    }
  }

  return bestDistance <= threshold ? bestMatch : null;
}

module.exports = { initFaceApi, getDescriptor, findMatch };
