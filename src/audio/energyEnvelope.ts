import { frameCount } from './channels';

/**
 * Windowed-RMS energy envelope, upsampled back to full sample resolution.
 * Windowed RMS per frame, max across channels, then linear interpolation
 * across frame positions spread evenly over [0, N] (linspace-style), not
 * true frame centers.
 */
export function computeEnergyEnvelope(
  channels: Float32Array[],
  frameLength = 2048,
  hopLength = 512,
): Float32Array {
  const n = frameCount(channels);
  if (n === 0) return new Float32Array(0);

  const numFrames = Math.max(1, Math.ceil(n / hopLength));
  const frameRms = new Float32Array(numFrames);

  for (let k = 0; k < numFrames; k++) {
    const start = k * hopLength;
    const end = Math.min(start + frameLength, n);
    const frameLen = Math.max(1, end - start);

    let maxRms = 0;
    for (const channel of channels) {
      let sumSquares = 0;
      for (let i = start; i < end; i++) {
        const sample = channel[i];
        sumSquares += sample * sample;
      }
      const rms = Math.sqrt(sumSquares / frameLen);
      if (rms > maxRms) maxRms = rms;
    }
    frameRms[k] = maxRms;
  }

  if (numFrames === 1) {
    return new Float32Array(n).fill(frameRms[0]);
  }

  // Frame positions spread evenly across [0, n], mirroring np.linspace(0, n, numFrames).
  const framePositions = new Float32Array(numFrames);
  for (let k = 0; k < numFrames; k++) {
    framePositions[k] = (k * n) / (numFrames - 1);
  }

  const energy = new Float32Array(n);
  let frameIdx = 0;
  for (let i = 0; i < n; i++) {
    while (frameIdx < numFrames - 2 && framePositions[frameIdx + 1] < i) {
      frameIdx++;
    }
    const x0 = framePositions[frameIdx];
    const x1 = framePositions[frameIdx + 1];
    const y0 = frameRms[frameIdx];
    const y1 = frameRms[frameIdx + 1];
    if (x1 === x0) {
      energy[i] = y0;
    } else {
      const frac = (i - x0) / (x1 - x0);
      energy[i] = y0 + (y1 - y0) * frac;
    }
  }

  return energy;
}
