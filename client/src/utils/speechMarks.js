/**
 * Speech Marks Normalization & Synchronization Utilities
 * Converts Amazon Polly UTF-8 byte offsets to JavaScript character indices
 * and computes frame-accurate word highlighting for real-time karaoke.
 */

function getEncoderDecoder() {
  if (typeof TextEncoder !== "undefined" && typeof TextDecoder !== "undefined") {
    return {
      encode: (str) => new TextEncoder().encode(str),
      decode: (bytes) => new TextDecoder("utf-8").decode(bytes),
    };
  }
  // Fallback for Node / Jest / JSDOM environments
  if (typeof Buffer !== "undefined") {
    return {
      encode: (str) => Buffer.from(str, "utf8"),
      decode: (bytes) => Buffer.from(bytes).toString("utf8"),
    };
  }
  return null;
}

/**
 * Normalizes Polly speech marks to ensure start/end offsets match JavaScript string indices.
 * AWS Polly emits UTF-8 byte offsets, which drift whenever multi-byte characters
 * (smart quotes, apostrophes, dashes, ellipses, accented letters) are present.
 *
 * @param {Array<{time: number, start: number, end: number, value: string}>} marks
 * @param {string} text
 * @returns {Array<{time: number, start: number, end: number, value: string}>}
 */
export function normalizeSpeechMarks(marks, text) {
  if (!Array.isArray(marks) || marks.length === 0 || !text) return marks || [];

  const codec = getEncoderDecoder();
  if (!codec) return marks;

  const utf8Bytes = codec.encode(text);

  return marks.map((m) => {
    if (typeof m.start !== "number" || typeof m.end !== "number") return m;

    // If slice directly matches, it's already aligned to JS character indices
    if (text.slice(m.start, m.end) === m.value) {
      return m;
    }

    try {
      const charStart = codec.decode(utf8Bytes.subarray(0, m.start)).length;
      const charEnd = codec.decode(utf8Bytes.subarray(0, m.end)).length;
      return {
        ...m,
        start: charStart,
        end: charEnd,
      };
    } catch {
      return m;
    }
  });
}

/**
 * Finds the active speech mark matching the audio's current playback position in milliseconds.
 *
 * @param {Array<{time: number, start: number, end: number, value: string}>} marks
 * @param {number} currentTimeMs
 * @param {number} [offsetMs=0] - Optional latency offset in milliseconds
 * @returns {{time: number, start: number, end: number, value: string} | null}
 */
export function getActiveSpeechMarkAtTime(marks, currentTimeMs, offsetMs = 0) {
  if (!marks || marks.length === 0 || typeof currentTimeMs !== "number") return null;

  const effectiveTimeMs = Math.max(0, currentTimeMs + (typeof offsetMs === "number" ? offsetMs : 0));

  for (let i = 0; i < marks.length; i++) {
    const mark = marks[i];
    if (mark.time <= effectiveTimeMs) {
      // Natural word duration: respect explicit mark.duration or calculate from next mark
      const nextTime = marks[i + 1] ? marks[i + 1].time : mark.time + (mark.duration || 550);
      const wordDuration = mark.duration && mark.duration > 0
        ? Math.min(mark.duration, Math.max(nextTime - mark.time, 80))
        : Math.min(nextTime - mark.time, 550);

      if (effectiveTimeMs < mark.time + wordDuration) {
        return mark;
      }
    }
  }

  return null;
}
