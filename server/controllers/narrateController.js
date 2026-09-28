import crypto from "crypto";
import { SynthesizeSpeechCommand } from "@aws-sdk/client-polly";
import { polly, streamToBuffer, POLLY_ENGINE } from "../services/pollyService.js";
import { VOICES } from "../constants/voices.js";
import { getNarration, saveNarration, getCustomVoiceById } from "../db.js";
import { synthesizeWithKokoro } from "../services/kokoroVoiceService.js";

const ALLOWED_VOICES = ["Joanna", "Matthew", "Emma", "Ivy"];

/**
 * Converts Polly UTF-8 byte offsets to JavaScript character string indices.
 * In Polly, 'start' and 'end' speech mark offsets are byte positions in UTF-8.
 * Whenever smart quotes, apostrophes, dashes, or non-ASCII characters appear,
 * byte offsets drift ahead of string character indices, causing karaoke desync.
 */
export function convertPollyMarksToCharIndices(text, marks) {
  if (!Array.isArray(marks) || marks.length === 0 || !text) return marks || [];
  const buf = Buffer.from(text, "utf8");
  return marks.map((m) => {
    if (typeof m.start !== "number" || typeof m.end !== "number") return m;
    // If slice directly matches, it was already converted
    if (text.slice(m.start, m.end) === m.value) return m;

    const charStart = buf.subarray(0, m.start).toString("utf8").length;
    const charEnd = buf.subarray(0, m.end).toString("utf8").length;
    return {
      ...m,
      start: charStart,
      end: charEnd,
    };
  });
}

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

    // Determine voice type: custom clone vs standard stock voice
    const isCustomVoice = Boolean(voiceId && (voiceId.startsWith("custom") || !ALLOWED_VOICES.includes(voiceId)));

    // Retrieve audio sample and metadata if this is a custom voice
    let customAudioSample = null;
    let customRole = "Family";
    if (isCustomVoice) {
      try {
        const cvRecord = getCustomVoiceById(voiceId);
        if (cvRecord) {
          customAudioSample = cvRecord.audioSample || cvRecord.audioDataUrl || null;
          customRole = cvRecord.role || customRole;
          if (cvRecord.baseVoice && ALLOWED_VOICES.includes(cvRecord.baseVoice)) {
            selectedVoice = cvRecord.baseVoice;
          }
        }
      } catch (cvErr) {
        console.warn(`[narrate] Could not load custom voice metadata for '${voiceId}':`, cvErr.message);
      }
    }

    const isKokoroVoice = Boolean(
      voiceId && (
        voiceId.startsWith("af_") ||
        voiceId.startsWith("am_") ||
        voiceId.startsWith("bf_") ||
        voiceId.startsWith("bm_") ||
        isCustomVoice
      )
    );
    const isKokoroEngine = (process.env.VOICE_ENGINE || "").toLowerCase() === "kokoro";
    const isMicroserviceVoice = isKokoroVoice || isKokoroEngine;

    // Use specific voiceId for caching so custom clones never collide with Joanna/Matthew
    const lookupVoice = voiceId || selectedVoice;

    // 1. Check SQLite database cache first (instant 0ms playback for previously synthesized pages)
    const textHash = crypto.createHash("sha256").update(text.trim()).digest("hex");
    const cached = getNarration(textHash, lookupVoice);

    if (cached && cached.audioData) {
      console.log(`[narrate] ⚡ SQLite Cache HIT: Voice=${lookupVoice} (Page: ${pageIndex ?? "N/A"}) - 0 API calls`);
      if (speechMarks) {
        const convertedCachedMarks = convertPollyMarksToCharIndices(text, cached.speechMarks || []);
        return res.json({
          audio: cached.audioData,
          speechMarks: convertedCachedMarks,
          cached: true,
          voiceId: lookupVoice,
        });
      }

      const base64Data = cached.audioData.replace(/^data:audio\/\w+;base64,/, "");
      const audioBuffer = Buffer.from(base64Data, "base64");
      const mime = cached.audioData.startsWith("data:audio/wav") ? "audio/wav" : "audio/mpeg";
      res.setHeader("Content-Type", mime);
      res.setHeader("Content-Length", audioBuffer.length);
      res.setHeader("X-Narration-Cached", "true");
      return res.end(audioBuffer);
    }

    // 2. Custom voice or Kokoro voice: Route exclusively to Voice Microservice (NEVER call AWS Polly)
    const kokoroUrl = process.env.KOKORO_VOICE_SERVICE_URL || process.env.KOKORO_API_URL;

    if (isMicroserviceVoice) {
      if (!kokoroUrl) {
        console.warn(`[narrate] Custom voice '${lookupVoice}' requested, but KOKORO_VOICE_SERVICE_URL is not set.`);
        return res.status(503).json({
          error: `Voice microservice is required for '${lookupVoice}', but KOKORO_VOICE_SERVICE_URL is not configured.`
        });
      }

      try {
        const kokoroResult = await synthesizeWithKokoro(
          text,
          lookupVoice,
          baseVoice || selectedVoice,
          0.95,
          customAudioSample
        );
        if (kokoroResult && kokoroResult.audioData) {
          // Persist to SQLite cache under actual voice ID
          try {
            saveNarration({
              storyId,
              deviceId,
              textHash,
              voiceId: lookupVoice,
              audioData: kokoroResult.audioData,
              speechMarks: kokoroResult.speechMarks,
              pageIndex,
            });
          } catch (dbErr) {
            console.warn("Could not cache Kokoro narration in DB:", dbErr.message);
          }

          if (speechMarks) {
            return res.json({
              audio: kokoroResult.audioData,
              speechMarks: kokoroResult.speechMarks,
              cached: false,
              engine: kokoroResult.engine || "xtts-v2",
              voiceId: lookupVoice,
            });
          }

          const base64Data = kokoroResult.audioData.replace(/^data:audio\/\w+;base64,/, "");
          const audioBuffer = Buffer.from(base64Data, "base64");
          res.setHeader("Content-Type", "audio/wav");
          res.setHeader("Content-Length", audioBuffer.length);
          res.setHeader("X-Voice-Engine", kokoroResult.engine || "xtts-v2");
          return res.end(audioBuffer);
        }
      } catch (kErr) {
        console.error(`[narrate] Kokoro voice microservice failed for '${lookupVoice}': ${kErr.message}. Skipping AWS Polly.`);
        return res.status(502).json({
          error: `Kokoro voice synthesis error: ${kErr.message}`,
        });
      }
    }

    // 3. AWS Polly - ONLY used for standard stock voices (Joanna, Matthew, Emma, Ivy) when not using Kokoro
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
          parsedMarks = convertPollyMarksToCharIndices(text, parsedMarks);
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

