import React, { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Play, Square, X, Sparkles, Check, Heart, Volume2 } from "lucide-react";
import { saveCustomVoice, syncCustomVoiceToServer } from "../utils/customVoices";
import { getDeviceId, getUserId } from "../utils/device";

const API_BASE = (import.meta.env?.VITE_API_BASE || "http://localhost:4000").trim().replace(/\/+$/, "");

async function convertBlobToWavBase64(blob) {
  if (!blob) return "";
  try {
    if (typeof blob.arrayBuffer === "function") {
      const AudioContextClass = typeof window !== "undefined" ? (window.AudioContext || window.webkitAudioContext) : null;
      if (AudioContextClass) {
        const arrayBuffer = await blob.arrayBuffer();
        const audioCtx = new AudioContextClass();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        try { await audioCtx.close(); } catch (_) {}

        const channelData = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;
        const length = channelData.length;
        const buffer = new ArrayBuffer(44 + length * 2);
        const view = new DataView(buffer);

        const writeStr = (offset, str) => {
          for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
        };

        writeStr(0, "RIFF");
        view.setUint32(4, 36 + length * 2, true);
        writeStr(8, "WAVE");
        writeStr(12, "fmt ");
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true); // PCM
        view.setUint16(22, 1, true); // Mono
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeStr(36, "data");
        view.setUint32(40, length * 2, true);

        let offset = 44;
        for (let i = 0; i < length; i++, offset += 2) {
          const s = Math.max(-1, Math.min(1, channelData[i]));
          view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        }

        const wavBlob = new Blob([view], { type: "audio/wav" });
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result || "");
          reader.onerror = () => resolve("");
          reader.readAsDataURL(wavBlob);
        });
      }
    }
  } catch (err) {
    console.warn("WAV encoding note:", err);
  }

  if (typeof FileReader !== "undefined") {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result || "");
      reader.onerror = () => resolve("");
      reader.readAsDataURL(blob);
    });
  }
  return "";
}

const BEDTIME_READING_SCRIPT =
  "The stars are shining softly tonight. Close your eyes, little one, and listen to the quiet wind. A magical adventure is waiting in your dreams...";

const ROLE_OPTIONS = ["Mom", "Dad", "Grandma", "Grandpa", "Aunt", "Uncle", "Sister", "Brother", "Family"];

const BASELINE_VOICE_OPTIONS = [
  { id: "Joanna", label: "Warm Soprano (Gentle & Calming)", desc: "Best for soothing, peaceful bedtime reading" },
  { id: "Matthew", label: "Deep Baritone (Calm & Reassuring)", desc: "Best for deep, comforting, grounded presence" },
  { id: "Emma", label: "Lively Alto (Expressive & Engaging)", desc: "Best for playful, expressive family storytellers" },
  { id: "Ivy", label: "Bright Cadence (Sweet & Youthful)", desc: "Best for lighter, cheerful bedtime pacing" },
];

export default function FamilyVoiceStudioModal({ isOpen, onClose, onVoiceCreated, defaultRole = "Mom" }) {
  const [role, setRole] = useState(defaultRole);
  const [voiceName, setVoiceName] = useState(`${defaultRole}'s Bedtime Voice`);
  const [baseVoice, setBaseVoice] = useState(
    defaultRole.toLowerCase().includes("dad") || defaultRole.toLowerCase().includes("grandpa") || defaultRole.toLowerCase().includes("uncle")
      ? "Matthew"
      : "Joanna"
  );
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioBlobBase64, setAudioBlobBase64] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioBlobRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const audioPlayerRef = useRef(null);

  // Auto-update voiceName default when role changes if name hasn't been heavily customized
  const handleRoleChange = (newRole) => {
    setRole(newRole);
    if (!voiceName || voiceName.includes("'s Bedtime Voice") || voiceName.includes("'s Voice")) {
      setVoiceName(`${newRole}'s Bedtime Voice`);
    }
    if (newRole.toLowerCase().includes("dad") || newRole.toLowerCase().includes("grandpa") || newRole.toLowerCase().includes("uncle")) {
      setBaseVoice("Matthew");
    } else {
      setBaseVoice("Joanna");
    }
  };

  useEffect(() => {
    if (isOpen && defaultRole) {
      handleRoleChange(defaultRole);
    }
  }, [isOpen, defaultRole]);

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  if (!isOpen) return null;

  const startRecording = async () => {
    setErrorMessage(null);
    setAudioUrl(null);
    setAudioBlobBase64("");
    audioBlobRef.current = null;
    audioChunksRef.current = [];

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMessage("Microphone access is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      let mimeType = "";
      if (typeof MediaRecorder !== "undefined" && typeof MediaRecorder.isTypeSupported === "function") {
        if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
          mimeType = "audio/webm;codecs=opus";
        } else if (MediaRecorder.isTypeSupported("audio/webm")) {
          mimeType = "audio/webm";
        } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
          mimeType = "audio/mp4";
        }
      }

      const mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const effectiveType = mediaRecorder.mimeType || mimeType || "audio/webm";
        const audioBlob = new Blob(audioChunksRef.current, { type: effectiveType });
        audioBlobRef.current = audioBlob;
        const localUrl = URL.createObjectURL(audioBlob);
        setAudioUrl(localUrl);

        // Convert to WAV base64
        try {
          const wavB64 = await convertBlobToWavBase64(audioBlob);
          if (wavB64) setAudioBlobBase64(wavB64);
        } catch (_) {
          if (typeof FileReader !== "undefined") {
            const reader = new FileReader();
            reader.onloadend = () => {
              setAudioBlobBase64(reader.result || "");
            };
            reader.readAsDataURL(audioBlob);
          }
        }

        // Stop all tracks to release mic
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(200);
      setIsRecording(true);
      setRecordingSeconds(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 45) {
            stopRecording();
            return 45;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.warn("Could not access microphone:", err);
      setErrorMessage("Microphone permission was denied. Please allow microphone access to record your voice.");
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const togglePlayback = () => {
    if (!audioUrl) return;
    if (isPlaying && audioPlayerRef.current) {
      try { audioPlayerRef.current.pause(); } catch (e) {}
      audioPlayerRef.current.currentTime = 0;
      setIsPlaying(false);
    } else if (audioPlayerRef.current) {
      try {
        const playPromise = audioPlayerRef.current.play();
        if (playPromise && typeof playPromise.then === "function") {
          playPromise
            .then(() => setIsPlaying(true))
            .catch((err) => {
              console.warn("Audio preview playback rejected:", err);
              setIsPlaying(false);
            });
        } else {
          setIsPlaying(true);
        }
      } catch (err) {
        console.warn("Playback error:", err);
        setIsPlaying(false);
      }
    }
  };

  const handleSave = async () => {
    let finalAudio = audioBlobBase64;
    if (audioBlobRef.current && (!finalAudio || !finalAudio.startsWith("data:audio/wav"))) {
      try {
        const converted = await convertBlobToWavBase64(audioBlobRef.current);
        if (converted) finalAudio = converted;
      } catch (e) {
        console.warn("Failed to encode recorded audio blob:", e);
      }
    }

    if (!finalAudio && audioBlobRef.current && typeof FileReader !== "undefined") {
      try {
        finalAudio = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result || "");
          reader.onerror = () => resolve("");
          reader.readAsDataURL(audioBlobRef.current);
        });
      } catch (e) {
        console.warn("Failed to encode recorded audio blob:", e);
      }
    }

    const saved = saveCustomVoice({
      name: voiceName || `${role}'s Voice`,
      role,
      baseVoice,
      audioDataUrl: finalAudio || "",
    });

    if (saved) {
      syncCustomVoiceToServer(API_BASE, getDeviceId(), getUserId(), saved);
      if (onVoiceCreated) onVoiceCreated(saved);
      onClose();
    } else {
      setErrorMessage("Could not save custom voice. Please try again.");
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="voice-studio-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-night/85 backdrop-blur-md animate-fade-in"
    >
      <div className="relative flex flex-col w-full max-w-xl max-h-[90vh] bg-panel/95 border border-lamp/30 rounded-2xl shadow-2xl shadow-black/70 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-starlight/15 bg-dusk/60">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-lamp/20 text-lamp">
              <Heart className="w-4 h-4 fill-lamp text-lamp" />
            </div>
            <div>
              <h2 id="voice-studio-title" className="font-serif text-lg sm:text-xl font-bold text-parchment">
                Family Voice Studio
              </h2>
              <p className="text-[11px] sm:text-xs text-starlight/70 font-sans">
                Record a loved one&apos;s voice for bedtime stories
              </p>
            </div>
          </div>
          <button
            type="button"
            data-testid="close-voice-studio-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-starlight/70 hover:text-parchment hover:bg-starlight/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-red-200 text-xs font-sans">
              {errorMessage}
            </div>
          )}

          {/* Step 1: Who is recording? */}
          <div>
            <label className="block font-sans text-xs font-semibold uppercase tracking-wider text-lamp mb-2">
              1. Who is recording?
            </label>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {ROLE_OPTIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleRoleChange(r)}
                  className={`px-3 py-1 rounded-full text-xs font-sans font-medium transition-all cursor-pointer ${
                    role === r
                      ? "bg-lamp text-night shadow-md font-bold scale-105"
                      : "bg-dusk/70 text-starlight/80 border border-starlight/20 hover:border-lamp/40"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <input
              type="text"
              data-testid="voice-name-input"
              value={voiceName}
              onChange={(e) => setVoiceName(e.target.value)}
              placeholder="e.g. Mom's Bedtime Voice"
              className="w-full px-3.5 py-2 rounded-xl bg-dusk/80 border border-starlight/25 text-parchment text-sm font-sans focus:outline-none focus:border-lamp focus:ring-1 focus:ring-lamp"
            />
          </div>

          {/* Step 2: Bedtime Reading Prompt */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-sans text-xs font-semibold uppercase tracking-wider text-lamp">
                2. Read this bedtime passage aloud
              </label>
              <span className="text-[10px] text-starlight/60 font-sans">15–30 seconds</span>
            </div>
            <div className="p-3.5 sm:p-4 rounded-xl bg-dusk/90 border border-lamp/30 shadow-inner">
              <p className="font-serif text-sm sm:text-base italic text-parchment/95 leading-relaxed text-center">
                &ldquo;{BEDTIME_READING_SCRIPT}&rdquo;
              </p>
            </div>
          </div>

          {/* Step 3: Record Voice Sample */}
          <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-dusk/50 border border-starlight/15">
            {isRecording ? (
              <div className="flex flex-col items-center gap-2.5">
                <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-red-500/20 border-2 border-red-500 animate-pulse">
                  <Mic className="w-7 h-7 text-red-400" />
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                  </span>
                </div>
                <div className="font-sans text-xs text-parchment font-semibold">
                  Recording... <span className="text-lamp">{recordingSeconds}s</span> / 45s
                </div>
                <button
                  type="button"
                  data-testid="stop-recording-btn"
                  onClick={stopRecording}
                  className="px-4 py-1.5 rounded-full bg-red-500 text-white font-sans text-xs font-bold shadow-lg hover:bg-red-600 transition-all cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5 inline mr-1.5 fill-current" />
                  Finish Recording
                </button>
              </div>
            ) : audioUrl ? (
              <div className="flex flex-col items-center gap-3 w-full">
                <div className="flex items-center gap-2 text-emerald-400 font-sans text-xs font-semibold">
                  <Check className="w-4 h-4" />
                  <span>Voice sample recorded ({recordingSeconds || 15} seconds)</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    data-testid="preview-recording-btn"
                    onClick={togglePlayback}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-lamp text-night font-sans text-xs font-bold shadow-md hover:bg-lamp/90 cursor-pointer"
                  >
                    {isPlaying ? (
                      <>
                        <Square className="w-3.5 h-3.5 fill-current" />
                        <span>Stop Listening</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Play Sample</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={startRecording}
                    className="px-3 py-2 rounded-full text-starlight/70 hover:text-parchment text-xs font-sans transition-colors cursor-pointer"
                  >
                    Re-record
                  </button>
                </div>
                <audio
                  ref={audioPlayerRef}
                  src={audioUrl}
                  onEnded={() => setIsPlaying(false)}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2.5">
                <button
                  type="button"
                  data-testid="start-recording-btn"
                  onClick={startRecording}
                  className="flex items-center justify-center w-16 h-16 rounded-full bg-lamp/20 border-2 border-lamp text-lamp hover:bg-lamp hover:text-night transition-all shadow-lg shadow-lamp/20 cursor-pointer group"
                >
                  <Mic className="w-7 h-7 group-hover:scale-110 transition-transform" />
                </button>
                <span className="font-sans text-xs text-starlight/80 font-medium">
                  Tap microphone to begin speaking
                </span>
              </div>
            )}
          </div>

          {/* Step 4: Baseline Voice Pairing */}
          <div>
            <label className="block font-sans text-xs font-semibold uppercase tracking-wider text-lamp mb-1.5">
              3. Match Voice Tone
            </label>
            <p className="text-[11px] text-starlight/60 font-sans mb-2">
              Select the natural pitch profile that best matches your voice for smooth bedtime synthesis.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {BASELINE_VOICE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setBaseVoice(opt.id)}
                  className={`flex flex-col text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
                    baseVoice === opt.id
                      ? "bg-panel border-lamp ring-2 ring-lamp/70 shadow-sm"
                      : "bg-dusk/60 border-starlight/20 hover:border-starlight/40"
                  }`}
                >
                  <span className="font-sans text-xs font-bold text-parchment">{opt.label}</span>
                  <span className="font-sans text-[10px] text-starlight/60 mt-0.5">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-3.5 border-t border-starlight/15 bg-dusk/80">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-starlight/80 hover:text-parchment text-xs font-sans transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="save-voice-clone-btn"
            onClick={handleSave}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-lamp text-night font-sans text-xs font-bold hover:bg-lamp/90 shadow-lg shadow-lamp/30 transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 fill-current" />
            <span>Save Voice Clone</span>
          </button>
        </div>
      </div>
    </div>
  );
}
