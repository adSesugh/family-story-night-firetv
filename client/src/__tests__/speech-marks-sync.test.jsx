import { normalizeSpeechMarks, getActiveSpeechMarkAtTime } from "../utils/speechMarks";

describe("Speech Marks Normalization & Synchronization", () => {
  it("converts Polly UTF-8 byte offsets to JavaScript character indices when multi-byte punctuation exists", () => {
    const text = "“Hello world,” she whispered. It’s a sunny day—really!";
    // In Polly, “ is 3 bytes (chars: 1). It’s has ’ which is 3 bytes. day—really has — which is 3 bytes.
    const pollyByteMarks = [
      { time: 6, value: "Hello", start: 3, end: 8 },
      { time: 287, value: "world", start: 9, end: 14 },
      { time: 1070, value: "she", start: 19, end: 22 },
      { time: 1237, value: "whispered", start: 23, end: 32 },
      { time: 2218, value: "It’s", start: 34, end: 40 },
      { time: 2372, value: "a", start: 41, end: 42 },
      { time: 2420, value: "sunny", start: 43, end: 48 },
      { time: 2756, value: "day", start: 49, end: 52 },
      { time: 3398, value: "really", start: 55, end: 61 },
    ];

    const normalized = normalizeSpeechMarks(pollyByteMarks, text);

    expect(normalized).toHaveLength(pollyByteMarks.length);
    // Every sliced string using normalized start/end MUST exactly match the value
    normalized.forEach((m) => {
      const sliced = text.slice(m.start, m.end);
      expect(sliced).toBe(m.value);
    });
  });

  it("leaves already-character-indexed speech marks untouched", () => {
    const text = "Once upon a time";
    const charMarks = [
      { time: 10, value: "Once", start: 0, end: 4 },
      { time: 350, value: "upon", start: 5, end: 9 },
      { time: 700, value: "a", start: 10, end: 11 },
      { time: 900, value: "time", start: 12, end: 16 },
    ];

    const normalized = normalizeSpeechMarks(charMarks, text);
    expect(normalized[0].start).toBe(0);
    expect(normalized[0].end).toBe(4);
    expect(normalized[1].start).toBe(5);
    expect(normalized[1].end).toBe(9);
  });

  it("finds the exact active speech mark matching currentTimeMs", () => {
    const marks = [
      { time: 200, value: "Once", start: 0, end: 4 },
      { time: 600, value: "upon", start: 5, end: 9 },
      { time: 1500, value: "time", start: 10, end: 14 },
    ];

    // At 100ms (before first word)
    expect(getActiveSpeechMarkAtTime(marks, 100)).toBeNull();

    // At 250ms (during "Once")
    expect(getActiveSpeechMarkAtTime(marks, 250)?.value).toBe("Once");

    // At 650ms (during "upon")
    expect(getActiveSpeechMarkAtTime(marks, 650)?.value).toBe("upon");

    // At 1200ms (during natural pause between "upon" and "time", highlight clears)
    expect(getActiveSpeechMarkAtTime(marks, 1200)).toBeNull();

    // At 1550ms (during "time")
    expect(getActiveSpeechMarkAtTime(marks, 1550)?.value).toBe("time");
  });
});
