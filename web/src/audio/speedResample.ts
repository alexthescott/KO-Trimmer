/**
 * New feature (not present in the desktop app): a simple tape-style
 * speed-up. Pure linear-interpolation resample — shortens duration and
 * raises pitch, same effect as playing audio back faster. Deliberately
 * pure JS/no Web Audio dependency so it's unit-testable in Node and runs
 * identically on the main thread or in a worker.
 */
export function speedUp(channels: Float32Array[], speedMultiplier: number): Float32Array[] {
  if (speedMultiplier <= 1.0) return channels;

  const inputLength = channels[0]?.length ?? 0;
  const outputLength = Math.max(1, Math.round(inputLength / speedMultiplier));

  return channels.map((channel) => {
    const output = new Float32Array(outputLength);
    for (let i = 0; i < outputLength; i++) {
      const srcPos = i * speedMultiplier;
      const idxFloor = Math.min(Math.floor(srcPos), inputLength - 1);
      const idxCeil = Math.min(idxFloor + 1, inputLength - 1);
      const frac = srcPos - idxFloor;
      output[i] = channel[idxFloor] + (channel[idxCeil] - channel[idxFloor]) * frac;
    }
    return output;
  });
}
