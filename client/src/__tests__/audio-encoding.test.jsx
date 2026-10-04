import { encodeWavBlob, convertBlobToWavBase64 } from "../utils/audioEncoding";

describe("audioEncoding utilities", () => {
  it("encodes Float32 audio samples into a valid WAV blob with RIFF and fmt headers", async () => {
    const sampleRate = 22050;
    // 0.1s of silence/sine samples
    const samples = new Float32Array(sampleRate * 0.1);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate);
    }

    const wavBlob = encodeWavBlob(samples, sampleRate);
    expect(wavBlob).toBeInstanceOf(Blob);
    expect(wavBlob.type).toBe("audio/wav");
    expect(wavBlob.size).toBe(44 + samples.length * 2);

    const buffer = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(wavBlob);
    });

    const view = new DataView(buffer);

    // Verify RIFF header
    const riff = String.fromCharCode(
      view.getUint8(0),
      view.getUint8(1),
      view.getUint8(2),
      view.getUint8(3)
    );
    expect(riff).toBe("RIFF");

    // Verify WAVE tag
    const wave = String.fromCharCode(
      view.getUint8(8),
      view.getUint8(9),
      view.getUint8(10),
      view.getUint8(11)
    );
    expect(wave).toBe("WAVE");

    // Verify fmt chunk
    const fmt = String.fromCharCode(
      view.getUint8(12),
      view.getUint8(13),
      view.getUint8(14),
      view.getUint8(15)
    );
    expect(fmt).toBe("fmt ");

    // Verify PCM mono 16-bit
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(1); // Mono
    expect(view.getUint32(24, true)).toBe(sampleRate);
    expect(view.getUint16(34, true)).toBe(16); // 16-bit
  });

  it("returns empty string when given null or undefined blob in convertBlobToWavBase64", async () => {
    const resultNull = await convertBlobToWavBase64(null);
    expect(resultNull).toBe("");

    const resultUndefined = await convertBlobToWavBase64(undefined);
    expect(resultUndefined).toBe("");
  });

  it("converts a mock audio blob to base64 Data URL using FileReader fallback in jsdom", async () => {
    const rawBlob = new Blob(["mock-audio-bytes"], { type: "audio/wav" });
    const result = await convertBlobToWavBase64(rawBlob);
    expect(typeof result).toBe("string");
    expect(result).toMatch(/^data:.*base64,/);
  });
});
