import React, { useState, useEffect, useRef, useCallback } from "react";
import SetupScreen from "./components/SetupScreen";
import StoryScreen from "./components/StoryScreen";
import HistoryScreen from "./components/HistoryScreen";
import SettingsScreen from "./components/SettingsScreen";
import { saveStory, updateStory, loadHistory } from "./utils/storyHistory";
import { StorageService } from "./utils/storage";
import { loadSettings } from "./utils/parentSettings";
import { trackEvent } from "./utils/analytics";
import { blobToDataUrl, compressBlobToDataUrl } from "./utils/imageUtils";

const API_BASE =
  (typeof process !== "undefined" && process.env && process.env.VITE_API_BASE) ||
  "http://localhost:4000";

const THEMES = [
  "a cozy adventure",
  "a magical treasure hunt",
  "a trip to outer space",
  "a friendly dragon's forest",
];

export default function App() {
  const [screen, setScreen] = useState("setup"); // setup | loading | story | history | settings
  const [names, setNames] = useState("");
  const [themeIndex, setThemeIndex] = useState(0);
  const [themeMode, setThemeMode] = useState("preset"); // preset | custom
  const [customTheme, setCustomTheme] = useState("");
  const [pages, setPages] = useState([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [error, setError] = useState(null);
  const [illustrations, setIllustrations] = useState([]);
  const [turnKey, setTurnKey] = useState(0); // bump to replay the page-turn animation
  const [history, setHistory] = useState([]);

  // Enhancements: Parent settings, voice, story length, analytics
  const [parentSettings, setParentSettings] = useState(() => loadSettings());
  const [voice, setVoice] = useState(() => {
    const stored = StorageService.getItem("familyStoryNight_voice");
    if (stored) return stored;
    const settings = loadSettings();
    return settings?.settings?.defaultVoice || "Joanna";
  });
  const [storyLength, setStoryLength] = useState(6);

  const audioRef = useRef(null);
  const storyStartTimeRef = useRef(null);

  // Load history on mount
  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const handleVoiceChange = useCallback((newVoice) => {
    setVoice(newVoice);
    StorageService.setItem("familyStoryNight_voice", newVoice);
  }, []);

  // Prime audio element during user gesture so browser permits autoplay after async operations
  const primeAudio = useCallback(() => {
    if (audioRef.current) {
      try {
        audioRef.current.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              if (audioRef.current) audioRef.current.pause();
            })
            .catch(() => {});
        }
      } catch (e) {
        // Ignore priming errors in environments without media support
      }
    }
  }, []);

  const generateStory = useCallback(async () => {
    setError(null);
    const startTime = Date.now();
    
    const familyMembers = names
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean);

    // Validate that at least one family member was provided
    if (familyMembers.length === 0) {
      setError("Please enter at least one family member name");
      return;
    }

    // Validate custom theme if in custom mode
    if (themeMode === "custom" && customTheme.trim() === "") {
      setError("Custom theme cannot be empty");
      return;
    }

    // Unlock audio context during initial user click before async API delay
    primeAudio();

    setScreen("loading");
    try {
      const activeTheme = themeMode === "custom" ? customTheme : THEMES[themeIndex];
      const res = await fetch(`${API_BASE}/generate-story`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          familyMembers,
          theme: activeTheme,
          isCustomTheme: themeMode === "custom",
          storyLength,
        }),
      });
      if (!res.ok) throw new Error("Story generation failed");
      const data = await res.json();
      const storyPages = data.pages || [];
      const genDuration = (Date.now() - startTime) / 1000;

      // 1. Fetch first illustration immediately so it displays as soon as the story screen opens
      let firstIllustrationDisplay = null;
      let firstIllustrationStored = null;
      try {
        const illRes = await fetch(`${API_BASE}/illustrate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: storyPages[0], theme: activeTheme, seed: 0 }),
        });
        if (illRes.ok) {
          const blob = await illRes.blob();
          firstIllustrationDisplay = (typeof URL.createObjectURL === "function" ? URL.createObjectURL(blob) : null) || await blobToDataUrl(blob);
          firstIllustrationStored = await compressBlobToDataUrl(blob);
        }
      } catch (illErr) {
        console.warn("First illustration fetch failed (graceful degradation):", illErr);
      }

      const initialIllustrations = firstIllustrationDisplay ? [firstIllustrationDisplay] : [];
      const storedIllustrations = firstIllustrationStored ? [firstIllustrationStored] : [];

      setPages(storyPages);
      setPageIndex(0);
      setTurnKey((k) => k + 1);
      setIllustrations(initialIllustrations);
      storyStartTimeRef.current = Date.now();
      setScreen("story");

      // Save story to history with the initial illustration
      const firstPage = storyPages[0];
      const savedStory = saveStory({
        familyMembers,
        theme: activeTheme,
        pages: storyPages.map((text, idx) => (
          idx === 0 && storedIllustrations[0]
            ? { text, illustration: { url: storedIllustrations[0], alt: `Illustration for page 1` } }
            : text
        )),
        illustrations: storedIllustrations,
        firstPage: typeof firstPage === "string" ? firstPage : firstPage.text,
      });
      // Reload history
      setHistory(loadHistory());

      // Track story generation analytics event (Req 7.1)
      trackEvent("story_generated", {
        familyMembers,
        theme: activeTheme,
        storyLength,
        voice,
        generationTime: genDuration,
      });

      // Fetch subsequent illustrations (page 1+) in background, updating UI & storage progressively
      (async () => {
        const currentDisplayUrls = [...initialIllustrations];
        const currentStoredUrls = [...storedIllustrations];

        for (let idx = 1; idx < storyPages.length; idx++) {
          try {
            // Respect API rate limits
            await new Promise((resolve) => setTimeout(resolve, 2000));

            const res = await fetch(`${API_BASE}/illustrate`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: storyPages[idx], theme: activeTheme, seed: idx * 1000 }),
            });
            if (res.ok) {
              const blob = await res.blob();
              const displayUrl = (typeof URL.createObjectURL === "function" ? URL.createObjectURL(blob) : null) || await blobToDataUrl(blob);
              const storedUrl = await compressBlobToDataUrl(blob);

              currentDisplayUrls[idx] = displayUrl;
              currentStoredUrls[idx] = storedUrl;

              // Immediately update UI state as each page's illustration arrives
              setIllustrations((prev) => {
                const next = [...prev];
                next[idx] = displayUrl;
                return next;
              });

              // Persist to localStorage immediately
              if (savedStory?.id) {
                updateStory(savedStory.id, {
                  illustrations: currentStoredUrls,
                  pages: storyPages.map((text, i) => (
                    currentStoredUrls[i]
                      ? { text: typeof text === "object" ? text.text : text, illustration: { url: currentStoredUrls[i], alt: `Illustration for page ${i + 1}` } }
                      : text
                  )),
                });
                setHistory(loadHistory());
              }
            }
          } catch (err) {
            console.error(`Failed to fetch illustration ${idx}:`, err);
          }
        }
      })();
    } catch (err) {
      console.error(err);
      setError("Couldn't reach the storyteller. Is the backend running?");
      setScreen("setup");
    }
  }, [names, themeIndex, themeMode, customTheme, storyLength, voice]);

  const turnTo = useCallback((next) => {
    setPageIndex(next);
    setTurnKey((k) => k + 1);
    trackEvent("page_viewed", { pageIndex: next, totalPages: pages.length });
  }, [pages.length]);

  const handleViewHistory = useCallback(() => {
    setScreen("history");
  }, []);

  const handleSelectStory = useCallback((story) => {
    primeAudio();
    setPages(story.pages);
    const restoredIllustrations =
      story.illustrations ||
      (Array.isArray(story.pages)
        ? story.pages.map((p) => (typeof p === "object" && p?.illustration?.url ? p.illustration.url : null))
        : []);
    setIllustrations(restoredIllustrations || []);
    setPageIndex(0);
    setTurnKey((k) => k + 1);
    storyStartTimeRef.current = Date.now();
    setScreen("story");
  }, [primeAudio]);

  const handleBackFromHistory = useCallback(() => {
    setScreen("setup");
  }, []);

  const handleOpenSettings = useCallback(() => {
    setScreen("settings");
  }, []);

  const handleBackFromSettings = useCallback(() => {
    setScreen("setup");
  }, []);

  const handleSettingsChange = useCallback((updated) => {
    setParentSettings(updated);
  }, []);

  const [isNarrating, setIsNarrating] = useState(false);

  useEffect(() => {
    if (!audioRef.current) return;
    const audio = audioRef.current;

    const onPlay = () => setIsNarrating(true);
    const onPause = () => setIsNarrating(false);

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
    };
  }, []);

  const handleToggleNarration = useCallback(() => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) {
      audioRef.current.play().catch(() => {});
    } else {
      audioRef.current.pause();
    }
  }, []);

  // Stop narration when leaving the story screen
  useEffect(() => {
    if (screen !== "story" && audioRef.current && typeof audioRef.current.pause === "function") {
      try {
        audioRef.current.pause();
      } catch (e) {
        // Ignore in environments where pause is not implemented
      }
    }
  }, [screen]);

  // Narrate current page whenever screen="story", page changes, or voice changes
  useEffect(() => {
    if (screen !== "story" || !pages || !pages[pageIndex]) return;
    let cancelled = false;

    (async () => {
      try {
        const currentPage = pages[pageIndex];
        const text = typeof currentPage === "object" ? currentPage.text : currentPage;
        if (!text) return;

        const res = await fetch(`${API_BASE}/narrate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voiceId: voice }),
        });
        if (!res.ok || cancelled) return;
        const blob = await res.blob();
        if (typeof URL.createObjectURL !== "function") return;
        const url = URL.createObjectURL(blob);
        if (audioRef.current && !cancelled) {
          if (typeof audioRef.current.pause === "function") {
            try { audioRef.current.pause(); } catch (e) {}
          }
          audioRef.current.src = url;
          if (typeof audioRef.current.load === "function") {
            try { audioRef.current.load(); } catch (e) {}
          }
          if (typeof audioRef.current.play === "function") {
            try {
              const playPromise = audioRef.current.play();
              if (playPromise !== undefined) {
                playPromise.catch((err) => {
                  console.warn("Audio autoplay blocked or interrupted:", err);
                });
              }
            } catch (e) {}
          }
        }
      } catch (err) {
        console.error("narration failed", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [screen, pageIndex, pages, voice]);

  useEffect(() => {
    if (!audioRef.current) return;

    const audio = audioRef.current;
    let turnTimer = null;

    const handleEnded = () => {
      if (screen !== "story") return;

      if (pageIndex >= pages.length - 1) {
        // Track story completed analytics event (Req 7.3)
        trackEvent("story_completed", {
          totalPages: pages.length,
          timeSpent: storyStartTimeRef.current ? Math.round((Date.now() - storyStartTimeRef.current) / 1000) : 0,
        });
        return;
      }

      turnTimer = setTimeout(() => {
        turnTo(pageIndex + 1);
      }, 1200);
    };

    audio.addEventListener("ended", handleEnded);
    return () => {
      audio.removeEventListener("ended", handleEnded);
      if (turnTimer) clearTimeout(turnTimer);
    };
  }, [screen, pageIndex, pages.length, turnTo]);

  // Fire TV remote & Gamepad controller event mapping
  // Supports: D-pad navigation (37, 38, 39, 40), Select/A/X/Y (13), Play/Pause (179), Rewind (227), Fast Forward (228), Back/Gamepad B (4, 8, 27)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isSelect = e.key === "Enter" || e.keyCode === 13 || e.which === 13;
      const isUp = e.key === "ArrowUp" || e.keyCode === 38 || e.which === 38;
      const isDown = e.key === "ArrowDown" || e.keyCode === 40 || e.which === 40;
      const isLeft = e.key === "ArrowLeft" || e.keyCode === 37 || e.which === 37;
      const isRight = e.key === "ArrowRight" || e.keyCode === 39 || e.which === 39;
      const isPlayPause = e.key === "MediaPlayPause" || e.keyCode === 179 || e.which === 179;
      const isRewind =
        e.key === "MediaRewind" ||
        e.key === "MediaTrackPrevious" ||
        e.keyCode === 227 ||
        e.which === 227;
      const isFastForward =
        e.key === "MediaFastForward" ||
        e.key === "MediaTrackNext" ||
        e.keyCode === 228 ||
        e.which === 228;
      const isBack =
        e.key === "GoBack" ||
        e.key === "Backspace" ||
        e.key === "Escape" ||
        e.keyCode === 4 ||
        e.which === 4 ||
        e.keyCode === 8 ||
        e.which === 8 ||
        e.keyCode === 27 ||
        e.which === 27;

      if (screen === "setup") {
        if (e.target?.tagName === "INPUT" || e.target?.tagName === "TEXTAREA") {
          if (isSelect) {
            e.preventDefault();
            generateStory();
          }
          return;
        }
        if (isDown) {
          e.preventDefault();
          setThemeIndex((i) => (i + 1) % THEMES.length);
        }
        if (isUp) {
          e.preventDefault();
          setThemeIndex((i) => (i - 1 + THEMES.length) % THEMES.length);
        }
        if (isSelect) {
          e.preventDefault();
          generateStory();
        }
      } else if (screen === "story") {
        if (isPlayPause) {
          e.preventDefault();
          handleToggleNarration();
          return;
        }
        if (isRight || isFastForward || isSelect) {
          e.preventDefault();
          if (pageIndex < pages.length - 1) turnTo(pageIndex + 1);
        } else if (isLeft || isRewind) {
          e.preventDefault();
          if (pageIndex > 0) turnTo(pageIndex - 1);
        } else if (isBack) {
          e.preventDefault();
          setScreen("setup");
        }
      } else if (screen === "history" || screen === "settings") {
        if (isBack) {
          e.preventDefault();
          setScreen("setup");
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [screen, pageIndex, pages.length, generateStory, turnTo, handleToggleNarration]);

  return (
    <div className="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-dusk text-parchment">
      <audio ref={audioRef} />

      {/* Single warm light source behind the page — the one deliberate visual moment */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[60vh] w-[60vh] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, #E8A33D 0%, transparent 70%)" }}
      />

      {screen === "setup" && (
        <SetupScreen
          names={names}
          setNames={setNames}
          themeIndex={themeIndex}
          setThemeIndex={setThemeIndex}
          themeMode={themeMode}
          setThemeMode={setThemeMode}
          customTheme={customTheme}
          setCustomTheme={setCustomTheme}
          error={error}
          onSubmit={generateStory}
          themes={THEMES}
          hasHistory={history.length > 0}
          onViewHistory={handleViewHistory}
          voice={voice}
          setVoice={handleVoiceChange}
          storyLength={storyLength}
          setStoryLength={setStoryLength}
          parentSettings={parentSettings}
          onOpenSettings={handleOpenSettings}
        />
      )}
      {screen === "loading" && <LoadingScreen />}
      {screen === "history" && (
        <HistoryScreen onSelect={handleSelectStory} onBack={handleBackFromHistory} />
      )}
      {screen === "settings" && (
        <SettingsScreen
          onBack={handleBackFromSettings}
          onSettingsChange={handleSettingsChange}
          voice={voice}
          setVoice={handleVoiceChange}
          themeMode={themeMode}
          setThemeMode={setThemeMode}
          customTheme={customTheme}
          setCustomTheme={setCustomTheme}
          themes={THEMES}
          themeIndex={themeIndex}
          setThemeIndex={setThemeIndex}
        />
      )}
      {screen === "story" && (
        <StoryScreen
          pages={pages}
          illustrations={illustrations}
          pageIndex={pageIndex}
          turnKey={turnKey}
          onTurn={turnTo}
          isNarrating={isNarrating}
          onToggleNarration={handleToggleNarration}
        />
      )}
    </div>
  );
}



function LoadingScreen() {
  return (
    <div className="relative z-10 text-center">
      <p className="font-serif text-4xl italic text-parchment/90">
        Turning up the lamp&hellip;
      </p>
      <p className="mt-4 font-sans text-lg text-starlight/70">
        Painting your illustrations&hellip;
      </p>
    </div>
  );
}
