import { frameCount } from './channels';

/**
 * Windowed-RMS energy envelope, upsampled back to full sample resolution.
 * Windowed RMS per frame, max across channels, then linear interpolation
 * across frame positions spread evenly over [0, N] (linspace-style), not
 * true frame centers.
 */
export function computeEnergyEnvelope(channels: Float32Array[], frameLength = 2048, hopLength = 512): Float32Array {
  const n = frameCount(channels);
  if (n === 0) return new Float32Array(0);

  const numFrames = Math.max(1, Math.ceil(n / hopLength));
  const frameRms = frameRmsMaxAcrossChannels(channels, n, numFrames, frameLength, hopLength);

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

/**
 * Windowed RMS per frame, max across channels. When the frame is a whole
 * number of hops (the default 2048/512), each sample is squared once into a
 * per-hop block sum and frames add up their blocks — O(n) instead of
 * re-summing every overlapping window. Same sums, so the same envelope.
 */
function frameRmsMaxAcrossChannels(
  channels: Float32Array[],
  n: number,
  numFrames: number,
  frameLength: number,
  hopLength: number,
): Float32Array {
  const frameRms = new Float32Array(numFrames);
  const blocksPerFrame = frameLength / hopLength;
  const blockSums = Number.isInteger(blocksPerFrame) ? new Float64Array(numFrames) : undefined;

  for (const channel of channels) {
    if (blockSums) {
      for (let b = 0; b < numFrames; b++) {
        const end = Math.min((b + 1) * hopLength, n);
        let sum = 0;
        for (let i = b * hopLength; i < end; i++) sum += channel[i] * channel[i];
        blockSums[b] = sum;
      }
    }
    for (let k = 0; k < numFrames; k++) {
      const start = k * hopLength;
      const end = Math.min(start + frameLength, n);
      let sumSquares = 0;
      if (blockSums) {
        const lastBlock = Math.min(k + blocksPerFrame, numFrames);
        for (let b = k; b < lastBlock; b++) sumSquares += blockSums[b];
      } else {
        for (let i = start; i < end; i++) sumSquares += channel[i] * channel[i];
      }
      const rms = Math.sqrt(sumSquares / Math.max(1, end - start));
      if (rms > frameRms[k]) frameRms[k] = rms;
    }
  }
  return frameRms;
}
