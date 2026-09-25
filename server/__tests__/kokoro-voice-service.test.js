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
        text: `Once upon a bedtime dream ${Date.now()}`,
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

  it("does not call AWS Polly when Kokoro microservice returns an error for a custom voice", async () => {
    process.env.KOKORO_VOICE_SERVICE_URL = "http://localhost:8880";

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ detail: "Kokoro inference failure" }),
    });
    globalThis.fetch = mockFetch;

    let responseJson = null;
    let responseStatus = 200;
    const req = {
      body: {
        text: `Failing custom voice narration test ${Date.now()}`,
        voiceId: "custom_dad_999",
        speechMarks: true,
      },
      headers: {},
      query: {},
    };
    const res = {
      status: vi.fn((s) => {
        responseStatus = s;
        return res;
      }),
      json: (data) => {
        responseJson = data;
      },
      setHeader: vi.fn(),
      end: vi.fn(),
    };

    await narrate(req, res);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(responseStatus).toBe(502);
    expect(responseJson).toBeDefined();
    expect(responseJson.error).toContain("Kokoro voice synthesis error");
  });

  it("does not call AWS Polly when KOKORO_VOICE_SERVICE_URL is missing for a custom voice", async () => {
    delete process.env.KOKORO_VOICE_SERVICE_URL;
    delete process.env.KOKORO_API_URL;

    let responseJson = null;
    let responseStatus = 200;
    const req = {
      body: {
        text: `Missing config custom voice test ${Date.now()}`,
        voiceId: "custom_grandpa_111",
        speechMarks: true,
      },
      headers: {},
      query: {},
    };
    const res = {
      status: vi.fn((s) => {
        responseStatus = s;
        return res;
      }),
      json: (data) => {
        responseJson = data;
      },
      setHeader: vi.fn(),
      end: vi.fn(),
    };

    await narrate(req, res);

    expect(responseStatus).toBe(503);
    expect(responseJson).toBeDefined();
    expect(responseJson.error).toContain("Voice microservice is required");
  });

  it("passes custom audio sample to Kokoro when custom voice has recorded audio sample", async () => {
    process.env.KOKORO_VOICE_SERVICE_URL = "http://localhost:8880";
    const { saveCustomVoiceRecord } = await import("../db.js");
    const testVoiceId = `custom_test_${Date.now()}`;
    saveCustomVoiceRecord({
      id: testVoiceId,
      name: "Test Aunt Voice",
      role: "Aunt",
      baseVoice: "Joanna",
      audioDataUrl: "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=",
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "success",
        voice_id: testVoiceId,
        duration_ms: 1200,
        speech_marks: [{ time: 0, type: "word", start: 0, end: 5, value: "Hello" }],
        audio_base64: "data:audio/wav;base64,synthesizedSampleAudio",
      }),
    });
    globalThis.fetch = mockFetch;

    const req = {
      body: {
        text: `Custom audio sample forwarding test ${Date.now()}`,
        voiceId: testVoiceId,
        speechMarks: true,
      },
      headers: {},
      query: {},
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      setHeader: vi.fn(),
      end: vi.fn(),
    };

    await narrate(req, res);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, calledOptions] = mockFetch.mock.calls[0];
    const parsedBody = JSON.parse(calledOptions.body);
    expect(parsedBody.voice_id).toBe(testVoiceId);
    expect(parsedBody.audio_sample).toContain("UklGRiQAAABXQVZFZm10");
  });
});
