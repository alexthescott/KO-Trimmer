import type { PcmAudio } from '../../../audio/channels';
import { playChannels, stopPlayback, type PlaybackHandle } from '../../../audio/player';

export type PlaybackTarget = 'original' | 'processed';

export interface PreviewPlaybackListener {
  /** Started or stopped: update the buttons and redraw. */
  onStateChange(): void;
  /** Every animation frame while playing: move the playhead. */
  onFrame(): void;
}

/**
 * The editor's preview playback: which waveform is playing, how far along
 * it is, and a repaint every frame until it stops or ends.
 */
export class PreviewPlayback {
  private playing?: { target: PlaybackTarget; handle: PlaybackHandle };
  private rafId?: number;

  constructor(private readonly listener: PreviewPlaybackListener) {}

  get target(): PlaybackTarget | undefined {
    return this.playing?.target;
  }

  /** 0..1 through the playing buffer; 0 when idle. */
  get progress(): number {
    if (!this.playing) return 0;
    const { handle } = this.playing;
    return handle.duration > 0 ? handle.position() / handle.duration : 0;
  }

  start(target: PlaybackTarget, audio: PcmAudio): void {
    const handle = playChannels(audio.channels, audio.sampleRate, () => {
      if (this.playing?.handle === handle) this.end();
    });
    if (!handle) return;
    this.playing = { target, handle };
    this.listener.onStateChange();
    this.tick();
  }

  stop(): void {
    stopPlayback();
    this.end();
  }

  private end(): void {
    this.playing = undefined;
    if (this.rafId !== undefined) cancelAnimationFrame(this.rafId);
    this.rafId = undefined;
    this.listener.onStateChange();
  }

  private tick = (): void => {
    this.listener.onFrame();
    if (this.playing) this.rafId = requestAnimationFrame(this.tick);
  };
}
