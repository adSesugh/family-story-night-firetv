import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { synthesizeWithKokoro } from "../services/kokoroVoiceService.js";
import { narrate } from "../controllers/narrateController.js";

describe("Kokoro-82M Voice Microservice Integration", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("returns null if KOKORO_VOICE_SERVICE_URL is not set", async () => {
    delete process.env.KOKORO_VOICE_SERVICE_URL;
    delete process.env.KOKORO_API_URL;
    const res = await synthesizeWithKokoro("Hello bedtime story");
    expect(res).toBeNull();
  });

  it("calls the Kokoro service endpoint and parses audio and speech marks", async () => {
    process.env.KOKORO_VOICE_SERVICE_URL = "http://localhost:8880";

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "success",
        voice_id: "af_bella",
        duration_ms: 2500,
        sample_rate: 24000,
        speech_marks: [
          { time: 0, type: "word", start: 0, end: 5, value: "Hello" },
          { time: 500, type: "word", start: 6, end: 11, value: "stars" },
        ],
        audio_base64: "data:audio/wav;base64,mockKokoroWavBase64",
      }),
    });
    globalThis.fetch = mockFetch;

    const result = await synthesizeWithKokoro("Hello stars", "af_bella", "Joanna", 0.95);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [calledUrl, calledOptions] = mockFetch.mock.calls[0];
    expect(calledUrl).toBe("http://localhost:8880/synthesize");
    expect(calledOptions.method).toBe("POST");

    const parsedBody = JSON.parse(calledOptions.body);
    expect(parsedBody.text).toBe("Hello stars");
    expect(parsedBody.voice_id).toBe("af_bella");

    expect(result).toBeDefined();
    expect(result.audioData).toBe("data:audio/wav;base64,mockKokoroWavBase64");
    expect(result.engine).toBe("kokoro-82m");
    expect(result.speechMarks).toHaveLength(2);
  });

  it("routes through Kokoro when a custom voice clone is requested", async () => {
    process.env.KOKORO_VOICE_SERVICE_URL = "http://localhost:8880";

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "success",
        voice_id: "custom_mom_456",
        duration_ms: 1800,
        speech_marks: [{ time: 0, type: "word", start: 0, end: 4, value: "Once" }],
        audio_base64: "data:audio/wav;base64,customMomAudio",
      }),
    });
    globalThis.fetch = mockFetch;

    let responseJson = null;
    const req = {
      body: {
        text: "Once upon a bedtime dream",
        voiceId: "custom_mom_456",
        speechMarks: true,
      },
      headers: {},
      query: {},
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: (data) => {
        responseJson = data;
      },
      setHeader: vi.fn(),
      end: vi.fn(),
    };

    await narrate(req, res);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(responseJson).toBeDefined();
    expect(responseJson.engine).toBe("kokoro-82m");
    expect(responseJson.audio).toBe("data:audio/wav;base64,customMomAudio");
  });
});
