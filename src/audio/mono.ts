import { frameCount } from './channels';

export function downmixToMono(channels: Float32Array[]): Float32Array[] {
  if (channels.length <= 1) return channels;
  const n = frameCount(channels);
  const mono = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (const channel of channels) sum += channel[i];
    mono[i] = sum / channels.length;
  }
  return [mono];
}
