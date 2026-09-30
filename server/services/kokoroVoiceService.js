/**
 * Kokoro-82M Voice Service Client
 * Connects the Node.js backend to the local Python Kokoro Voice Microservice.
 */

// In-memory registry of voice IDs already synchronized/cached on the microservice
const syncedVoices = new Set();

export function clearSyncedVoices() {
  syncedVoices.clear();
}

export function markVoiceSynced(voiceId) {
  if (voiceId) syncedVoices.add(voiceId);
}

export function isVoiceSynced(voiceId) {
  return voiceId ? syncedVoices.has(voiceId) : false;
}

export async function synthesizeWithKokoro(
  text,
  voiceId = "af_bella",
  baseVoice = "Joanna",
  speed = 0.95,
  audioSample = null
) {
  const kokoroUrl = process.env.VOICE_SERVICE_URL || process.env.KOKORO_API_URL;
  if (!kokoroUrl) return null;

  const endpoint = `${kokoroUrl.replace(/\/+$/, "")}/synthesize`;
  
  // Only upload the heavy audio sample if the microservice does not already have it cached
  const isAlreadySynced = isVoiceSynced(voiceId);
  const sampleToSend = isAlreadySynced ? null : (audioSample || null);

  console.log(`[narrate] 🎙️ Routing speech to Voice Microservice: ${endpoint} (voice=${voiceId}, hasSample=${Boolean(sampleToSend)}, alreadySynced=${isAlreadySynced})`);

  let response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      text,
      voice_id: voiceId,
      base_voice: baseVoice,
      speed,
      audio_sample: sampleToSend,
    }),
  });

  // If failed with 404 or missing speaker wav, the microservice might have restarted; retry once with sample
  if (!response.ok && isAlreadySynced && audioSample) {
    console.warn(`[narrate] Voice '${voiceId}' reported missing on microservice (${response.status}). Re-syncing audio sample...`);
    syncedVoices.delete(voiceId);
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        text,
        voice_id: voiceId,
        base_voice: baseVoice,
        speed,
        audio_sample: audioSample,
      }),
    });
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Voice service error ${response.status}: ${errText.slice(0, 200)}`);
  }

  // Mark voice as successfully synchronized on microservice
  markVoiceSynced(voiceId);

  const data = await response.json();
  return {
    audioData: data.audio_base64,
    speechMarks: data.speech_marks || [],
    durationMs: data.duration_ms || 0,
    engine: data.engine || "kokoro-82m",
  };
}

export async function cloneVoiceWithKokoro({
  voiceId,
  name,
  role = "Family",
  baseVoice = "Joanna",
  audioSample = null,
  blendWeights = null,
}) {
  const kokoroUrl = process.env.VOICE_SERVICE_URL || process.env.KOKORO_API_URL;
  if (!kokoroUrl) return null;

  const endpoint = `${kokoroUrl.replace(/\/+$/, "")}/clone`;
  try {
    console.log(`[narrate] 🧬 Cloning/registering custom voice on Kokoro microservice: ${endpoint} (voice=${voiceId})`);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        voice_id: voiceId,
        name: name || `${role}'s Voice`,
        role,
        base_voice: baseVoice,
        blend_weights: blendWeights,
        audio_sample: audioSample || null,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.warn(`[kokoroVoiceService] Clone failed (${response.status}): ${errText.slice(0, 200)}`);
      return null;
    }

    markVoiceSynced(voiceId);
    return await response.json();
  } catch (err) {
    console.warn(`[kokoroVoiceService] Failed to contact Kokoro clone endpoint:`, err.message);
    return null;
  }
}

