/**
 * Kokoro-82M Voice Service Client
 * Connects the Node.js backend to the local Python Kokoro Voice Microservice.
 */

export async function synthesizeWithKokoro(text, voiceId = "af_bella", baseVoice = "Joanna", speed = 0.95) {
  const kokoroUrl = process.env.KOKORO_VOICE_SERVICE_URL || process.env.KOKORO_API_URL;
  if (!kokoroUrl) return null;

  const endpoint = `${kokoroUrl.replace(/\/+$/, "")}/synthesize`;
  console.log(`[narrate] 🎙️ Routing speech to Kokoro-82M Voice Microservice: ${endpoint} (voice=${voiceId})`);

  const response = await fetch(endpoint, {
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
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Kokoro voice service error ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  return {
    audioData: data.audio_base64,
    speechMarks: data.speech_marks || [],
    durationMs: data.duration_ms || 0,
    engine: "kokoro-82m",
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
  const kokoroUrl = process.env.KOKORO_VOICE_SERVICE_URL || process.env.KOKORO_API_URL;
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

    return await response.json();
  } catch (err) {
    console.warn(`[kokoroVoiceService] Failed to contact Kokoro clone endpoint:`, err.message);
    return null;
  }
}

