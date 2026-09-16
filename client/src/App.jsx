import React, { useState, useEffect, useRef, useCallback } from "react";

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
    setScreen("loading");
    try {
      const familyMembers = names
        .split(",")
        .map((n) => n.trim())
        .filter(Boolean);

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

  // Narrate current page whenever it changes on the story screen
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

function SetupScreen({ names, setNames, themeIndex, setThemeIndex, error, onSubmit }) {
  return (
    <div className="relative z-10 w-full max-w-2xl px-12">
      <p className="font-sans text-lg text-starlight">Family Story Night</p>
      <h1 className="mt-2 font-serif text-6xl leading-tight text-parchment">
        Who&rsquo;s in tonight&rsquo;s story?
      </h1>

      <input
        className="mt-10 w-full rounded-sm border-b-2 border-starlight/40 bg-transparent px-1 py-3 font-serif text-3xl text-parchment placeholder:text-starlight/50 focus:border-lamp focus:outline-none"
        value={names}
        onChange={(e) => setNames(e.target.value)}
        placeholder="Maya, Dad, Biscuit the dog"
        autoFocus
      />

      <div className="mt-8 flex items-center gap-4 font-sans text-base">
        <span className="text-starlight">Tonight&rsquo;s theme</span>
        <span className="text-parchment">{THEMES[themeIndex]}</span>
        <div className="flex gap-1">
          {THEMES.map((_, i) => (
            <button
              key={i}
              onClick={() => setThemeIndex(i)}
              className={`h-2 w-2 rounded-full transition-colors ${
                i === themeIndex ? "bg-lamp" : "bg-starlight/30"
              }`}
              aria-label={`Theme ${i + 1}`}
            />
          ))}
        </div>
        <span className="text-starlight/60">↑ / ↓ to change</span>
      </div>

      {error && <p className="mt-6 font-sans text-base text-red-300">{error}</p>}

      <button
        onClick={onSubmit}
        className="mt-10 rounded-sm bg-lamp px-8 py-3 font-sans text-lg font-medium text-dusk transition-transform hover:scale-[1.02] focus:outline-none"
      >
        Begin the story
      </button>
      <p className="mt-3 font-sans text-sm text-starlight/60">or press Enter</p>
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

function StoryScreen({ pages, pageIndex, turnKey, onTurn }) {
  const isLast = pageIndex === pages.length - 1;
  const isFirst = pageIndex === 0;

  return (
    <div className="relative z-10 flex w-full max-w-3xl flex-col items-center px-12">
      <div className="w-full rounded-sm bg-panel/60 px-16 py-14 shadow-2xl shadow-black/40 backdrop-blur-sm">
        <p key={turnKey} className="animate-page-in font-serif text-4xl leading-relaxed text-parchment">
          {pages[pageIndex]}
        </p>
      </div>

      <div className="mt-8 flex w-full items-center justify-between font-sans text-base text-starlight">
        <button
          onClick={() => !isFirst && onTurn(pageIndex - 1)}
          className={`transition-opacity ${isFirst ? "opacity-0" : "opacity-100 hover:text-parchment"}`}
        >
          ← Previous page
        </button>
        <span className="text-starlight/70">
          Page {pageIndex + 1} of {pages.length}
        </span>
        <button
          onClick={() => !isLast && onTurn(pageIndex + 1)}
          className={`transition-opacity ${isLast ? "opacity-0" : "opacity-100 hover:text-parchment"}`}
        >
          Next page →
        </button>
      </div>
    </div>
  );
}
