import React, { useState, useEffect, useRef, useCallback } from "react";
import SetupScreen from "./components/SetupScreen";
import StoryScreen from "./components/StoryScreen";
import HistoryScreen from "./components/HistoryScreen";
import SettingsScreen from "./components/SettingsScreen";
import { saveStory, updateStory, loadHistory } from "./utils/storyHistory";
import { StorageService } from "./utils/storage";
import { loadSettings } from "./utils/parentSettings";
import { trackEvent } from "./utils/analytics";
import { blobToDataUrl, compressBlobToDataUrl, createFallbackIllustrationUrl } from "./utils/imageUtils";
import { playBedtimeLullabyChime } from "./utils/audioChimes";

import { THEME_CATEGORIES, DEFAULT_CATEGORY_ID, THEMES } from "./constants/themes";

const API_BASE =
  (typeof process !== "undefined" && process.env && process.env.VITE_API_BASE) ||
  "http://localhost:4000";

export default function App() {
  const [screen, setScreen] = useState("setup"); // setup | loading | story | history | settings
  const [names, setNames] = useState("");
  const [category, setCategory] = useState(DEFAULT_CATEGORY_ID);
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
  const [lesson, setLesson] = useState("");
  const [choices, setChoices] = useState([]);
  const [chapter, setChapter] = useState(1);
  const [activeStoryChapters, setActiveStoryChapters] = useState([]);
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);
  const [activeChoiceTitle, setActiveChoiceTitle] = useState("");
  const [conclusionFocusIndex, setConclusionFocusIndex] = useState(0);
  const [currentStoryId, setCurrentStoryId] = useState(null);
  const [activeStoryMetadata, setActiveStoryMetadata] = useState(null); // { theme, familyMembers, category }

  const currentCategory = THEME_CATEGORIES.find((c) => c.id === category) || THEME_CATEGORIES[0];
  const activeThemes = currentCategory.themes;

  const audioRef = useRef(null);
  const storyStartTimeRef = useRef(null);
  const illustrationSessionRef = useRef(0);
  const turnTimerRef = useRef(null);
  const isPrimingAudioRef = useRef(false);

  // Load history on mount
  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const handleVoiceChange = useCallback((newVoice) => {
    setVoice(newVoice);
    StorageService.setItem("familyStoryNight_voice", newVoice);
  }, []);

  // Fast concurrent illustration fetching orchestrator with retries and guaranteed fallback
  const fetchSubsequentIllustrations = useCallback(
    async ({
      storyPages,
      activeTheme,
      seedBase,
      initialIllustrations,
      initialStored,
      savedStoryId,
      sessionId,
      targetChapterIndex = 0,
    }) => {
      const currentDisplayUrls = [...initialIllustrations];
      const currentStoredUrls = [...initialStored];

      const pendingIndices = [];
      for (let i = 1; i < storyPages.length; i++) {
        pendingIndices.push(i);
      }
      if (pendingIndices.length === 0) return;

      const fetchPage = async (idx) => {
        if (illustrationSessionRef.current !== sessionId) return;

        let displayUrl = null;
        let storedUrl = null;

        for (let attempt = 0; attempt < 2; attempt++) {
          if (illustrationSessionRef.current !== sessionId) return;
          try {
            const rawPage = storyPages[idx];
            const pageText = typeof rawPage === "object" ? rawPage.text : rawPage;
            const pageScene = typeof rawPage === "object" ? rawPage.scene : undefined;
            const res = await fetch(`${API_BASE}/illustrate`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                text: pageText,
                scene: pageScene,
                theme: activeTheme,
                seed: seedBase + idx * 1000,
              }),
            });

            if (res.ok) {
              const blob = await res.blob();
              displayUrl =
                (typeof URL.createObjectURL === "function" ? URL.createObjectURL(blob) : null) ||
                (await blobToDataUrl(blob));
              storedUrl = await compressBlobToDataUrl(blob);
              break;
            }
          } catch (err) {
            console.warn(`Illustration attempt ${attempt + 1} failed for page ${idx + 1}:`, err);
            if (attempt === 0) {
              await new Promise((r) => setTimeout(r, 600));
            }
          }
        }

        // Guaranteed fallback if fetch failed so the page is never left empty
        if (!displayUrl) {
          const fallback = createFallbackIllustrationUrl(activeTheme, idx + 1);
          displayUrl = fallback;
          storedUrl = fallback;
        }

        if (illustrationSessionRef.current !== sessionId) return;

        currentDisplayUrls[idx] = displayUrl;
        currentStoredUrls[idx] = storedUrl;

        // Immediately update UI state as each page's illustration arrives
        setIllustrations((prev) => {
          const next = [...prev];
          next[idx] = displayUrl;
          return next;
        });

        // Update activeStoryChapters for current chapter
        setActiveStoryChapters((prev) => {
          if (!prev || prev.length === 0) return prev;
          const next = [...prev];
          if (next[targetChapterIndex]) {
            next[targetChapterIndex] = {
              ...next[targetChapterIndex],
              illustrations: currentStoredUrls,
              pages: storyPages.map((p, i) => {
                const text = typeof p === "object" ? p.text : p;
                const scene = typeof p === "object" ? p.scene : undefined;
                return currentStoredUrls[i]
                  ? {
                      text,
                      scene,
                      illustration: { url: currentStoredUrls[i], alt: `Illustration for page ${i + 1}` },
                    }
                  : { text, scene };
              }),
            };
          }
          return next;
        });

        // Persist to localStorage immediately
        if (savedStoryId) {
          const latestStories = loadHistory();
          const currentStory = latestStories.find((s) => s.id === savedStoryId);
          const existingChapters = currentStory?.chapters || [];
          const updatedChapters = existingChapters.map((ch, cIdx) => {
            if (cIdx === targetChapterIndex) {
              return {
                ...ch,
                illustrations: currentStoredUrls,
                pages: storyPages.map((p, i) => {
                  const text = typeof p === "object" ? p.text : p;
                  const scene = typeof p === "object" ? p.scene : undefined;
                  return currentStoredUrls[i]
                    ? {
                        text,
                        scene,
                        illustration: { url: currentStoredUrls[i], alt: `Illustration for page ${i + 1}` },
                      }
                    : { text, scene };
                }),
              };
            }
            return ch;
          });

          updateStory(savedStoryId, {
            illustrations: currentStoredUrls,
            pages: storyPages.map((p, i) => {
              const text = typeof p === "object" ? p.text : p;
              const scene = typeof p === "object" ? p.scene : undefined;
              return currentStoredUrls[i]
                ? {
                    text,
                    scene,
                    illustration: { url: currentStoredUrls[i], alt: `Illustration for page ${i + 1}` },
                  }
                : { text, scene };
            }),
            chapters: updatedChapters.length > 0 ? updatedChapters : undefined,
          });
          setHistory(loadHistory());
        }
      };

      // Concurrent worker pool: 2 requests in parallel for rapid generation without blocking
      const CONCURRENCY = 2;
      let nextQueueIndex = 0;

      const worker = async () => {
        while (nextQueueIndex < pendingIndices.length) {
          if (illustrationSessionRef.current !== sessionId) return;
          const idx = pendingIndices[nextQueueIndex++];
          await fetchPage(idx);
        }
      };

      const workerCount = Math.min(CONCURRENCY, pendingIndices.length);
      const workers = Array.from({ length: workerCount }, () => worker());
      await Promise.all(workers);
    },
    []
  );

  const PRIMING_AUDIO_SRC = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

  // Prime audio element during user gesture so browser permits autoplay after async operations
  const primeAudio = useCallback(() => {
    if (audioRef.current) {
      try {
        isPrimingAudioRef.current = true;
        audioRef.current.src = PRIMING_AUDIO_SRC;
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              if (
                audioRef.current &&
                audioRef.current.src &&
                (audioRef.current.src === PRIMING_AUDIO_SRC || audioRef.current.src.includes("data:audio/wav"))
              ) {
                audioRef.current.pause();
                audioRef.current.removeAttribute("src");
              }
              isPrimingAudioRef.current = false;
            })
            .catch(() => {
              isPrimingAudioRef.current = false;
            });
        }
      } catch (e) {
        isPrimingAudioRef.current = false;
      }
    }
  }, []);

  const generateStory = useCallback(async () => {
    setError(null);
    const startTime = Date.now();
    const currentSessionId = ++illustrationSessionRef.current;
    
    const familyMembers = names
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean);

    const isBibleCategory = category === "bible";

    // Validate that at least one family member was provided (optional for Bible stories)
    if (familyMembers.length === 0 && !isBibleCategory) {
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
    setChapter(1);
    setActiveChoiceTitle("");
    try {
      const activeTheme = themeMode === "custom" ? customTheme : (activeThemes[themeIndex] || activeThemes[0]);
      const res = await fetch(`${API_BASE}/generate-story`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          familyMembers,
          theme: activeTheme,
          isCustomTheme: themeMode === "custom",
          storyLength,
          chapter: 1,
          category,
        }),
      });
      if (!res.ok) throw new Error("Story generation failed");
      const data = await res.json();
      const storyPages = data.pages || [];
      const storyLesson = data.lesson || "";
      const storyChoices = data.choices || [];
      const storyChapter = data.chapter || 1;
      const genDuration = (Date.now() - startTime) / 1000;

      const firstRaw = storyPages[0];
      const firstPageText = typeof firstRaw === "object" ? firstRaw.text : firstRaw;
      const firstPageScene = typeof firstRaw === "object" ? firstRaw.scene : undefined;

      // 1. Fetch first illustration immediately so it displays as soon as the story screen opens
      let firstIllustrationDisplay = null;
      let firstIllustrationStored = null;
      try {
        const illRes = await fetch(`${API_BASE}/illustrate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: firstPageText,
            scene: firstPageScene,
            theme: activeTheme,
            seed: 0,
          }),
        });
        if (illRes.ok) {
          const blob = await illRes.blob();
          firstIllustrationDisplay = (typeof URL.createObjectURL === "function" ? URL.createObjectURL(blob) : null) || await blobToDataUrl(blob);
          firstIllustrationStored = await compressBlobToDataUrl(blob);
        }
      } catch (illErr) {
        console.warn("First illustration fetch failed (graceful degradation):", illErr);
      }

      if (!firstIllustrationDisplay && storyPages.length > 0) {
        const fallback = createFallbackIllustrationUrl(activeTheme, 1);
        firstIllustrationDisplay = fallback;
        firstIllustrationStored = fallback;
      }

      const initialIllustrations = firstIllustrationDisplay ? [firstIllustrationDisplay] : [];
      const storedIllustrations = firstIllustrationStored ? [firstIllustrationStored] : [];

      setPages(storyPages);
      setLesson(storyLesson);
      setChoices(storyChoices);
      setChapter(storyChapter);
      setPageIndex(0);
      setTurnKey((k) => k + 1);
      setIllustrations(initialIllustrations);
      storyStartTimeRef.current = Date.now();
      setScreen("story");

      const formattedPages = storyPages.map((p, idx) => {
        const text = typeof p === "object" ? p.text : p;
        const scene = typeof p === "object" ? p.scene : undefined;
        return idx === 0 && storedIllustrations[0]
          ? { text, scene, illustration: { url: storedIllustrations[0], alt: `Illustration for page 1` } }
          : { text, scene };
      });

      const initialChapterData = {
        chapter: storyChapter,
        pages: formattedPages,
        illustrations: storedIllustrations,
        lesson: storyLesson,
        choices: storyChoices,
      };

      setActiveStoryChapters([initialChapterData]);
      setActiveChapterIndex(0);

      // Save story to history with the initial illustration
      const savedStory = saveStory({
        familyMembers,
        theme: activeTheme,
        category,
        pages: formattedPages,
        illustrations: storedIllustrations,
        firstPage: typeof firstRaw === "string" ? firstRaw : firstRaw?.text || "",
        lesson: storyLesson,
        choices: storyChoices,
        chapter: storyChapter,
        chapters: [initialChapterData],
      });

      setCurrentStoryId(savedStory?.id || null);
      setActiveStoryMetadata({
        theme: activeTheme,
        familyMembers,
        category,
      });

      // Reload history
      setHistory(loadHistory());

      // Track story generation analytics event (Req 7.1)
      trackEvent("story_generated", {
        familyMembers,
        theme: activeTheme,
        storyLength,
        voice,
        category,
        generationTime: genDuration,
      });

      // Fetch subsequent illustrations (page 1+) concurrently with retries & fallbacks
      fetchSubsequentIllustrations({
        storyPages,
        activeTheme,
        seedBase: 0,
        initialIllustrations,
        initialStored: storedIllustrations,
        savedStoryId: savedStory?.id,
        sessionId: currentSessionId,
        targetChapterIndex: 0,
      });
    } catch (err) {
      console.error(err);
      setError("Couldn't reach the storyteller. Is the backend running?");
      setScreen("setup");
    }
  }, [names, themeIndex, themeMode, customTheme, storyLength, voice, category, activeThemes]);

  const turnTo = useCallback((next) => {
    if (turnTimerRef.current) {
      clearTimeout(turnTimerRef.current);
      turnTimerRef.current = null;
    }
    setPageIndex(next);
    setTurnKey((k) => k + 1);
    if (next >= pages.length) {
      setConclusionFocusIndex(0);
    }
    trackEvent("page_viewed", { pageIndex: next, totalPages: pages.length });
  }, [pages.length]);

  const handleViewHistory = useCallback(() => {
    if (turnTimerRef.current) {
      clearTimeout(turnTimerRef.current);
      turnTimerRef.current = null;
    }
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.removeAttribute("src");
      } catch (e) {}
    }
    setHistory(loadHistory());
    setScreen("history");
  }, []);

  const handleSelectStory = useCallback((story) => {
    if (turnTimerRef.current) {
      clearTimeout(turnTimerRef.current);
      turnTimerRef.current = null;
    }
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.removeAttribute("src");
      } catch (e) {}
    }
    primeAudio();
    setCurrentStoryId(story.id || null);
    setActiveStoryMetadata({
      theme: story.theme,
      familyMembers: story.familyMembers || [],
      category: story.category || "adventures",
    });

    const storyChapters =
      Array.isArray(story.chapters) && story.chapters.length > 0
        ? story.chapters
        : [
            {
              chapter: story.chapter || 1,
              pages: story.pages || [],
              illustrations: story.illustrations || [],
              lesson: story.lesson || "",
              choices: story.choices || [],
            },
          ];

    setActiveStoryChapters(storyChapters);
    setActiveChapterIndex(0);

    const firstChapter = storyChapters[0];
    setPages(firstChapter.pages || []);
    setLesson(firstChapter.lesson || "");
    setChoices(firstChapter.choices || []);
    setChapter(firstChapter.chapter || 1);

    const restoredIllustrations =
      firstChapter.illustrations ||
      (Array.isArray(firstChapter.pages)
        ? firstChapter.pages.map((p) => (typeof p === "object" && p?.illustration?.url ? p.illustration.url : null))
        : []);
    setIllustrations(restoredIllustrations || []);
    setPageIndex(0);
    setTurnKey((k) => k + 1);
    setConclusionFocusIndex(0);
    storyStartTimeRef.current = Date.now();
    setScreen("story");
  }, [primeAudio]);

  const handleContinueNextStoredChapter = useCallback(() => {
    if (activeChapterIndex >= activeStoryChapters.length - 1) return;
    if (turnTimerRef.current) {
      clearTimeout(turnTimerRef.current);
      turnTimerRef.current = null;
    }
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.removeAttribute("src");
      } catch (e) {}
    }
    primeAudio();
    const nextIdx = activeChapterIndex + 1;
    const nextChapterData = activeStoryChapters[nextIdx];
    if (!nextChapterData) return;

    setActiveChapterIndex(nextIdx);
    setPages(nextChapterData.pages || []);
    setLesson(nextChapterData.lesson || "");
    setChoices(nextChapterData.choices || []);
    setChapter(nextChapterData.chapter || nextIdx + 1);

    const restoredIllustrations =
      nextChapterData.illustrations ||
      (Array.isArray(nextChapterData.pages)
        ? nextChapterData.pages.map((p) => (typeof p === "object" && p?.illustration?.url ? p.illustration.url : null))
        : []);
    setIllustrations(restoredIllustrations || []);
    setPageIndex(0);
    setTurnKey((k) => k + 1);
    setConclusionFocusIndex(0);
  }, [activeChapterIndex, activeStoryChapters, primeAudio]);

  const handleSelectNextChoice = useCallback(
    async (selectedChoice) => {
      setError(null);
      const startTime = Date.now();
      const nextChapter = (chapter || 1) + 1;
      const currentSessionId = ++illustrationSessionRef.current;
      setActiveChoiceTitle(selectedChoice);

      primeAudio();
      setScreen("loading");

      try {
        const activeTheme =
          activeStoryMetadata?.theme ||
          (themeMode === "custom" ? customTheme : (activeThemes[themeIndex] || activeThemes[0]));
        const familyMembers =
          activeStoryMetadata?.familyMembers ||
          names
            .split(",")
            .map((n) => n.trim())
            .filter(Boolean);
        const storyCategory = activeStoryMetadata?.category || category;

        const lastPage = pages[pages.length - 1];
        const lastPageText = typeof lastPage === "object" ? lastPage?.text : lastPage;
        const previousSummary = lastPageText ? lastPageText.slice(0, 150) : "";

        const res = await fetch(`${API_BASE}/generate-story`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            familyMembers,
            theme: activeTheme,
            isCustomTheme: !activeStoryMetadata && themeMode === "custom",
            storyLength,
            selectedChoice,
            chapter: nextChapter,
            previousSummary,
            category: storyCategory,
          }),
        });

        if (!res.ok) throw new Error("Next chapter generation failed");
        const data = await res.json();
        const storyPages = data.pages || [];
        const storyLesson = data.lesson || "";
        const storyChoices = data.choices || [];

        const firstRaw = storyPages[0];
        const firstPageText = typeof firstRaw === "object" ? firstRaw.text : firstRaw;
        const firstPageScene = typeof firstRaw === "object" ? firstRaw.scene : undefined;

        let firstIllustrationDisplay = null;
        let firstIllustrationStored = null;
        try {
          const illRes = await fetch(`${API_BASE}/illustrate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: firstPageText,
              scene: firstPageScene,
              theme: activeTheme,
              seed: nextChapter * 500,
            }),
          });
          if (illRes.ok) {
            const blob = await illRes.blob();
            firstIllustrationDisplay =
              (typeof URL.createObjectURL === "function" ? URL.createObjectURL(blob) : null) ||
              (await blobToDataUrl(blob));
            firstIllustrationStored = await compressBlobToDataUrl(blob);
          }
        } catch (illErr) {
          console.warn("First illustration fetch failed (graceful degradation):", illErr);
        }

        if (!firstIllustrationDisplay && storyPages.length > 0) {
          const fallback = createFallbackIllustrationUrl(activeTheme, 1);
          firstIllustrationDisplay = fallback;
          firstIllustrationStored = fallback;
        }

        const initialIllustrations = firstIllustrationDisplay ? [firstIllustrationDisplay] : [];
        const storedIllustrations = firstIllustrationStored ? [firstIllustrationStored] : [];

        setPages(storyPages);
        setLesson(storyLesson);
        setChoices(storyChoices);
        setChapter(nextChapter);
        setPageIndex(0);
        setTurnKey((k) => k + 1);
        setIllustrations(initialIllustrations);
        storyStartTimeRef.current = Date.now();
        setScreen("story");

        const formattedPages = storyPages.map((p, idx) => {
          const text = typeof p === "object" ? p.text : p;
          const scene = typeof p === "object" ? p.scene : undefined;
          return idx === 0 && storedIllustrations[0]
            ? { text, scene, illustration: { url: storedIllustrations[0], alt: `Illustration for page 1` } }
            : { text, scene };
        });

        const newChapterData = {
          chapter: nextChapter,
          pages: formattedPages,
          illustrations: storedIllustrations,
          lesson: storyLesson,
          choices: storyChoices,
          selectedChoice,
        };

        const updatedChapters = [...activeStoryChapters, newChapterData];
        setActiveStoryChapters(updatedChapters);
        const newChapterIndex = updatedChapters.length - 1;
        setActiveChapterIndex(newChapterIndex);

        let targetStoryId = currentStoryId;
        if (currentStoryId) {
          // Update the continuous storybook in-place in history
          updateStory(currentStoryId, {
            chapter: nextChapter,
            pages: formattedPages,
            illustrations: storedIllustrations,
            lesson: storyLesson,
            choices: storyChoices,
            chapters: updatedChapters,
          });
        } else {
          // Fallback if no story ID was tracked
          const savedStory = saveStory({
            familyMembers,
            theme: activeTheme,
            category: storyCategory,
            pages: formattedPages,
            illustrations: storedIllustrations,
            firstPage: typeof firstRaw === "string" ? firstRaw : firstRaw?.text || "",
            lesson: storyLesson,
            choices: storyChoices,
            chapter: nextChapter,
            chapters: updatedChapters,
          });
          targetStoryId = savedStory?.id || null;
          setCurrentStoryId(targetStoryId);
        }

        setHistory(loadHistory());

        trackEvent("story_generated", {
          familyMembers,
          theme: activeTheme,
          storyLength,
          voice,
          category: storyCategory,
          chapter: nextChapter,
          selectedChoice,
          generationTime: (Date.now() - startTime) / 1000,
        });

        // Fetch subsequent illustrations (page 1+) concurrently with retries & fallbacks
        fetchSubsequentIllustrations({
          storyPages,
          activeTheme,
          seedBase: nextChapter * 500,
          initialIllustrations,
          initialStored: storedIllustrations,
          savedStoryId: targetStoryId,
          sessionId: currentSessionId,
          targetChapterIndex: newChapterIndex,
        });
      } catch (err) {
        console.error(err);
        setError("Couldn't weave the next chapter. Returning to story setup.");
        setScreen("setup");
      }
    },
    [chapter, themeMode, customTheme, themeIndex, names, pages, storyLength, primeAudio, voice, fetchSubsequentIllustrations, category, activeThemes, currentStoryId, activeStoryMetadata]
  );

  const handleReturnHome = useCallback(() => {
    if (turnTimerRef.current) {
      clearTimeout(turnTimerRef.current);
      turnTimerRef.current = null;
    }
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.removeAttribute("src");
      } catch (e) {}
    }
    setCurrentStoryId(null);
    setActiveStoryMetadata(null);
    setChapter(1);
    setPageIndex(0);
    setScreen("setup");
  }, []);

  const handleBackFromHistory = useCallback(() => {
    if (turnTimerRef.current) {
      clearTimeout(turnTimerRef.current);
      turnTimerRef.current = null;
    }
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.removeAttribute("src");
      } catch (e) {}
    }
    setHistory(loadHistory());
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
  const speechMarksRef = useRef([]);
  const [activeSpeechMark, setActiveSpeechMark] = useState(null);

  useEffect(() => {
    if (!audioRef.current) return;
    const audio = audioRef.current;

    const onPlay = () => setIsNarrating(true);
    const onPause = () => {
      setIsNarrating(false);
      setActiveSpeechMark(null);
    };
    const onEnded = () => {
      setActiveSpeechMark(null);
    };
    const onTimeUpdate = () => {
      const marks = speechMarksRef.current;
      if (!marks || marks.length === 0 || !audio) {
        setActiveSpeechMark(null);
        return;
      }
      const currentTimeMs = (audio.currentTime || 0) * 1000;
      let currentMark = null;
      for (let i = 0; i < marks.length; i++) {
        const mark = marks[i];
        if (mark.time <= currentTimeMs) {
          const nextTime = marks[i + 1] ? marks[i + 1].time : mark.time + 1000;
          if (currentTimeMs < nextTime) {
            currentMark = mark;
            break;
          }
        }
      }
      setActiveSpeechMark(currentMark);
    };

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("timeupdate", onTimeUpdate);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("timeupdate", onTimeUpdate);
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
    if (screen !== "story") {
      if (turnTimerRef.current) {
        clearTimeout(turnTimerRef.current);
        turnTimerRef.current = null;
      }
      speechMarksRef.current = [];
      setActiveSpeechMark(null);
      if (audioRef.current && typeof audioRef.current.pause === "function") {
        try {
          audioRef.current.pause();
          audioRef.current.removeAttribute("src");
        } catch (e) {
          // Ignore in environments where pause is not implemented
        }
      }
    }
  }, [screen]);

  // Narrate current page (or lesson on conclusion slide) whenever screen="story", page changes, or voice changes
  useEffect(() => {
    if (screen !== "story" || !pages) return;
    let textToNarrate = "";

    if (pageIndex < pages.length && pages[pageIndex]) {
      const currentPage = pages[pageIndex];
      textToNarrate = typeof currentPage === "object" ? currentPage.text : currentPage;
    } else if (pageIndex >= pages.length && lesson) {
      textToNarrate = `The End. Tonight's lesson: ${lesson}`;
    }

    if (!textToNarrate) return;
    let cancelled = false;
    speechMarksRef.current = [];
    setActiveSpeechMark(null);

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/narrate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: textToNarrate, voiceId: voice, speechMarks: true }),
        });
        if (!res.ok || cancelled) return;

        const contentType = (res.headers && typeof res.headers.get === "function" ? res.headers.get("content-type") : "") || "";
        let audioUrl = "";
        let marks = [];

        if (contentType.includes("application/json") || (!res.blob && typeof res.json === "function")) {
          const data = await res.json();
          if (data.audio) {
            try {
              if (typeof data.audio === "string" && data.audio.startsWith("data:") && typeof URL.createObjectURL === "function") {
                const base64Parts = data.audio.split(",");
                const byteCharacters = atob(base64Parts[1] || base64Parts[0]);
                const byteNumbers = new Uint8Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                  byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const audioBlob = new Blob([byteNumbers], { type: "audio/mpeg" });
                audioUrl = URL.createObjectURL(audioBlob);
              } else {
                audioUrl = data.audio;
              }
            } catch (e) {
              audioUrl = data.audio;
            }
          }
          marks = Array.isArray(data.speechMarks) ? data.speechMarks : [];
        } else if (typeof res.blob === "function") {
          const blob = await res.blob();
          if (typeof URL.createObjectURL === "function") {
            audioUrl = URL.createObjectURL(blob);
          }
        }

        if (audioRef.current && !cancelled && audioUrl) {
          speechMarksRef.current = marks;
          setActiveSpeechMark(null);
          isPrimingAudioRef.current = false;
          if (typeof audioRef.current.pause === "function") {
            try { audioRef.current.pause(); } catch (e) {}
          }
          audioRef.current.src = audioUrl;
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
  }, [screen, pageIndex, pages, voice, lesson]);

  useEffect(() => {
    if (!audioRef.current) return;

    const audio = audioRef.current;

    const handleEnded = () => {
      if (screen !== "story") return;

      // CRITICAL: Ignore silent priming audio or uninitialized audio
      const isPrimingSrc =
        audio.src === PRIMING_AUDIO_SRC ||
        audio.src.includes("data:audio/wav");

      if (isPrimingAudioRef.current || !audio.src || isPrimingSrc) {
        return;
      }

      if (turnTimerRef.current) {
        clearTimeout(turnTimerRef.current);
        turnTimerRef.current = null;
      }

      if (pageIndex < pages.length - 1) {
        turnTimerRef.current = setTimeout(() => {
          turnTo(pageIndex + 1);
        }, 1200);
      } else if (pageIndex === pages.length - 1) {
        // Track story completed analytics event (Req 7.3)
        trackEvent("story_completed", {
          totalPages: pages.length,
          timeSpent: storyStartTimeRef.current ? Math.round((Date.now() - storyStartTimeRef.current) / 1000) : 0,
        });

        // Automatically advance to conclusion slide if lesson or choices exist
        if (lesson || (choices && choices.length > 0)) {
          turnTimerRef.current = setTimeout(() => {
            turnTo(pages.length);
          }, 1200);
        }
      }
    };

    audio.addEventListener("ended", handleEnded);
    return () => {
      audio.removeEventListener("ended", handleEnded);
      if (turnTimerRef.current) {
        clearTimeout(turnTimerRef.current);
        turnTimerRef.current = null;
      }
    };
  }, [screen, pageIndex, pages.length, turnTo, lesson, choices]);

  const hasPlayedLullabyChimeRef = useRef(false);

  useEffect(() => {
    if (screen === "story" && pages && pageIndex >= pages.length) {
      if (!hasPlayedLullabyChimeRef.current) {
        hasPlayedLullabyChimeRef.current = true;
        playBedtimeLullabyChime();
      }
    } else {
      hasPlayedLullabyChimeRef.current = false;
    }
  }, [screen, pageIndex, pages]);

  const hasNextStoredChapter = activeChapterIndex < activeStoryChapters.length - 1;
  const nextStoredChapterNumber = hasNextStoredChapter
    ? (activeStoryChapters[activeChapterIndex + 1]?.chapter || (chapter + 1))
    : null;

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
      const isHome =
        e.key === "Home" ||
        e.key === "BrowserHome" ||
        e.keyCode === 36 ||
        e.which === 36;

      // Global Home key: return to home screen (setup) from any screen
      if (isHome) {
        e.preventDefault();
        setScreen("setup");
        return;
      }

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
          setThemeIndex((i) => (i + 1) % activeThemes.length);
        }
        if (isUp) {
          e.preventDefault();
          setThemeIndex((i) => (i - 1 + activeThemes.length) % activeThemes.length);
        }
        if (isLeft) {
          e.preventDefault();
          const catIdx = THEME_CATEGORIES.findIndex((c) => c.id === category);
          const prevCat = THEME_CATEGORIES[(catIdx - 1 + THEME_CATEGORIES.length) % THEME_CATEGORIES.length];
          setCategory(prevCat.id);
          setThemeIndex(0);
        }
        if (isRight) {
          e.preventDefault();
          const catIdx = THEME_CATEGORIES.findIndex((c) => c.id === category);
          const nextCat = THEME_CATEGORIES[(catIdx + 1) % THEME_CATEGORIES.length];
          setCategory(nextCat.id);
          setThemeIndex(0);
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

        const onConclusion = pageIndex >= pages.length;
        if (onConclusion) {
          if (isBack) {
            e.preventDefault();
            setScreen("setup");
            return;
          }

          if (isRewind) {
            e.preventDefault();
            if (pages.length > 0) turnTo(pages.length - 1);
            return;
          }

          if (hasNextStoredChapter) {
            // Next stored chapter is index 0, return home is index 1
            if (isDown) {
              e.preventDefault();
              setConclusionFocusIndex(1);
              return;
            }
            if (isUp) {
              e.preventDefault();
              setConclusionFocusIndex(0);
              return;
            }
            if (isLeft) {
              e.preventDefault();
              if (conclusionFocusIndex === 1) {
                setConclusionFocusIndex(0);
              } else if (conclusionFocusIndex === 0) {
                if (pages.length > 0) turnTo(pages.length - 1);
              }
              return;
            }
            if (isRight) {
              e.preventDefault();
              return;
            }
            if (isSelect) {
              e.preventDefault();
              if (conclusionFocusIndex === 0) {
                handleContinueNextStoredChapter();
              } else {
                setScreen("setup");
              }
              return;
            }
            return;
          }

          const numChoices = choices ? choices.length : 0;
          const homeIndex = numChoices;

          if (isRight) {
            e.preventDefault();
            setConclusionFocusIndex((prev) => {
              if (prev === 0 && numChoices > 1) return 1;
              return prev;
            });
            return;
          }

          if (isLeft) {
            e.preventDefault();
            if (conclusionFocusIndex === 1) {
              setConclusionFocusIndex(0);
            } else if (conclusionFocusIndex === 0) {
              if (pages.length > 0) turnTo(pages.length - 1);
            } else if (conclusionFocusIndex === homeIndex) {
              setConclusionFocusIndex(0);
            }
            return;
          }

          if (isDown) {
            e.preventDefault();
            setConclusionFocusIndex((prev) => {
              if (prev < homeIndex) return homeIndex;
              return 0;
            });
            return;
          }

          if (isUp) {
            e.preventDefault();
            setConclusionFocusIndex((prev) => {
              if (prev === homeIndex) return 0;
              return prev;
            });
            return;
          }

          if (isSelect) {
            e.preventDefault();
            if (conclusionFocusIndex < numChoices && choices[conclusionFocusIndex]) {
              handleSelectNextChoice(choices[conclusionFocusIndex]);
            } else {
              setScreen("setup");
            }
            return;
          }
          return;
        }

        const maxPage = hasNextStoredChapter || lesson || (choices && choices.length > 0) ? pages.length : pages.length - 1;
        if (isRight || isFastForward || isSelect) {
          e.preventDefault();
          if (pageIndex < maxPage) turnTo(pageIndex + 1);
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
  }, [
    screen,
    pageIndex,
    pages.length,
    generateStory,
    turnTo,
    handleToggleNarration,
    lesson,
    choices,
    conclusionFocusIndex,
    handleSelectNextChoice,
    hasNextStoredChapter,
    handleContinueNextStoredChapter,
  ]);

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
          category={category}
          setCategory={setCategory}
          categories={THEME_CATEGORIES}
          themeMode={themeMode}
          setThemeMode={setThemeMode}
          customTheme={customTheme}
          setCustomTheme={setCustomTheme}
          error={error}
          onSubmit={generateStory}
          themes={activeThemes}
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
      {screen === "loading" && <LoadingScreen chapter={chapter} choice={activeChoiceTitle} />}
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
          themes={activeThemes}
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
          lesson={lesson}
          choices={choices}
          chapter={chapter}
          nextStoredChapterNumber={nextStoredChapterNumber}
          onContinueNextStoredChapter={handleContinueNextStoredChapter}
          onSelectChoice={handleSelectNextChoice}
          onReturnHome={handleReturnHome}
          focusIndex={conclusionFocusIndex}
          onFocusIndexChange={setConclusionFocusIndex}
          activeSpeechMark={activeSpeechMark}
          windDown={
            (parentSettings?.settings?.bedtimeWindDown ?? true) &&
            (chapter > 1 || pageIndex >= 2 || pageIndex >= (pages ? pages.length : 0))
          }
        />
      )}
    </div>
  );
}

function LoadingScreen({ chapter = 1, choice = "" }) {
  return (
    <div className="relative z-10 text-center px-6">
      <p className="font-serif text-3xl md:text-4xl italic text-parchment/90">
        {chapter > 1 ? `Weaving Chapter ${chapter}\u2026` : "Turning up the lamp\u2026"}
      </p>
      <p className="mt-4 font-sans text-base md:text-lg text-starlight/70 max-w-xl mx-auto">
        {choice ? `"${choice}"` : "Painting your illustrations\u2026"}
      </p>
    </div>
  );
}
