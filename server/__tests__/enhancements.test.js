import { describe, it, expect } from "vitest";

const ALLOWED_VOICES = ["Joanna", "Matthew", "Emma", "Ivy"];
const ALLOWED_STORY_LENGTHS = [4, 6, 8];
const MAX_TOKENS_BY_LENGTH = { 4: 600, 6: 800, 8: 1050 };

function validateStoryRequest({ familyMembers = [], theme = "a cozy adventure", isCustomTheme = false, storyLength = 6 }) {
  if (!familyMembers || familyMembers.length === 0) {
    return { status: 400, error: "familyMembers is required" };
  }
  if (isCustomTheme && theme.length > 100) {
    return { status: 400, error: "Custom theme must be 100 characters or fewer" };
  }
  const parsedLength = Number(storyLength);
  if (!ALLOWED_STORY_LENGTHS.includes(parsedLength)) {
    return { status: 400, error: "storyLength must be 4, 6, or 8" };
  }
  const maxTokens = MAX_TOKENS_BY_LENGTH[parsedLength] || 800;
  const prompt = `Write a short, warm bedtime story (${parsedLength} pages, 2-3 sentences per page) \
starring these family members: ${familyMembers.join(", ")}. Theme: ${theme}. \
Make it gentle, imaginative, and suitable for all ages. \
Important rules: do not use dashes, hyphenated words, or em dashes anywhere in the story text. \
Write every sentence in plain language with standard punctuation only. \
Return ONLY a JSON array of ${parsedLength} strings, one per page, with no extra text or markdown.`;

  return { status: 200, prompt, maxTokens, parsedLength };
}

function resolveVoiceId(voiceId, baseVoice) {
  if (baseVoice && ALLOWED_VOICES.includes(baseVoice)) return baseVoice;
  if (ALLOWED_VOICES.includes(voiceId)) return voiceId;
  if (voiceId && (voiceId.startsWith("custom") || !ALLOWED_VOICES.includes(voiceId))) {
    const baseMatch = ALLOWED_VOICES.find((v) => voiceId.toLowerCase().includes(v.toLowerCase()));
    return baseMatch || "Joanna";
  }
  return "Joanna";
}

describe("Feature 2: Custom Themes (Server Task 7.3)", () => {
  it("returns 400 when isCustomTheme=true and theme > 100 chars", () => {
    const longTheme = "a".repeat(101);
    const result = validateStoryRequest({
      familyMembers: ["Maya"],
      theme: longTheme,
      isCustomTheme: true,
    });
    expect(result.status).toBe(400);
    expect(result.error).toContain("100 characters");
  });

  it("succeeds when a valid custom theme is passed", () => {
    const customTheme = "a cozy blanket fort with friendly mice";
    const result = validateStoryRequest({
      familyMembers: ["Maya", "Dad"],
      theme: customTheme,
      isCustomTheme: true,
    });
    expect(result.status).toBe(200);
    expect(result.prompt).toContain(customTheme);
  });
});

describe("Feature 3: Multiple Voices (Server Task 9.3)", () => {
  it("selects Matthew when voiceId: 'Matthew' is requested", () => {
    expect(resolveVoiceId("Matthew")).toBe("Matthew");
  });

  it("selects Emma when voiceId: 'Emma' is requested", () => {
    expect(resolveVoiceId("Emma")).toBe("Emma");
  });

  it("selects Ivy when voiceId: 'Ivy' is requested", () => {
    expect(resolveVoiceId("Ivy")).toBe("Ivy");
  });

  it("resolves custom voice with baseVoice specified", () => {
    expect(resolveVoiceId("custom_12345", "Matthew")).toBe("Matthew");
    expect(resolveVoiceId("custom_12345", "Emma")).toBe("Emma");
  });

  it("resolves custom voice with embedded tone in voiceId", () => {
    expect(resolveVoiceId("custom_matthew_17267000")).toBe("Matthew");
    expect(resolveVoiceId("custom_ivy_99999")).toBe("Ivy");
  });

  it("falls back to Joanna when an invalid voice id is requested", () => {
    expect(resolveVoiceId("InvalidVoice")).toBe("Joanna");
    expect(resolveVoiceId("")).toBe("Joanna");
    expect(resolveVoiceId(undefined)).toBe("Joanna");
  });
});

describe("Feature 4: Story Length Options (Server Task 11.3)", () => {
  it("returns 400 when storyLength is outside [4, 6, 8]", () => {
    expect(validateStoryRequest({ familyMembers: ["Maya"], storyLength: 3 }).status).toBe(400);
    expect(validateStoryRequest({ familyMembers: ["Maya"], storyLength: 5 }).status).toBe(400);
    expect(validateStoryRequest({ familyMembers: ["Maya"], storyLength: 10 }).status).toBe(400);
  });

  it("accepts storyLength of 4 and scales prompt and maxTokens to 600", () => {
    const res = validateStoryRequest({ familyMembers: ["Maya"], storyLength: 4 });
    expect(res.status).toBe(200);
    expect(res.prompt).toContain("(4 pages,");
    expect(res.prompt).toContain("JSON array of 4 strings");
    expect(res.maxTokens).toBe(600);
  });

  it("accepts storyLength of 6 and scales maxTokens to 800", () => {
    const res = validateStoryRequest({ familyMembers: ["Maya"], storyLength: 6 });
    expect(res.status).toBe(200);
    expect(res.prompt).toContain("(6 pages,");
    expect(res.prompt).toContain("JSON array of 6 strings");
    expect(res.maxTokens).toBe(800);
  });

  it("accepts storyLength of 8 and scales maxTokens to 1050", () => {
    const res = validateStoryRequest({ familyMembers: ["Maya"], storyLength: 8 });
    expect(res.status).toBe(200);
    expect(res.prompt).toContain("(8 pages,");
    expect(res.prompt).toContain("JSON array of 8 strings");
    expect(res.maxTokens).toBe(1050);
  });
});
