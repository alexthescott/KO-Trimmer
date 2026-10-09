import { describe, it, expect } from 'vitest';
import { buildOutputFilename } from '../../src/audio/naming';

describe('buildOutputFilename', () => {
  it('builds a stereo wav name with no reduction', () => {
    expect(
      buildOutputFilename({
        baseName: 'kick',
        container: 'wav',
        extension: 'wav',
        preserveStereo: true,
        bitrateKbps: 320,
        finalDurationSec: 1,
      }),
    ).toBe('kick_trimmed_stereo.wav');
  });

  it('builds a mono mp3 name with a bitrate suffix', () => {
    expect(
      buildOutputFilename({
        baseName: 'snare',
        container: 'mp3',
        extension: 'mp3',
        preserveStereo: false,
        bitrateKbps: 128,
        finalDurationSec: 1,
      }),
    ).toBe('snare_trimmed_mono_128k.mp3');
  });

  it('does not add a bitrate suffix for mp3 at the default 320kbps', () => {
    expect(
      buildOutputFilename({
        baseName: 'hat',
        container: 'mp3',
        extension: 'mp3',
        preserveStereo: true,
        bitrateKbps: 320,
        finalDurationSec: 1,
      }),
    ).toBe('hat_trimmed_stereo.mp3');
  });

  it('adds a sample-rate suffix for a reduced-rate wav', () => {
    expect(
      buildOutputFilename({
        baseName: 'loop',
        container: 'wav',
        extension: 'wav',
        preserveStereo: true,
        bitrateKbps: 96,
        targetSampleRate: 16000,
        finalDurationSec: 1,
      }),
    ).toBe('loop_trimmed_stereo_16000Hz.wav');
  });

  it('does not add a sample-rate suffix when the wav target rate is still 44100', () => {
    expect(
      buildOutputFilename({
        baseName: 'loop',
        container: 'wav',
        extension: 'wav',
        preserveStereo: true,
        bitrateKbps: 320,
        targetSampleRate: 44100,
        finalDurationSec: 1,
      }),
    ).toBe('loop_trimmed_stereo.wav');
  });

  it('prefixes an underscore when the FINAL processed duration exceeds 20s', () => {
    expect(
      buildOutputFilename({
        baseName: 'longloop',
        container: 'wav',
        extension: 'wav',
        preserveStereo: true,
        bitrateKbps: 320,
        finalDurationSec: 20.5,
      }),
    ).toBe('_longloop_trimmed_stereo.wav');
  });

  it('does not prefix when the final duration is exactly 20s or under', () => {
    expect(
      buildOutputFilename({
        baseName: 'exact',
        container: 'wav',
        extension: 'wav',
        preserveStereo: true,
        bitrateKbps: 320,
        finalDurationSec: 20,
      }),
    ).toBe('exact_trimmed_stereo.wav');
  });
});
