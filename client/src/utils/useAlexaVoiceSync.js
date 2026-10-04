import { useState, useEffect, useRef } from "react";
import { StorageService } from "./storage";
import { getDeviceId } from "./device";

/**
 * Hook for syncing real-time voice commands from Alexa Skills Kit to Fire TV client.
 */
export function useAlexaVoiceSync({
  apiBase = "http://localhost:4000",
  onSetNames,
  onSetTheme,
  onStartStory,
  onNavigatePage,
  onToggleNarration,
  onOpenVoiceStudio,
  onSetVoice,
  enabled = true,
  pollIntervalMs = 1500,
} = {}) {
  const [pairingCode, setPairingCode] = useState(() => {
    return StorageService.getItem("familyStoryNight_alexa_code") || null;
  });
  const [isConnected, setIsConnected] = useState(false);
  const [lastVoiceAction, setLastVoiceAction] = useState(null);
  const currentIntervalRef = useRef(pollIntervalMs);
  useEffect(() => {
    currentIntervalRef.current = pollIntervalMs;
  }, [pollIntervalMs]);

  const onSetNamesRef = useRef(onSetNames);
  onSetNamesRef.current = onSetNames;

  const onSetThemeRef = useRef(onSetTheme);
  onSetThemeRef.current = onSetTheme;

  const onStartStoryRef = useRef(onStartStory);
  onStartStoryRef.current = onStartStory;

  const onNavigatePageRef = useRef(onNavigatePage);
  onNavigatePageRef.current = onNavigatePage;

  const onToggleNarrationRef = useRef(onToggleNarration);
  onToggleNarrationRef.current = onToggleNarration;

  const onOpenVoiceStudioRef = useRef(onOpenVoiceStudio);
  onOpenVoiceStudioRef.current = onOpenVoiceStudio;

  const onSetVoiceRef = useRef(onSetVoice);
  onSetVoiceRef.current = onSetVoice;

  const sessionIdRef = useRef(null);
  if (!sessionIdRef.current) {
    const existing = StorageService.getItem("familyStoryNight_alexa_session") || getDeviceId();
    sessionIdRef.current = existing;
    StorageService.setItem("familyStoryNight_alexa_session", existing);
  }

  useEffect(() => {
    if (!enabled || typeof fetch !== "function") return;

    let isMounted = true;
    let pollTimer = null;
    const sessionId = sessionIdRef.current;
    const preferredCode = StorageService.getItem("familyStoryNight_alexa_code") || undefined;

    // 1. Register or refresh session with backend
    fetch(`${apiBase}/alexa/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, preferredCode }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted || !data) return;
        setPairingCode(data.pairingCode);
        StorageService.setItem("familyStoryNight_alexa_code", data.pairingCode);
        setIsConnected(true);
      })
      .catch((err) => {
        console.warn("Could not register Alexa session:", err);
      });

    // 2. Poll for pending voice commands
    const pollForEvents = () => {
      fetch(`${apiBase}/alexa/events?sessionId=${encodeURIComponent(sessionId)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!isMounted) return;

          if (!data?.events?.length) {
            // No events: gradually increase interval up to 5 seconds to save battery/server
            currentIntervalRef.current = Math.min(currentIntervalRef.current + 500, 5000);
            return;
          }

          // Reset interval on activity
          currentIntervalRef.current = pollIntervalMs;
          setIsConnected(true);

          for (const event of data.events) {
            setLastVoiceAction(event);

            switch (event.type) {
              case "SET_NAMES":
                if (onSetNamesRef.current && event.names) {
                  onSetNamesRef.current(event.names);
                }
                break;

              case "SET_THEME":
                if (onSetThemeRef.current && event.theme) {
                  onSetThemeRef.current(event.theme);
                }
                break;

              case "START_STORY":
                if (onStartStoryRef.current) {
                  onStartStoryRef.current();
                }
                break;

              case "NAVIGATE_PAGE":
                if (onNavigatePageRef.current && event.direction) {
                  onNavigatePageRef.current(event.direction);
                }
                break;

              case "TOGGLE_NARRATION":
                if (onToggleNarrationRef.current) {
                  onToggleNarrationRef.current();
                }
                break;

              case "OPEN_VOICE_STUDIO":
                if (onOpenVoiceStudioRef.current) {
                  onOpenVoiceStudioRef.current({ role: event.role });
                }
                break;

              case "SET_VOICE":
                if (onSetVoiceRef.current && event.voice) {
                  onSetVoiceRef.current(event.voice);
                }
                break;

              default:
                break;
            }
          }
        })
        .catch(() => {
          if (isMounted) {
            // gracefully ignore network blips during polling
          }
        })
        .finally(() => {
          if (isMounted && enabled) {
            pollTimer = setTimeout(pollForEvents, currentIntervalRef.current);
          }
        });
    };

    pollTimer = setTimeout(pollForEvents, currentIntervalRef.current);

    return () => {
      isMounted = false;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [apiBase, enabled, pollIntervalMs]);

  return {
    pairingCode,
    isConnected,
    lastVoiceAction,
  };
}
