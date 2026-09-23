import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";
import { initDatabase, getNarration, saveNarration, saveStory, getStoryById } from "../db.js";
import { narrate } from "../controllers/narrateController.js";
import { polly } from "../services/pollyService.js";

describe("SQLite Narration Audio Caching", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores and retrieves voice narration by textHash and voiceId", () => {
    const text = "Once upon a starry night, the gentle owl began to sing.";
    const textHash = crypto.createHash("sha256").update(text.trim()).digest("hex");
    const voiceId = "Matthew";
    const audioData = "data:audio/mpeg;base64,mockAudioData12345";
    const speechMarks = [{ time: 100, type: "word", start: 0, end: 4, value: "Once" }];

    saveNarration({
      storyId: "story-101",
      deviceId: "device-test-1",
      pageIndex: 0,
      voiceId,
      textHash,
      audioData,
      speechMarks,
    });

    const cached = getNarration(textHash, voiceId);
    expect(cached).not.toBeNull();
    expect(cached.textHash).toBe(textHash);
    expect(cached.voiceId).toBe("Matthew");
    expect(cached.audioData).toBe(audioData);
    expect(cached.speechMarks).toHaveLength(1);
    expect(cached.speechMarks[0].value).toBe("Once");
  });

  it("differentiates cached narration by voiceId", () => {
    const text = "A peaceful little stream bubbled through the mossy stones.";
    const textHash = crypto.createHash("sha256").update(text.trim()).digest("hex");

    saveNarration({
      voiceId: "Joanna",
      textHash,
      audioData: "data:audio/mpeg;base64,joannaVoiceAudio",
      speechMarks: [],
    });

    const joannaCached = getNarration(textHash, "Joanna");
    const matthewCached = getNarration(textHash, "Matthew");

    expect(joannaCached).not.toBeNull();
    expect(joannaCached.audioData).toBe("data:audio/mpeg;base64,joannaVoiceAudio");
    expect(matthewCached).toBeNull();
  });

  it("associates narration with story record in SQLite", () => {
    const deviceId = "device-test-narrations";
    const storyId = "story-with-narrations-1";

    const story = {
      id: storyId,
      theme: "Bedtime Forest",
      pages: ["Page one text", "Page two text"],
      narrations: {
        0: {
          audio: "data:audio/mpeg;base64,page0audio",
          speechMarks: [{ value: "Page" }],
          voiceId: "Joanna",
        },
      },
    };

    saveStory(deviceId, story);

    const retrieved = getStoryById(storyId, deviceId);
    expect(retrieved).not.toBeNull();
    expect(retrieved.narrations).toBeDefined();
    expect(retrieved.narrations["0"]).toBeDefined();
    expect(retrieved.narrations["0"].audio).toBe("data:audio/mpeg;base64,page0audio");
  });

  it("narrate controller serves cached audio on second call without calling Polly", async () => {
    const pollySendSpy = vi.spyOn(polly, "send");
    const text = `The quiet moon beamed brightly over the sleepy mountains ${Date.now()}`;
    const req = {
      body: {
        text,
        voiceId: "Emma",
        speechMarks: true,
        storyId: "story-cached-test",
        pageIndex: 1,
      },
      headers: {},
      query: {},
    };

    // First call: mock Polly responses
    const fakeAudioStream = (async function* () {
      yield Buffer.from("audioChunk1");
    })();
    const fakeMarksStream = (async function* () {
      yield Buffer.from('{"time":50,"type":"word","start":0,"end":3,"value":"The"}\n');
    })();

    pollySendSpy
      .mockResolvedValueOnce({ AudioStream: fakeAudioStream })
      .mockResolvedValueOnce({ AudioStream: fakeMarksStream });

    let responseData = null;
    const res1 = {
      status: vi.fn().mockReturnThis(),
      json: (data) => {
        responseData = data;
      },
    };

    await narrate(req, res1);

    expect(responseData).not.toBeNull();
    expect(responseData.cached).toBe(false);
    expect(responseData.audio).toContain("data:audio/mpeg;base64,");
    expect(responseData.speechMarks).toHaveLength(1);
    expect(pollySendSpy).toHaveBeenCalledTimes(2);

    // Second call: must hit SQLite cache and NOT call Polly
    let cachedResponseData = null;
    const res2 = {
      status: vi.fn().mockReturnThis(),
      json: (data) => {
        cachedResponseData = data;
      },
    };

    await narrate(req, res2);

    expect(cachedResponseData).not.toBeNull();
    expect(cachedResponseData.cached).toBe(true);
    expect(cachedResponseData.audio).toBe(responseData.audio);
    expect(cachedResponseData.speechMarks).toEqual(responseData.speechMarks);
    // pollySendSpy should NOT have been called any additional times!
    expect(pollySendSpy).toHaveBeenCalledTimes(2);
  });
});
