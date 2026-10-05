let sharedContext: AudioContext | null = null;

/** The app's one live AudioContext, shared by decode fallback and preview playback. */
export function getSharedContext(): AudioContext {
  if (!sharedContext) sharedContext = new AudioContext();
  return sharedContext;
}
