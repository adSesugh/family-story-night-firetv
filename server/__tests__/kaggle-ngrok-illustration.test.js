import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateIllustration, generateKaggleIllustration } from "../services/imageService.js";
import { illustrate } from "../controllers/illustrateController.js";

describe("Kaggle ngrok Illustration Endpoint Integration", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("calls the Kaggle ngrok URL with proper headers and body when configured", async () => {
    process.env.KAGGLE_NGROK_URL = "https://test-kaggle.ngrok-free.app/generate";

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: (h) => (h.toLowerCase() === "content-type" ? "application/json" : null),
      },
      json: async () => ({ image: "mockBase64FromKaggle" }),
    });
    globalThis.fetch = mockFetch;

    const result = await generateIllustration(
      "The little bear found a golden key in the forest.",
      "Bedtime Adventure",
      12345
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [calledUrl, calledOptions] = mockFetch.mock.calls[0];
    expect(calledUrl).toBe("https://test-kaggle.ngrok-free.app/generate");
    expect(calledOptions.method).toBe("POST");
    expect(calledOptions.headers["Content-Type"]).toBe("application/json");
    expect(calledOptions.headers["ngrok-skip-browser-warning"]).toBe("true");

    const parsedBody = JSON.parse(calledOptions.body);
    expect(parsedBody.prompt).toBeDefined();
    expect(parsedBody.prompt).toContain("golden key");

    expect(result).toBeDefined();
    expect(result.url).toBe("data:image/png;base64,mockBase64FromKaggle");
  });

  it("appends /generate if KAGGLE_NGROK_URL does not include it", async () => {
    process.env.KAGGLE_NGROK_URL = "https://custom-kaggle-tunnel.ngrok-free.app";

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: (h) => (h.toLowerCase() === "content-type" ? "application/json" : null),
      },
      json: async () => ({ images: ["mockImageArray0"] }),
    });
    globalThis.fetch = mockFetch;

    const result = await generateKaggleIllustration("claymation teddy bear", "Teddy Bear");
    expect(mockFetch.mock.calls[0][0]).toBe("https://custom-kaggle-tunnel.ngrok-free.app/generate");
    expect(result.url).toBe("data:image/png;base64,mockImageArray0");
  });

  it("supports binary image responses from Kaggle endpoint", async () => {
    process.env.KAGGLE_NGROK_URL = "https://test-binary.ngrok-free.app/generate";

    const fakeBinary = Buffer.from("fake-binary-image-data");
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: (h) => (h.toLowerCase() === "content-type" ? "image/png" : null),
      },
      arrayBuffer: async () => fakeBinary.buffer.slice(fakeBinary.byteOffset, fakeBinary.byteOffset + fakeBinary.byteLength),
    });
    globalThis.fetch = mockFetch;

    const result = await generateKaggleIllustration("spaceship in stars", "Space");
    expect(result.url).toContain("data:image/png;base64,");
    expect(result.url).toBe(`data:image/png;base64,${fakeBinary.toString("base64")}`);
  });

  it("handles explicit prompt in illustrateController and forwards it to Kaggle", async () => {
    process.env.KAGGLE_NGROK_URL = "https://test-kaggle.ngrok-free.app/generate";

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: (h) => (h.toLowerCase() === "content-type" ? "application/json" : null),
      },
      json: async () => ({ image: "explicitPromptImageBase64" }),
    });
    globalThis.fetch = mockFetch;

    const req = {
      body: {
        prompt: "claymation style, cute smiling dragon drinking hot cocoa by a campfire",
      },
    };

    let responseBuffer = null;
    let contentType = null;
    const res = {
      setHeader: (k, v) => {
        if (k === "Content-Type") contentType = v;
      },
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      end: (buf) => {
        responseBuffer = buf;
      },
    };

    await illustrate(req, res);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const parsedBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(parsedBody.prompt).toBe("claymation style, cute smiling dragon drinking hot cocoa by a campfire");
    expect(contentType).toBe("image/png");
    expect(responseBuffer).toBeInstanceOf(Buffer);
  });
});
