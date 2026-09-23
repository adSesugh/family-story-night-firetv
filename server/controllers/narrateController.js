import crypto from "crypto";
import { SynthesizeSpeechCommand } from "@aws-sdk/client-polly";
import { polly, streamToBuffer, POLLY_ENGINE } from "../services/pollyService.js";
import { VOICES } from "../constants/voices.js";
import { getNarration, saveNarration } from "../db.js";

const ALLOWED_VOICES = ["Joanna", "Matthew", "Emma", "Ivy"];

export const narrate = async (req, res) => {
  try {
    const { text, voiceId, baseVoice, speechMarks, storyId, pageIndex, deviceId: bodyDeviceId } = req.body;
    const deviceId = bodyDeviceId || req.headers["x-device-id"] || req.query.deviceId || null;

    console.log(`[narrate] Request received - voiceId: ${voiceId || "default"}, baseVoice: ${baseVoice || "none"}, textLength: ${text ? text.length : 0}, speechMarks: ${!!speechMarks}, storyId: ${storyId || "none"}`);

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

    // 1. Check SQLite database cache first
    const textHash = crypto.createHash("sha256").update(text.trim()).digest("hex");
    const cached = getNarration(textHash, selectedVoice);

    if (cached && cached.audioData) {
      console.log(`[narrate] ⚡ SQLite Cache HIT: Voice=${selectedVoice} (Page: ${pageIndex ?? "N/A"}) - 0 Polly API calls`);
      if (speechMarks) {
        return res.json({
          audio: cached.audioData,
          speechMarks: cached.speechMarks || [],
          cached: true,
        });
      }

      const base64Data = cached.audioData.replace(/^data:audio\/\w+;base64,/, "");
      const audioBuffer = Buffer.from(base64Data, "base64");
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Content-Length", audioBuffer.length);
      res.setHeader("X-Narration-Cached", "true");
      return res.end(audioBuffer);
    }

    // 2. Cache MISS: Synthesize speech via AWS Polly
    console.log(`[narrate] 🎙️ Cache MISS: Synthesizing voice via AWS Polly for voice: ${selectedVoice}`);
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

      const audioDataUrl = `data:audio/mpeg;base64,${audioBuffer.toString("base64")}`;

      // Persist synthesized narration to SQLite for instant history replay
      try {
        saveNarration({
          storyId,
          deviceId,
          pageIndex,
          voiceId: selectedVoice,
          textHash,
          audioData: audioDataUrl,
          speechMarks: parsedMarks,
        });
        console.log(`[narrate] 💾 Stored audio narration in SQLite database for ${selectedVoice}`);
      } catch (dbErr) {
        console.warn("[narrate] Failed to save narration to SQLite:", dbErr.message);
      }

      console.log(`[narrate] Successfully generated audio+marks for voice: ${selectedVoice}`);
      return res.json({
        audio: audioDataUrl,
        speechMarks: parsedMarks,
        cached: false,
      });
    }

    // Default: stream raw audio/mpeg for backward compatibility
    const response = await polly.send(audioCommand);
    const stream = response.AudioStream;
    const audioBuffer = await streamToBuffer(stream);

    const audioDataUrl = `data:audio/mpeg;base64,${audioBuffer.toString("base64")}`;
    try {
      saveNarration({
        storyId,
        deviceId,
        pageIndex,
        voiceId: selectedVoice,
        textHash,
        audioData: audioDataUrl,
        speechMarks: [],
      });
    } catch (dbErr) {
      console.warn("[narrate] Failed to save narration to SQLite:", dbErr.message);
    }

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", audioBuffer.length);
    res.end(audioBuffer);
    console.log(`[narrate] Successfully streamed audio for voice: ${selectedVoice}`);
  } catch (err) {
    console.error("narrate error:", err);
    res.status(500).json({ error: "Failed to narrate text" });
  }
};

