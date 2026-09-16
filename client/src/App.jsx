import React, { useState, useEffect, useRef, useCallback } from "react";
import SetupScreen from "./components/SetupScreen";
import StoryScreen from "./components/StoryScreen";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

const THEMES = [
  "a cozy adventure",
  "a magical treasure hunt",
  "a trip to outer space",
  "a friendly dragon's forest",
];

export default function App() {
  const [screen, setScreen] = useState("setup"); // setup | loading | story
  const [names, setNames] = useState("");
  const [themeIndex, setThemeIndex] = useState(0);
  const [pages, setPages] = useState([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [error, setError] = useState(null);
  const [turnKey, setTurnKey] = useState(0); // bump to replay the page-turn animation
  const audioRef = useRef(null);

  const generateStory = useCallback(async () => {
    setError(null);
    
    const familyMembers = names
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean);

    // Validate that at least one family member was provided
    if (familyMembers.length === 0) {
      setError("Please enter at least one family member name");
      return;
    }

    setScreen("loading");
    try {
      const res = await fetch(`${API_BASE}/generate-story`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ familyMembers, theme: THEMES[themeIndex] }),
      });
      if (!res.ok) throw new Error("Story generation failed");
      const data = await res.json();
      setPages(data.pages || []);
      setPageIndex(0);
      setTurnKey((k) => k + 1);
      setScreen("story");
    } catch (err) {
      console.error(err);
      setError("Couldn't reach the storyteller. Is the backend running?");
      setScreen("setup");
    }
  }, [names, themeIndex]);

  const turnTo = useCallback((next) => {
    setPageIndex(next);
    setTurnKey((k) => k + 1);
  }, []);

  // Screen-change narration effect: handle initial story load (screen="story", pageIndex=0)
  // This effect triggers when screen changes to "story", ensuring narration plays on initial load
  // independent of the page-change narration effect below
  useEffect(() => {
    if (screen !== "story" || pageIndex !== 0 || !pages.length) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/narrate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: pages[0] }),
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
  }, [screen, pages]);

  // Narrate current page whenever it changes on the story screen (page 2+)
  // This effect handles page navigation after the initial load
  useEffect(() => {
    if (screen !== "story" || !pages[pageIndex]) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/narrate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: pages[pageIndex] }),
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
  }, [screen, pageIndex, pages]);

  useEffect(() => {
    if (!audioRef.current) return;

    const audio = audioRef.current;
    let turnTimer = null;

    const handleEnded = () => {
      if (screen !== "story" || pageIndex >= pages.length - 1) return;

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
          error={error}
          onSubmit={generateStory}
        />
      )}
      {screen === "loading" && <LoadingScreen />}
      {screen === "story" && (
        <StoryScreen pages={pages} pageIndex={pageIndex} turnKey={turnKey} onTurn={turnTo} />
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
    </div>
  );
}
