import React, { useState, useEffect, useRef, useCallback } from "react";
import SetupScreen from "./components/SetupScreen";
import StoryScreen from "./components/StoryScreen";
import HistoryScreen from "./components/HistoryScreen";
import SettingsScreen from "./components/SettingsScreen";
import { saveStory, loadHistory } from "./utils/storyHistory";
import { StorageService } from "./utils/storage";
import { loadSettings } from "./utils/parentSettings";
import { trackEvent } from "./utils/analytics";

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

      setPages(storyPages);
      setPageIndex(0);
      setTurnKey((k) => k + 1);
      setIllustrations([]); // clear previous
      storyStartTimeRef.current = Date.now();
      setScreen("story");

      // Track story generation analytics event (Req 7.1)
      trackEvent("story_generated", {
        familyMembers,
        theme: activeTheme,
        storyLength,
        voice,
        generationTime: genDuration,
      });

      // Save story to history
      const firstPage = storyPages[0];
      saveStory({
        familyMembers,
        theme: activeTheme,
        pages: storyPages,
        firstPage: typeof firstPage === "string" ? firstPage : firstPage.text,
      });
      // Reload history
      setHistory(loadHistory());

      // Fetch illustrations in background — sequential with delay to avoid rate limits
      (async () => {
        const urls = [];
        for (let idx = 0; idx < storyPages.length; idx++) {
          try {
            const res = await fetch(`${API_BASE}/illustrate`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: storyPages[idx], theme: activeTheme, seed: idx * 1000 }),
            });
            if (res.ok) {
              const blob = await res.blob();
              urls[idx] = URL.createObjectURL(blob);
            }
          } catch (err) {
            console.error(`Failed to fetch illustration ${idx}:`, err);
          }
          // Wait 2s between requests to avoid rate limiting
          if (idx < storyPages.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 6000));
          }
        }
        setIllustrations(urls);
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
    setPages(story.pages);
    setPageIndex(0);
    setTurnKey((k) => k + 1);
    storyStartTimeRef.current = Date.now();
    setScreen("story");
  }, []);

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

  // Screen-change narration effect: handle initial story load (screen="story", pageIndex=0)
  useEffect(() => {
    if (screen !== "story" || pageIndex !== 0 || !pages.length) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/narrate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: pages[0], voiceId: voice }),
        });
        if (!res.ok || cancelled) return;
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = url;
          audioRef.current.load();
          audioRef.current.play().catch(() => {});
        }
      } catch (err) {
        console.error("narration failed", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [screen, pages, voice]);

  // Narrate current page whenever it changes on the story screen (page 2+)
  useEffect(() => {
    if (screen !== "story" || !pages[pageIndex]) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/narrate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: pages[pageIndex], voiceId: voice }),
        });
        if (!res.ok || cancelled) return;
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = url;
          audioRef.current.load();
          audioRef.current.play().catch(() => {});
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

  // Fire TV remote maps to standard keyboard events (arrow keys, Enter, Back)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (screen === "setup") {
        if (e.key === "ArrowDown") setThemeIndex((i) => (i + 1) % THEMES.length);
        if (e.key === "ArrowUp") setThemeIndex((i) => (i - 1 + THEMES.length) % THEMES.length);
        if (e.key === "Enter") generateStory();
      } else if (screen === "story") {
        if (e.key === "ArrowRight" || e.key === "Enter") {
          if (pageIndex < pages.length - 1) turnTo(pageIndex + 1);
        }
        if (e.key === "ArrowLeft") {
          if (pageIndex > 0) turnTo(pageIndex - 1);
        }
        if (e.key === "Backspace" || e.key === "Escape") {
          setScreen("setup");
        }
      } else if (screen === "history" || screen === "settings") {
        if (e.key === "Backspace" || e.key === "Escape") {
          setScreen("setup");
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [screen, pageIndex, pages.length, generateStory, turnTo]);

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
        <StoryScreen pages={pages} illustrations={illustrations} pageIndex={pageIndex} turnKey={turnKey} onTurn={turnTo} />
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
