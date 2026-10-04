/**
 * Audio Encoding Utilities for Family Voice Studio
 * Handles converting recorded audio Blobs (WebM, OGG, MP4, etc.)
 * into standard 16-bit PCM Mono WAV base64 Data URLs suitable for voice synthesis.
 */

/**
 * Encodes Float32 channel data into a 16-bit PCM Mono WAV Blob.
 *
 * @param {Float32Array} channelData
 * @param {number} sampleRate
 * @returns {Blob}
 */
export function encodeWavBlob(channelData, sampleRate) {
  const length = channelData.length;
  const buffer = new ArrayBuffer(44 + length * 2);
  const view = new DataView(buffer);

  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // RIFF Chunk Descriptor
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + length * 2, true);
  writeStr(8, "WAVE");

  // "fmt " sub-chunk
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
  view.setUint16(22, 1, true); // NumChannels (1 = Mono)
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * 2, true); // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
  view.setUint16(32, 2, true); // BlockAlign (NumChannels * BitsPerSample/8)
  view.setUint16(34, 16, true); // BitsPerSample (16 bits)

  // "data" sub-chunk
  writeStr(36, "data");
  view.setUint32(40, length * 2, true); // Subchunk2Size (NumSamples * NumChannels * BitsPerSample/8)

  // Write 16-bit PCM audio samples
  let offset = 44;
  for (let i = 0; i < length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, channelData[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([view], { type: "audio/wav" });
}

/**
 * Converts any audio Blob into a 16-bit Mono WAV base64 Data URL.
 * First attempts to decode through AudioContext to ensure a canonical 16-bit PCM WAV.
 * Falls back to reading the raw blob as Data URL if AudioContext is unavailable.
 *
 * @param {Blob} blob
 * @returns {Promise<string>} Data URL string (e.g. "data:audio/wav;base64,...")
 */
export async function convertBlobToWavBase64(blob) {
  if (!blob) return "";

  try {
    if (typeof blob.arrayBuffer === "function") {
      const AudioContextClass =
        typeof window !== "undefined"
          ? window.AudioContext || window.webkitAudioContext
          : null;

      if (AudioContextClass) {
        const arrayBuffer = await blob.arrayBuffer();
        const audioCtx = new AudioContextClass();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        try {
          await audioCtx.close();
        } catch (_) {}

        const channelData = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;
        const wavBlob = encodeWavBlob(channelData, sampleRate);

        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result || "");
          reader.onerror = () => resolve("");
          reader.readAsDataURL(wavBlob);
        });
      }
    }
  } catch (err) {
    console.warn("[audioEncoding] WAV decoding notice:", err);
  }

  if (typeof FileReader !== "undefined") {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result || "");
      reader.onerror = () => resolve("");
      reader.readAsDataURL(blob);
    });
  }

  return "";
}
