/** Output encoding choices the audio code knows how to produce. */

export const BITRATE_OPTIONS = [320, 192, 160, 128, 96, 64] as const;

/** Top MP3 bitrate: no suffix in the filename and no lossy round-trip in the preview. */
export const FULL_MP3_BITRATE = BITRATE_OPTIONS[0];

export const WAV_SAMPLE_RATE_OPTIONS = [44100, 22050, 16000, 11025, 8000] as const;
