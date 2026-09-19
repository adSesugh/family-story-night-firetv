import { SynthesizeSpeechCommand } from "@aws-sdk/client-polly";
import { polly, streamToBuffer, POLLY_ENGINE } from "../services/pollyService.js";
import { VOICES } from "../constants/voices.js";

const ALLOWED_VOICES = ["Joanna", "Matthew", "Emma", "Ivy"];

export const narrate = async (req, res) => {
  try {
    const { text, voiceId, baseVoice, speechMarks } = req.body;
    console.log(`[narrate] Request received - voiceId: ${voiceId || "default"}, baseVoice: ${baseVoice || "none"}, textLength: ${text ? text.length : 0}, speechMarks: ${!!speechMarks}`);

    if (!text) return res.status(400).json({ error: "text is required" });

    // Support custom family voice clones & tone matching
    let selectedVoice = "Joanna";
    if (baseVoice && ALLOWED_VOICES.includes(baseVoice)) {
      selectedVoice = baseVoice;
    } else if (ALLOWED_VOICES.includes(voiceId)) {
      selectedVoice = voiceId;
    } else if (voiceId && (voiceId.startsWith("custom") || !ALLOWED_VOICES.includes(voiceId))) {
      // Map to matching tone baseline if embedded (e.g. custom_matthew_...), or Joanna by default
      const baseMatch = ALLOWED_VOICES.find((v) => voiceId.toLowerCase().includes(v.toLowerCase()));
      selectedVoice = baseMatch || "Joanna";
      console.log(`[narrate] Custom family voice requested (${voiceId}). Synthesizing with baseline: ${selectedVoice}`);
    }

    const audioCommand = new SynthesizeSpeechCommand({
      Text: text,
      OutputFormat: "mp3",
      VoiceId: selectedVoice,
      Engine: POLLY_ENGINE,
    });

    if (speechMarks) {
      // Concurrently synthesize audio and word-level speech marks
      const marksCommand = new SynthesizeSpeechCommand({
        Text: text,
        OutputFormat: "json",
        SpeechMarkTypes: ["word"],
        VoiceId: selectedVoice,
        Engine: POLLY_ENGINE,
      });

      const [audioRes, marksRes] = await Promise.all([
        polly.send(audioCommand),
        polly.send(marksCommand).catch((err) => {
          console.warn("Failed to fetch Polly speech marks:", err?.message || err);
          return null;
        }),
      ]);

      const audioBuffer = await streamToBuffer(audioRes.AudioStream);

      let parsedMarks = [];
      if (marksRes && marksRes.AudioStream) {
        try {
          const marksBuffer = await streamToBuffer(marksRes.AudioStream);
          parsedMarks = marksBuffer
            .toString("utf-8")
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean)
            .map((l) => JSON.parse(l))
            .filter((m) => m.type === "word");
        } catch (mErr) {
          console.warn("Error parsing speech marks lines:", mErr);
        }
      }

      console.log(`[narrate] Successfully generated audio+marks for voice: ${selectedVoice}`);
      return res.json({
        audio: `data:audio/mpeg;base64,${audioBuffer.toString("base64")}`,
        speechMarks: parsedMarks,
      });
    }

    // Default: stream raw audio/mpeg for backward compatibility
    const response = await polly.send(audioCommand);
    res.setHeader("Content-Type", "audio/mpeg");

    const stream = response.AudioStream;
    for await (const chunk of stream) {
      res.write(chunk);
    }
    console.log(`[narrate] Successfully streamed audio for voice: ${selectedVoice}`);
    res.end();
  } catch (err) {
    console.error("narrate error:", err);
    res.status(500).json({ error: "Failed to narrate text" });
  }
};
