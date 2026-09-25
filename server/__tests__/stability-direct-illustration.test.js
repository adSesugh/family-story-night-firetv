import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  generateIllustration,
  generateStabilityIllustration,
  getActiveIllustrationEngine,
} from "../services/imageService.js";
import { illustrate } from "../controllers/illustrateController.js";

describe("Stability AI Direct API (v2beta Stable Image Core) Integration", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.KAGGLE_NGROK_URL;
    delete process.env.ILLUSTRATION_API_URL;
    delete process.env.STABILITY_API_KEY;
    delete process.env.ILLUSTRATION_ENGINE;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("Engine Selection (getActiveIllustrationEngine)", () => {
    it("returns 'bedrock' by default when no keys or urls are set", () => {
      expect(getActiveIllustrationEngine()).toBe("bedrock");
    });

    it("returns 'stability' when STABILITY_API_KEY is present", () => {
      process.env.STABILITY_API_KEY = "sk-test-12345";
      expect(getActiveIllustrationEngine()).toBe("stability");
    });

    it("returns 'kaggle' when KAGGLE_NGROK_URL is present and STABILITY_API_KEY is not", () => {
      process.env.KAGGLE_NGROK_URL = "https://custom-tunnel.ngrok-free.app";
      expect(getActiveIllustrationEngine()).toBe("kaggle");
    });

    it("respects explicit ILLUSTRATION_ENGINE override over env keys", () => {
      process.env.STABILITY_API_KEY = "sk-test-12345";
      process.env.KAGGLE_NGROK_URL = "https://custom-tunnel.ngrok-free.app";

      process.env.ILLUSTRATION_ENGINE = "kaggle";
      expect(getActiveIllustrationEngine()).toBe("kaggle");

      process.env.ILLUSTRATION_ENGINE = "stability";
      expect(getActiveIllustrationEngine()).toBe("stability");

      process.env.ILLUSTRATION_ENGINE = "bedrock";
      expect(getActiveIllustrationEngine()).toBe("bedrock");
    });
  });

  describe("generateStabilityIllustration API Invocation", () => {
    it("throws error if STABILITY_API_KEY is not configured", async () => {
      await expect(
        generateStabilityIllustration("a cozy forest cabin")
      ).rejects.toThrow("STABILITY_API_KEY is not configured in .env");
    });

    it("calls v2beta/stable-image/generate/core with Bearer token and FormData", async () => {
      process.env.STABILITY_API_KEY = "sk-secret-test-key";

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: {
          get: (h) => (h.toLowerCase() === "content-type" ? "application/json" : null),
        },
        json: async () => ({
          image: "mockStabilityBase64Jpeg",
          finish_reason: "SUCCESS",
          seed: 42,
        }),
      });
      globalThis.fetch = mockFetch;

      const result = await generateStabilityIllustration(
        "A peaceful starry bedtime scene",
        "Bedtime Page 1",
        "scary, dark",
        42
      );

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [calledUrl, calledOptions] = mockFetch.mock.calls[0];

      expect(calledUrl).toBe("https://api.stability.ai/v2beta/stable-image/generate/core");
      expect(calledOptions.method).toBe("POST");
      expect(calledOptions.headers.Authorization).toBe("Bearer sk-secret-test-key");
      expect(calledOptions.headers.Accept).toBe("application/json");

      expect(calledOptions.body).toBeInstanceOf(FormData);
      expect(calledOptions.body.get("prompt")).toBe("A peaceful starry bedtime scene");
      expect(calledOptions.body.get("negative_prompt")).toBe("scary, dark");
      expect(calledOptions.body.get("output_format")).toBe("jpeg");
      expect(calledOptions.body.get("aspect_ratio")).toBe("1:1");

      expect(result).toBeDefined();
      expect(result.url).toBe("data:image/jpeg;base64,mockStabilityBase64Jpeg");
      expect(result.engine).toBe("stability-api");
      expect(result.contentType).toBe("image/jpeg");
    });

    it("supports binary image responses from Stability API", async () => {
      process.env.STABILITY_API_KEY = "sk-secret-test-key";

      const fakeBinary = Buffer.from("fake-stability-jpeg-bytes");
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: {
          get: (h) => (h.toLowerCase() === "content-type" ? "image/jpeg" : null),
        },
        arrayBuffer: async () =>
          fakeBinary.buffer.slice(fakeBinary.byteOffset, fakeBinary.byteOffset + fakeBinary.byteLength),
      });
      globalThis.fetch = mockFetch;

      const result = await generateStabilityIllustration("starlight mountain", "Page 2");
      expect(result.url).toBe(`data:image/jpeg;base64,${fakeBinary.toString("base64")}`);
      expect(result.engine).toBe("stability-api");
    });
  });

  describe("Integration in illustrateController", () => {
    it("routes through Stability API and sets X-Illustration-Engine: stability-api", async () => {
      process.env.STABILITY_API_KEY = "sk-test-live";
      process.env.ILLUSTRATION_ENGINE = "stability";

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: {
          get: (h) => (h.toLowerCase() === "content-type" ? "application/json" : null),
        },
        json: async () => ({
          image: "stabilityControllerJpegBase64",
        }),
      });
      globalThis.fetch = mockFetch;

      let setHeaders = {};
      let responseBuffer = null;
      const req = {
        body: {
          text: "The cozy owl blinked at the shining moon.",
          theme: "Forest Magic",
        },
      };
      const res = {
        setHeader: (k, v) => {
          setHeaders[k] = v;
        },
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        end: (buf) => {
          responseBuffer = buf;
        },
      };

      await illustrate(req, res);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(setHeaders["Content-Type"]).toBe("image/jpeg");
      expect(setHeaders["X-Illustration-Engine"]).toBe("stability-api");
      expect(responseBuffer).toBeInstanceOf(Buffer);
    });

    it("does not fallback to Bedrock when ILLUSTRATION_ENGINE=stability and Stability API fails", async () => {
      process.env.STABILITY_API_KEY = "sk-failing-key";
      process.env.ILLUSTRATION_ENGINE = "stability";

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 402,
        statusText: "Payment Required",
        text: async () => "Insufficient credits",
      });
      globalThis.fetch = mockFetch;

      const result = await generateIllustration("page text", "Theme", 123);
      expect(result).toBeNull();
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});
