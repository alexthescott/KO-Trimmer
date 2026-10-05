/** Synthetic PCM generators for DSP unit tests: silence and tone segments. */
export function silence(samples: number): Float32Array {
  return new Float32Array(samples);
}

export function tone(samples: number, amplitude = 0.8, frequency = 440, sampleRate = 44100): Float32Array {
  const out = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    out[i] = amplitude * Math.sin((2 * Math.PI * frequency * i) / sampleRate);
  }
  return out;
}

export function concat(...segments: Float32Array[]): Float32Array {
  const total = segments.reduce((sum, s) => sum + s.length, 0);
  const out = new Float32Array(total);
  let offset = 0;
  for (const seg of segments) {
    out.set(seg, offset);
    offset += seg.length;
  }
  return out;
}
