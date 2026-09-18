/**
 * Bedtime Lullaby Chime generator using pure Web Audio API.
 * Synthesizes a soft, warm pentatonic chime sequence (C5, E5, G5, C6)
 * with gentle sine waves, soft attack, and dreamy exponential decay.
 */
let sharedAudioCtx = null;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
    try {
      sharedAudioCtx = new AudioCtx();
    } catch (e) {
      return null;
    }
  }
  if (sharedAudioCtx.state === "suspended") {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

export function playBedtimeLullabyChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    // Soft pentatonic soothing notes: C5 (523.25), E5 (659.25), G5 (783.99), C6 (1046.50)
    const notes = [
      { freq: 523.25, time: 0.0, duration: 1.8 },
      { freq: 659.25, time: 0.25, duration: 1.6 },
      { freq: 783.99, time: 0.5, duration: 2.0 },
      { freq: 1046.50, time: 0.8, duration: 2.5 },
    ];

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.1, ctx.currentTime); // Gentle, calming volume
    masterGain.connect(ctx.destination);

    notes.forEach(({ freq, time, duration }) => {
      const startTime = ctx.currentTime + time;
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startTime);

      // Gentle attack & smooth decay envelope
      noteGain.gain.setValueAtTime(0.0001, startTime);
      noteGain.gain.exponentialRampToValueAtTime(0.3, startTime + 0.08);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(noteGain);
      noteGain.connect(masterGain);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.1);
    });
  } catch (err) {
    console.warn("Could not play bedtime lullaby chime:", err);
  }
}
