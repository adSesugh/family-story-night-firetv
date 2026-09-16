# Audio Narration Auto-Start Bugfix Requirements

## Introduction

The Family Story Night app has a critical bug where audio narration does not auto-play on the first page of a story. When a user generates a story and the StoryScreen appears, the narration effect triggers but fails silently, leaving the user with silence on page 1. Narration only begins working after the user manually navigates to page 2. This severely impacts the user experience on initial story load, as the intended immersive audio-narrated experience is broken on first render.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the story screen loads with `screen === "story"` AND `pageIndex === 0` (first page) for the initial render THEN the system does not produce audio narration (user hears silence)

1.2 WHEN the narration useEffect runs on initial story load with `pages[0]` available AND the `/narrate` endpoint is called THEN the async fetch may fail silently or the audio playback may not start despite successful fetch

### Expected Behavior (Correct)

2.1 WHEN the story screen loads with `screen === "story"` AND `pageIndex === 0` (first page) for the initial render THEN the system SHALL fetch narration for page 1 and auto-play audio immediately without user navigation

2.2 WHEN narration is requested on initial story load THEN the system SHALL ensure the fetch completes, the audio element receives the audio blob, and `audio.play()` executes successfully before the page renders

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user navigates to page 2 or any subsequent page THEN the system SHALL CONTINUE TO fetch and auto-play narration for that page exactly as it currently does

3.2 WHEN narration audio finishes playing on any page THEN the system SHALL CONTINUE TO automatically advance to the next page after 1200ms delay, preserving existing auto-advance behavior

3.3 WHEN a user manually clicks Previous/Next buttons or uses arrow keys THEN the system SHALL CONTINUE TO trigger page navigation and narration exactly as it currently does

3.4 WHEN the audio element is not available or audio.play() fails THEN the system SHALL CONTINUE TO silently catch the error without crashing, preserving graceful degradation
