/**
 * Tape-style speed-up (1.0x–3.0x): shortens duration and raises pitch,
 * same effect as playing audio back faster. Pure JS/no Web Audio
 * dependency so it's unit-testable in Node and runs identically on the
 * main thread or in a worker.
 *
 * At >= 1.5x each output sample averages round(speed) linearly-interpolated
 * taps centred on its source position — a box-filter anti-alias, the same
 * idea as the JUCE KOTrimmer's average-then-decimate, but centred so it
 * adds no time shift. At 2x this puts a null exactly at the source Nyquist.
 */
export function speedUp(channels: Float32Array[], speedMultiplier: number): Float32Array[] {
  if (speedMultiplier <= 1.0) return channels;

  const inputLength = channels[0]?.length ?? 0;
  const outputLength = Math.max(1, Math.round(inputLength / speedMultiplier));
  const taps = speedMultiplier >= 1.5 ? Math.round(speedMultiplier) : 1;
  const tapOffset = (taps - 1) / 2;

  return channels.map((channel) => {
    const output = new Float32Array(outputLength);
    for (let i = 0; i < outputLength; i++) {
      const center = i * speedMultiplier;
      let sum = 0;
      for (let k = 0; k < taps; k++) {
        sum += interpolate(channel, center + k - tapOffset, inputLength);
      }
      output[i] = sum / taps;
    }
    return output;
  });
}

function interpolate(channel: Float32Array, pos: number, length: number): number {
  const clamped = Math.max(0, Math.min(length - 1, pos));
  const idxFloor = Math.floor(clamped);
  const idxCeil = Math.min(idxFloor + 1, length - 1);
  const frac = clamped - idxFloor;
  return channel[idxFloor] + (channel[idxCeil] - channel[idxFloor]) * frac;
}
