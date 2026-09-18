# Implementation Plan: Future Enhancements

## Overview

This plan incrementally extends Family Story Night across 7 features — Story History, Custom Themes, Multiple Voices, Story Length Options, Illustrations (data-layer foundation), Parent Controls, and Analytics — while preserving full backward compatibility with the existing MVP. Each phase builds on the previous so no orphaned code is left unwired.

## Tasks

---

### Feature 1: Story History

- [x] 1. Create localStorage utility module
  - [x] 1.1 Create `client/src/utils/storage.js` with a `StorageService` wrapper
    - Implement `getItem(key)`, `setItem(key, value)`, `removeItem(key)` that each catch `SecurityError`/`QuotaExceededError` and return `null` / `false` instead of throwing
    - Export a `isStorageAvailable()` helper that probes `localStorage` with a test write
    - _Requirements: 1.7 (graceful degradation if localStorage unavailable)_

  - [x]* 1.2 Write unit tests for `StorageService`
    - Test normal get/set/remove flow
    - Test graceful return when `localStorage` throws (mock `localStorage` to throw)
    - _Requirements: 1.7_

- [x] 2. Implement story history data layer
  - [x] 2.1 Create `client/src/utils/storyHistory.js`
    - Implement `saveStory(story)` — generates a UUID (`crypto.randomUUID()`), sets `generatedAt`, enforces 50-story cap by dropping oldest entry (requirement 1.6), and writes to `StorageService` under key `familyStoryNight_history`
    - Implement `loadHistory()` — reads and parses from `StorageService`; returns `[]` on any error
    - Implement `deleteStory(id)` — removes a single entry by id
    - Implement `clearHistory()` — wipes all entries
    - _Requirements: 1.1, 1.5, 1.6_

  - [x]* 2.2 Write unit tests for `storyHistory.js`
    - Test that `saveStory` enforces the 50-story cap
    - Test that `loadHistory` returns `[]` when storage is empty or corrupted
    - Test `deleteStory` removes only the matching id
    - _Requirements: 1.5, 1.6_

- [x] 3. Build `HistoryScreen` component
  - [x] 3.1 Create `client/src/components/HistoryScreen.jsx`
    - Render a scrollable list; each row shows: formatted date/time, family member names (joined with commas), theme, and first-50-char preview of `firstPage`
    - Each row has a clickable area that calls `onSelect(story)` prop
    - Each row has a "Delete" button that calls `onDelete(story.id)` with a `window.confirm` guard
    - Render a "Clear all" button at top that calls `onClearAll()` with a `window.confirm` guard
    - Match the existing design language (dark `bg-dusk`, `text-parchment`, `font-serif` headings, `font-sans` body)
    - _Requirements: 1.3, 1.4_

  - [x]* 3.2 Write unit tests for `HistoryScreen`
    - Test list renders correct count of story rows
    - Test clicking a row calls `onSelect` with correct story object
    - Test "Delete" button calls `onDelete` with correct id after confirmation
    - Test empty state renders without crashing
    - _Requirements: 1.3, 1.4_

- [x] 4. Wire Story History into `App.jsx`
  - [x] 4.1 Add `history` state and history-related handlers in `App.jsx`
    - Call `loadHistory()` on mount; store in `history` state
    - Add `screen` value `"history"` to the existing screen state machine
    - Call `saveStory({ id, generatedAt, familyMembers, theme, pages, firstPage })` immediately after `setScreen("story")` in `generateStory`
    - Add `handleDeleteStory`, `handleClearHistory`, and `handleSelectStory` callbacks that update `history` state and (for `handleSelectStory`) set `pages`/`screen` without re-generating
    - _Requirements: 1.1, 1.2, 1.4, 1.5_

  - [x] 4.2 Add "View History" button to `SetupScreen` and render `HistoryScreen` conditionally
    - Pass `hasHistory={history.length > 0}` and `onViewHistory` prop to `SetupScreen`
    - In `SetupScreen`, render a `"📖 View History"` button below the theme selector only when `hasHistory` is true
    - In `App.jsx`, render `<HistoryScreen>` when `screen === "history"`
    - _Requirements: 1.2, 1.7_

- [x] 5. Checkpoint — Story History
  - Ensure all Story History tests pass and the history button only appears after at least one story is generated. Ask the user if questions arise.

---

### Feature 2: Custom Themes

- [x] 6. Add custom theme state and UI to `SetupScreen`
  - [x] 6.1 Extend `SetupScreen` to support a preset/custom toggle
    - Accept new props: `themeMode` (`"preset"` | `"custom"`), `setThemeMode`, `customTheme`, `setCustomTheme`
    - Render two toggle buttons — "Preset" and "Custom" — that switch `themeMode`
    - In preset mode, show existing theme selector (unchanged)
    - In custom mode, replace the theme selector with a `<textarea>` or `<input>` (max 100 chars) that binds to `customTheme`; show a live character counter (e.g., `"42 / 100"`)
    - Display validation error if custom theme is empty when the user submits
    - _Requirements: 2.1, 2.2, 2.6 (UI surface)_

  - [x]* 6.2 Write unit tests for custom theme UI
    - Test toggling between modes shows/hides the correct elements
    - Test character counter increments correctly
    - Test submitting with empty custom theme shows error message
    - _Requirements: 2.1, 2.2_

- [x] 7. Propagate custom theme through story generation
  - [x] 7.1 Update `App.jsx` to manage `themeMode` and `customTheme` state
    - Add `themeMode` (default `"preset"`) and `customTheme` (default `""`) state
    - In `generateStory`, compute `activeTheme = themeMode === "custom" ? customTheme : THEMES[themeIndex]`
    - Pass `activeTheme` in the `theme` field of the `/generate-story` POST body
    - Pass new props down to `SetupScreen`
    - _Requirements: 2.3, 2.4_

  - [x] 7.2 Update the server `/generate-story` endpoint to accept and validate custom themes
    - Accept `isCustomTheme` boolean in request body (defaults to `false`)
    - Validate custom theme: reject if longer than 100 characters (400 response)
    - Log `isCustomTheme` flag for observability
    - No change to prompt construction needed — `theme` field already flows into the prompt
    - _Requirements: 2.5_

  - [x]* 7.3 Write unit/integration tests for custom theme flow
    - Server test: assert 400 when `isCustomTheme=true` and theme > 100 chars
    - Server test: assert story generates when a valid custom theme is passed
    - Client test: assert `generateStory` sends `isCustomTheme: true` when `themeMode === "custom"`
    - _Requirements: 2.4, 2.5_

---

### Feature 3: Multiple Voices

- [x] 8. Add voice selector to `SetupScreen`
  - [x] 8.1 Define `VOICES` constant and create voice selector UI
    - Create `client/src/constants/voices.js` exporting `VOICES` array with `{ id, name, region }` objects (Joanna, Matthew, Emma, Ivy)
    - Add `voice` and `setVoice` props to `SetupScreen`
    - Render a `<select>` or radio-button group below the theme area, defaulting to `"Joanna"`
    - Persist selected voice to `localStorage` (`familyStoryNight_voice`) on change using `StorageService`
    - Load persisted voice on app mount
    - _Requirements: 3.1, 3.2_

  - [x]* 8.2 Write unit tests for voice selector
    - Test all voice options render
    - Test selecting a voice calls `setVoice` with the correct id
    - _Requirements: 3.1, 3.2_

- [x] 9. Wire voice selection into narration
  - [x] 9.1 Pass `voice` state from `App.jsx` through to narration fetch calls
    - Add `voice` state (default `"Joanna"`, loaded from `StorageService`) in `App.jsx`
    - Include `voiceId: voice` in both narration `fetch` bodies in `App.jsx`
    - _Requirements: 3.3, 3.4_

  - [x] 9.2 Update server `/narrate` endpoint to accept and use `voiceId`
    - Accept `voiceId` in POST body; validate it is one of the allowed Polly voice IDs (fallback to `"Joanna"` if not in the allowed list)
    - Pass `voiceId` to `SynthesizeSpeechCommand` instead of the hardcoded `"Joanna"`
    - _Requirements: 3.5_

  - [x]* 9.3 Write unit tests for voice narration flow
    - Server test: assert narration uses `"Matthew"` when `voiceId: "Matthew"` is sent
    - Server test: assert fallback to `"Joanna"` when an invalid voice id is sent
    - _Requirements: 3.5_

---

### Feature 4: Story Length Options

- [x] 10. Add length selector to `SetupScreen`
  - [x] 10.1 Add story length radio buttons / tab UI to `SetupScreen`
    - Accept `storyLength` (default `6`) and `setStoryLength` props
    - Render three options with labels: "Short Story (4 pages)", "Standard (6 pages)", "Long Story (8 pages)"
    - Style to match existing design; default selection is 6 pages
    - _Requirements: 4.1, 4.2, 4.5_

  - [x]* 10.2 Write unit tests for length selector
    - Test default selection is 6
    - Test clicking each option calls `setStoryLength` with the correct value
    - _Requirements: 4.1, 4.5_

- [x] 11. Propagate length through generation
  - [x] 11.1 Add `storyLength` state in `App.jsx` and pass to story generation
    - Add `storyLength` state (default `6`) in `App.jsx`
    - Pass `storyLength` in the `/generate-story` POST body
    - Pass `storyLength` / `setStoryLength` props to `SetupScreen`
    - _Requirements: 4.3_

  - [x] 11.2 Update server `/generate-story` endpoint to use requested length
    - Accept `storyLength` in request body; validate it is one of `[4, 6, 8]` (default to `6` otherwise)
    - Substitute `storyLength` into the prompt string in place of the hardcoded `6`
    - Update `max_tokens` ceiling proportionally (4 pages → 600, 6 pages → 800, 8 pages → 1050)
    - _Requirements: 4.4, 4.5_

  - [x]* 11.3 Write unit tests for story length
    - Server test: assert 400 when `storyLength` is outside `[4, 6, 8]`
    - Server test: assert prompt includes the requested page count
    - _Requirements: 4.4_

- [x] 12. Checkpoint — Features 2–4
  - Ensure all tests for Custom Themes, Multiple Voices, and Story Length pass. Verify the SetupScreen still renders correctly with all new controls. Ask the user if questions arise.

---

### Feature 5: Illustrations (Data Layer Foundation)

- [x] 13. Extend data structures to support illustrations (deferred rendering)
  - [x] 13.1 Update story data shape to include optional `illustration` field
    - In `storyHistory.js`, update the story schema comment/JSDoc to include `pages` as an array of `{ text: string, illustration?: { url: string, alt: string } | null }`
    - Update `saveStory` to accept and persist the new shape (plain text pages still accepted for backward compat)
    - _Requirements: 5.1, 5.4_

  - [x] 13.2 Update `StoryScreen` to render illustration when present
    - In `StoryScreen.jsx`, replace bare `{page}` string access with `{typeof page === "object" ? page.text : page}` for backward compat
    - Above the `<p>` tag in each `SwiperSlide`, render `{page?.illustration && <img src={page.illustration.url} alt={page.illustration.alt} className="mb-6 w-full rounded-sm object-cover max-h-64" />}`
    - Wrap the `<img>` in an error boundary / `onError` handler that hides it on load failure (graceful degradation per requirement 5.4)
    - _Requirements: 5.2, 5.3, 5.4_

  - [x]* 13.3 Write unit tests for illustration rendering
    - Test `StoryScreen` renders `<img>` when page has illustration data
    - Test `StoryScreen` renders without `<img>` when illustration is absent (backward compat)
    - Test `StoryScreen` hides broken image on `onError`
    - _Requirements: 5.2, 5.4_

---

### Feature 6: Parent Controls

- [x] 14. Build settings data layer and PIN logic
  - [x] 14.1 Create `client/src/utils/parentSettings.js`
    - Implement `loadSettings()` — reads `familyStoryNight_parentSettings` from `StorageService`; returns defaults if absent: `{ pinHash: null, settings: { allowCustomThemes: true, allowHistory: true, ageRestriction: "all", defaultVoice: "Joanna", lockedUntil: null } }`
    - Implement `saveSettings(settings)` — writes to `StorageService`
    - Implement `hashPin(pin)` — simple deterministic hash (e.g., `btoa(pin + "fsn-salt")`) for family-friendly PIN obfuscation (not cryptographic)
    - Implement `verifyPin(pin, pinHash)` — returns boolean
    - Implement `setPin(pin)` — saves `pinHash` to settings
    - _Requirements: 6.3, 6.5_

  - [x]* 14.2 Write unit tests for `parentSettings.js`
    - Test `loadSettings` returns defaults when storage is empty
    - Test `verifyPin` returns true for correct pin and false for wrong pin
    - Test `saveSettings` persists and `loadSettings` reads back correctly
    - _Requirements: 6.3, 6.5_

- [x] 15. Build `SettingsScreen` component
  - [x] 15.1 Create `client/src/components/SettingsScreen.jsx`
    - If no PIN is set: render a "Create PIN" form (4-digit input, confirm input, submit)
    - If PIN is set but not yet verified this session: render a PIN entry form; show error on wrong PIN
    - If PIN is verified: render the parent panel with toggles/checkboxes for each setting in `parentSettings.settings`; include a "Change PIN" button and a "Back" button
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x]* 15.2 Write unit tests for `SettingsScreen`
    - Test PIN creation form validates that both inputs match
    - Test wrong PIN shows error message
    - Test correct PIN reveals the settings panel
    - _Requirements: 6.2, 6.5_

- [x] 16. Wire Parent Controls into `App.jsx`
  - [x] 16.1 Add `parentSettings` state and settings screen integration
    - Load settings on mount with `loadSettings()`
    - Add `screen` value `"settings"` to screen state machine
    - Add a small gear icon / "Settings" button in a corner of `SetupScreen` (accepts `onOpenSettings` prop)
    - Pass `parentSettings` down to relevant components to enforce `allowCustomThemes` and `allowHistory` flags
    - _Requirements: 6.1, 6.4_

  - [x] 16.2 Enforce parent settings throughout the app
    - In `SetupScreen`, hide the custom theme toggle when `parentSettings.settings.allowCustomThemes === false`
    - In `SetupScreen`, hide the "View History" button when `parentSettings.settings.allowHistory === false`
    - Apply `defaultVoice` from settings as the initial `voice` state in `App.jsx` if no user override is stored
    - _Requirements: 6.3, 6.4_

  - [x]* 16.3 Write unit tests for settings enforcement
    - Test that custom theme toggle is hidden when `allowCustomThemes` is false
    - Test that history button is hidden when `allowHistory` is false
    - _Requirements: 6.3, 6.4_

- [x] 17. Checkpoint — Features 5 & 6
  - Ensure all tests for Illustrations and Parent Controls pass. Verify the settings screen flow: create PIN → enter settings → toggle a control → reload → control state is preserved. Ask the user if questions arise.

---

### Feature 7: Analytics

- [x] 18. Build analytics data layer
  - [x] 18.1 Create `client/src/utils/analytics.js`
    - Implement `trackEvent(type, data)` — appends `{ timestamp, type, data }` to `familyStoryNight_analytics` in `StorageService`; silently no-ops if storage is unavailable
    - Implement `loadEvents()` — reads all events; returns `[]` on error
    - Implement `clearEvents()` — removes all analytics data
    - Implement `summarize()` — computes and returns `{ totalStories, mostPopularTheme, avgCompletionRate, topFamilyMembers, favoriteVoice }` from stored events
    - _Requirements: 7.1, 7.4_

  - [x]* 18.2 Write unit tests for `analytics.js`
    - Test `trackEvent` appends new events correctly
    - Test `summarize` returns correct `mostPopularTheme` given a set of events
    - Test `summarize` returns safe defaults when there are no events
    - _Requirements: 7.1_

- [x] 19. Instrument the app with analytics events
  - [x] 19.1 Add `trackEvent` calls in `App.jsx` at key moments
    - On story generation success: `trackEvent("story_generated", { familyMembers, theme, storyLength, voice, generationTime })`
    - On page navigation (`turnTo`): `trackEvent("page_viewed", { pageIndex, totalPages })`
    - On last page reached (in the `handleEnded` audio effect): `trackEvent("story_completed", { totalPages, timeSpent })` — `timeSpent` can be approximate ms delta
    - _Requirements: 7.1, 7.2, 7.3_

  - [x]* 19.2 Write unit tests for analytics instrumentation
    - Test that `story_generated` event is tracked with correct fields after `generateStory` succeeds
    - Test that `story_completed` event is tracked when audio ends on the last page
    - _Requirements: 7.1, 7.3_

- [x] 20. Build analytics dashboard in `SettingsScreen`
  - [x] 20.1 Add an analytics section to the parent panel in `SettingsScreen`
    - Call `summarize()` on mount and render the stats: total stories, most popular theme, avg completion rate, top family members, favorite voice
    - Include a "Clear Analytics Data" button that calls `clearEvents()` and refreshes the display
    - _Requirements: 7.5_

  - [x]* 20.2 Write unit tests for analytics dashboard
    - Test that summary stats render when data is present
    - Test "Clear Analytics Data" button results in zeroed stats
    - _Requirements: 7.5_

- [x] 21. Checkpoint — Ensure analytics and core tests pass
  - Run the full test suite (`client/`: `npx jest`, `server/`: `npm test`). All tests pass.

---

### Feature 8: Bedtime Lessons & Story Morals

- [x] 22. Generate and narrate bedtime lessons
  - [x] 22.1 Update backend `/generate-story` prompt and JSON parser
    - Instruct Claude 3.5 Sonnet to generate `lesson` (1–2 sentences) alongside pages
    - Parse JSON object and provide comforting fallback moral if model outputs array
    - Return `{ pages, lesson, choices, chapter }`
    - _Requirements: 8.1, 8.4, 8.5_
  - [x] 22.2 Build bedtime lesson card on conclusion slide in `StoryScreen.jsx`
    - Render "The End" header with chapter completion badge
    - Display lesson in illuminated card with amber star badge (`Sparkles`)
    - _Requirements: 8.2_
  - [x] 22.3 Voice narration for bedtime lesson
    - Narrate *"The End. Tonight's lesson: [lesson]"* automatically when reaching conclusion slide
    - _Requirements: 8.3_
  - [x]* 22.4 Unit tests for story lesson
    - Server tests in `generate-story.test.js`
    - Client tests in `story-completion-choices.test.jsx`

---

### Feature 9: Interactive Next Chapter Choices

- [x] 23. Build interactive branching next chapter choices
  - [x] 23.1 Render adventure choice buttons on completion slide
    - Display 2 TV-friendly choice cards with high-contrast active rings
    - Provide "Return to Home & Start a New Story" button
    - _Requirements: 9.1, 9.4_
  - [x] 23.2 Chapter continuation & history persistence
    - Implement `handleSelectNextChoice` in `App.jsx`
    - Pre-fetch Chapter `N + 1` passing `selectedChoice`, `chapter`, and `previousSummary`
    - Display personalized loading screen (*"Weaving Chapter [N]: [choice]..."*)
    - Save chapter progress in `storyHistory`
    - _Requirements: 9.2, 9.3_
  - [x] 23.3 Implement D-pad directional navigation matrix
    - Map `ArrowRight` (Choice 1 → Choice 2), `ArrowLeft` (Choice 2 → Choice 1, Choice 1 → previous page)
    - Map `ArrowDown` (Choices → Home button), `ArrowUp` (Home button → Choice 1)
    - Map `Enter/Select` to trigger active choice or home
    - Map `Rewind` to navigate back to previous story page
    - _Requirements: 9.5, 9.6_
  - [x]* 23.4 Integration tests for chapter choices & D-pad navigation
    - Test suite in `client/src/__tests__/story-completion-choices.test.jsx`

---

### Feature 10: Living Picture Book (Ken Burns & Ambient Motion)

- [x] 24. Implement cinematic camera movement and ambient particles
  - [x] 24.1 Add Ken Burns CSS animation variations in `index.css`
    - Implement 4 alternating 22s GPU-accelerated keyframe trajectories (`kenburns-0` to `3`)
    - Apply dynamically per page index: `animate-kenburns-${idx % 4}`
    - _Requirements: 10.1, 10.2_
  - [x] 24.2 Build `AmbientParticles.jsx` component
    - Render floating golden firefly motes and twinkling starlight dust motes over illustrations
    - Subtle inner vignette overlay for seamless watercolor page blending
    - _Requirements: 10.3, 10.4_
  - [x] 24.3 Add reduced motion accessibility
    - Disable Ken Burns and particle animations under `@media (prefers-reduced-motion: reduce)`
    - _Requirements: 10.5_
  - [x]* 24.4 Unit tests for ambient motion
    - Test suite in `client/src/__tests__/ambient-motion-illustrations.test.jsx`

---

### Feature 11: Fire TV Web App Packaging & TV Experience

- [x] 25. Package web app for Fire TV and tune TV navigation
  - [x] 25.1 Create Web App Manifest and TV assets
    - Add `manifest.json` configured for landscape, fullscreen TV runtime
    - Add app icons (`icon-192.png`, `icon-512.png`)
    - _Requirements: 11.1_
  - [x] 25.2 Fire TV device detection helper
    - Create `client/src/utils/device.js` detecting Silk / AFT user agents
    - Unit tests in `device.test.jsx`
    - _Requirements: 11.3_
  - [x] 25.3 Remote Home key listener
    - Add global `Home` / `BrowserHome` (`keyCode 36`) listener to return to setup from any screen
    - Unit tests in `fire-tv-controller.test.jsx`
    - _Requirements: 11.4, 11.6_
  - [x] 25.4 High-contrast TV focus styling
    - Configure `:focus-visible:not(input, textarea)` with 2px golden outline and 3px offset
    - Exclude inputs and textareas to preserve clean underline styles
    - _Requirements: 11.5_
  - [x] 25.5 Package command for Amazon Appstore
    - Add `"package": "vite build && (cd dist && zip -FS -r ../family-story-night.zip ./*)"` to `package.json`
    - _Requirements: 11.2_

---

## Notes

- All 11 features are fully wired, backward compatible, and verified.
- Full test suite: 18 client test suites (104 tests) and 2 server test suites (23 tests) passing with 0 errors.
- Build compiles production bundle with zero warnings/errors.
