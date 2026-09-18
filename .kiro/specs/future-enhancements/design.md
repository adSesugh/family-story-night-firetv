# Future Enhancements - Technical Design

## Architecture Overview

The future enhancements will extend the current MVP without breaking existing functionality. The design prioritizes:

1. **Backward Compatibility**: Existing users see no changes if they don't opt into new features
2. **Progressive Enhancement**: Features degrade gracefully
3. **Client-Side First**: Minimize backend changes; leverage browser APIs (localStorage, etc.)
4. **Modular Implementation**: Each feature can be developed and deployed independently

## Feature 1: Story History - Design

### Data Structure

```javascript
// localStorage key: "familyStoryNight_history"
{
  stories: [
    {
      id: "uuid-timestamp",
      generatedAt: "2024-01-15T20:30:00Z",
      familyMembers: ["Maya", "Dad", "Biscuit"],
      theme: "a magical treasure hunt",
      pages: [...],
      firstPage: "Page 1 content...",
      narration: { /* narration metadata */ }
    }
  ],
  version: 1
}
```

### UI Changes

**SetupScreen**:
- Add "View History" button below theme selector (only if history exists)
- Button labeled: "📖 View History" or similar icon

**New HistoryScreen Component**:
- List of stories with date, family names, theme, preview
- Click story to view full content
- Delete button per story (with confirmation)
- Clear all history button

**StoryScreen**:
- Add "Save to Favorites" button (optional enhancement)

### Implementation Strategy

1. Save story immediately after generation with UUID
2. Check localStorage on app load to display history button
3. Create HistoryScreen component with simple list + click-to-view
4. Implement localStorage wrapper with error handling

### Browser Compatibility

- localStorage available in all modern browsers
- Graceful fallback: hide history button if localStorage unavailable
- Max storage: ~5-10MB (sufficient for 50 stories)

## Feature 2: Custom Themes - Design

### Data Flow

```
SetupScreen
  ├─ Preset Themes (current)
  ├─ Create Custom Theme button
  └─ Custom Theme Input
       └─ /generate-story endpoint (theme parameter)
             └─ Backend uses custom theme in prompt
                   └─ Story Generation
```

### UI Changes

**SetupScreen**:
- Replace static theme selector with toggle: "Preset" vs "Custom"
- Preset mode: existing selector
- Custom mode: text input (100 char limit)
- Display character count while typing
- Button label changes: "Begin the story" → "Begin the story" (same)

### Backend Changes

```javascript
// /generate-story POST
{
  familyMembers: ["Maya", "Dad"],
  theme: "a spooky haunted house adventure", // Can be custom or preset
  isCustomTheme: true // Indicator for logging/analytics
}
```

### Constraints

- Custom theme max 100 characters (to fit in prompts)
- Backend validates theme is appropriate (content filtering)
- Cache common custom themes for performance

## Feature 3: Multiple Voices - Design

### Voice Configuration

```javascript
const VOICES = [
  { id: "Joanna", name: "Joanna (warm, friendly)", region: "en-US" },
  { id: "Matthew", name: "Matthew (calm, deep)", region: "en-US" },
  { id: "Emma", name: "Emma (youthful)", region: "en-US" },
  { id: "Ivy", name: "Ivy (young, bright)", region: "en-US" }
];
```

### UI Changes

**SetupScreen**:
- Add voice selector (dropdown or radio buttons)
- Display currently selected voice
- Default: Joanna

**State Management**:
- Store selected voice in React state
- Persist to localStorage
- Pass voice ID in narrate requests

### Backend Changes

```javascript
// /narrate POST
{
  text: "Once upon a time...",
  voiceId: "Joanna", // New parameter
  language: "en-US"  // Future expansion
}

// Polly call
polly.synthesizeSpeech({
  Text: text,
  VoiceId: voiceId,
  OutputFormat: 'mp3'
})
```

### Frontend Implementation

```javascript
// App.jsx
const [voice, setVoice] = useState("Joanna");

// StoryScreen - narration effect
const res = await fetch(`${API_BASE}/narrate`, {
  method: "POST",
  body: JSON.stringify({ 
    text: pages[pageIndex],
    voiceId: voice // Include voice selection
  })
});
```

## Feature 4: Story Length Options - Design

### UI Changes

**SetupScreen**:
- Add length selector below theme (radio buttons or tabs)
- Options: 4 pages, 6 pages (default), 8 pages
- Visual indicator: "Short Story", "Standard", "Long Story"

### Backend Changes

```javascript
// /generate-story POST
{
  familyMembers: ["Maya", "Dad"],
  theme: "a magical treasure hunt",
  storyLength: 6 // New parameter: 4, 6, or 8
}

// Backend adjusts prompt:
// "Generate a BEDTIME STORY with approximately 6 pages..."
```

### Implementation

- Frontend stores length selection in state
- Pass to story generation endpoint
- Backend validates: 4 <= length <= 8
- Generate story with specific page count

## Feature 5: Illustrations - Design

### Deferred Implementation

**Rationale**: Resource-intensive, multiple implementation paths, lower priority

**Approach**: Design for future without current implementation

```javascript
// Story data structure (future)
{
  pages: [
    {
      text: "Once upon a time...",
      illustration: {
        url: "https://...",
        alt: "A magical forest with glowing trees"
      }
    }
  ]
}
```

**Storyscreen enhancement**:
```jsx
<SwiperSlide>
  {page.illustration && <img src={page.illustration.url} alt={page.illustration.alt} />}
  <p>{page.text}</p>
</SwiperSlide>
```

## Feature 6: Parent Controls - Design

### PIN Management

```javascript
// localStorage key: "familyStoryNight_parentSettings"
{
  pinHash: "hashed-pin", // Simple hash, not cryptographic
  settings: {
    allowCustomThemes: true,
    allowHistory: true,
    ageRestriction: "all",
    defaultVoice: "Joanna",
    lockedUntil: null // Timestamp if PIN required
  }
}
```

### UI Flow

1. SetupScreen: Hidden "Settings" button (long press or easter egg)
2. SettingsScreen: Prompt for PIN (first time), then parent panel
3. Parent Panel: Checkboxes/toggles for each setting
4. Lock: Optional PIN lock on settings

### Implementation Strategy

- Initially: Settings button visible (for MVP enhancement)
- Later: Easter egg or long-press to access
- Simple 4-digit PIN (localStorage only, not backend)
- No cryptographic security; family-friendly only

## Feature 7: Analytics - Design

### Local Analytics Schema

```javascript
// localStorage key: "familyStoryNight_analytics"
{
  events: [
    {
      timestamp: "2024-01-15T20:30:00Z",
      type: "story_generated",
      data: {
        familyMembers: ["Maya", "Dad"],
        theme: "magical treasure hunt",
        storyLength: 6,
        generationTime: 2.5, // seconds
        voiceSelected: "Joanna"
      }
    },
    {
      timestamp: "2024-01-15T20:35:00Z",
      type: "story_completed",
      data: { totalPages: 6, timeSpent: 5 } // minutes
    }
  ]
}
```

### Dashboard (Parent Controls)

```
📊 Story Analytics
━━━━━━━━━━━━━━━━
Stories Generated: 12
Most Popular Theme: "Magical Adventures" (4x)
Avg. Completion Rate: 92%
Favorite Family Members: ["Maya", "Dad"]
Favorite Voice: Joanna (8x)
```

### Privacy-First Approach

- All data stored locally in browser
- No cloud transmission by default
- Parent can opt-in to analytics sync (future)
- No tracking of behavior outside app

## Implementation Priority & Sequencing

### Phase 1: Story History + Story Length (4 weeks)

**Week 1-2: Story History**
- Create HistoryScreen component
- Implement localStorage save/load
- Add history button to SetupScreen

**Week 3-4: Story Length**
- Add length selector to SetupScreen
- Update /generate-story endpoint
- Backend prompt adjustment

### Phase 2: Custom Themes + Multiple Voices (4 weeks)

**Week 5-6: Custom Themes**
- Toggle between preset/custom on SetupScreen
- Validate theme input (length, content)
- Update backend to accept custom themes

**Week 7-8: Multiple Voices**
- Add voice selector to SetupScreen
- Pass voiceId to /narrate endpoint
- Backend integration with Polly

### Phase 3: Parent Controls + Analytics (optional)

**Week 9-10: Parent Controls**
- Settings screen and PIN logic
- localStorage for settings persistence
- Enforce settings across app

**Week 11-12: Analytics**
- Event tracking system
- Analytics dashboard in parent panel
- Data export option

## Database & Backend Scalability

### Current MVP

- Stateless server
- Story generation on-demand
- No persistence (except client-side audio)

### With Enhancements

- Consider adding database if cloud analytics needed
### Extended /generate-story API

```javascript
POST /generate-story
{
  familyMembers: ["Maya", "Dad"],
  theme: "a cozy mountain cabin",
  storyLength: 6,
  isCustomTheme: false,
  selectedChoice: "Explore the secret attic", // Chapter continuation
  chapter: 2,                                // Current chapter counter
  previousSummary: "Maya and Dad found a key" // Prior storyline context
}

// Response
{
  pages: ["Page 1 text...", ...],
  lesson: "Curiosity lights up even the quietest rooms.",
  choices: [
    "Open the wooden chest under the window",
    "Peer through the brass telescope at the stars"
  ],
  chapter: 2
}
```

## Feature 8: Bedtime Lessons & Story Morals - Design

### Data Structure & Prompt Engineering
Bedrock prompt instructs Claude 3.5 Sonnet to output a JSON object containing `pages`, `lesson`, and `choices`.

```javascript
// Story Object Extension
{
  id: "uuid",
  chapter: 1,
  lesson: "True courage means helping others even when you are small.",
  choices: [...],
  pages: [...]
}
```

### Narration Flow
When `pageIndex >= pages.length` (conclusion slide):
Audio effect triggers `/narrate` with text:
`"The End. Tonight's lesson: [lesson]"` using the user's selected neural voice.

## Feature 9: Interactive Next Chapter Choices - Design

### State Machine & Continuity Flow
- `conclusionFocusIndex`: `0` (Choice 1), `1` (Choice 2), `2` (Return Home).
- Selecting a choice:
  1. Sets screen to `"loading"`.
  2. Increments `chapter` to `N + 1`.
  3. Pre-fetches Chapter `N + 1` from `/generate-story` with `selectedChoice` and `previousSummary`.
  4. Immediately fetches initial illustration, saves to history, and starts Chapter `N + 1`.

### D-pad Directional Matrix
- `ArrowRight`: Focuses next choice (0 → 1).
- `ArrowLeft`: Focuses previous choice (1 → 0). Pressing Left from Choice 0 navigates back to the last story page.
- `ArrowDown`: Moves down to Return Home button.
- `ArrowUp`: Moves up from Return Home to Choice 1.
- `Enter / Select`: Activates focused item.

## Feature 10: Living Picture Book (Ken Burns & Ambient Motion) - Design

### CSS Camera Variations
Alternating 22s GPU-accelerated keyframes:
- `animate-kenburns-0`: Scale 1.0 → 1.12 with subtle left drift.
- `animate-kenburns-1`: Scale 1.1 → 1.18 diagonal pan top-left to bottom-right.
- `animate-kenburns-2`: Scale 1.16 → 1.04 zoom-out reveal.
- `animate-kenburns-3`: Scale 1.06 → 1.16 reverse diagonal pan.

### Ambient Particles Overlay
`<AmbientParticles count={14} />`:
- 14 deterministic motes: warm amber fireflies with CSS box-shadow glows and starlight motes.
- Drift vertically and horizontally via `@keyframes float-mote`.
- Disables automatically when `prefers-reduced-motion: reduce`.

## Feature 11: Fire TV Web App Packaging & TV Experience - Design

### Manifest & Packaging
- `client/public/manifest.json`: Defines `standalone`/`fullscreen`, `orientation: "landscape"`, and theme colors `#151030` and `#e8a33d`.
- App icons: `icon-192.png`, `icon-512.png`.
- Packaging command: `npm run package` runs `vite build && (cd dist && zip -FS -r ../family-story-night.zip ./*)`.

### TV Remote Navigation
- Remote media keys: Play/Pause (179), Rewind (227), Fast Forward (228), Back (4, 8, 27).
- Global Home key: BrowserHome/Home (36) returns to Setup from any screen.
- Focus rings: High-contrast `:focus-visible:not(input, textarea)` prevents intrusive borders on form inputs while ensuring remote button clarity.

## Feature 12: Illustration Performance, Concurrent Generation & Resilience - Design

### Multi-Model Bedrock Engine
- `amazon.nova-canvas-v1:0` integration:
  - Payload: `{ taskType: "TEXT_IMAGE", textToImageParams: { text: prompt }, imageGenerationConfig: { numberOfImages: 1, quality: "standard", height: 768, width: 1280, cfgScale: 8.0 } }`
  - Base64 extraction from `response.images[0]`.
- SD 3.5 Large / SDXL dynamic adaptation based on `BEDROCK_IMAGE_MODEL_ID`.
- Prompt safety guard: on `ValidationException`, automatically purges complex scene text and falls back to theme-level sanitized prompt.
- Deterministic SVG stardust fallback: returns inline SVG data URI if AWS fails, preventing loading locks.

### Client Worker Pool
- Concurrency limit: 2 workers running concurrently in `fetchIllustrationsProgressive`.
- Cancellation token: `illustrationSessionRef` stops background jobs if user leaves story or triggers a new chapter.
- Living canvas placeholder: glowing golden stardust shimmer with page index indicator during generation.

## Feature 13: Bible Stories & Category Switcher - Design

### Category & Theme Architecture
- `client/src/constants/themes.js`:
  ```javascript
  export const THEME_CATEGORIES = [
    { id: "adventures", label: "Bedtime Adventures", icon: "Sparkles", themes: [...] },
    { id: "bible", label: "Bible Stories", icon: "BookOpen", themes: [...] }
  ];
  ```
- Curated Bible presets: *Noah's Ark, David & Goliath, Daniel in the lions' den, Jonah and the great fish, The Good Samaritan, The starry night in Bethlehem*.

### D-pad Navigation Matrix on Setup
- Setup screen listens for `ArrowLeft` and `ArrowRight` when text inputs are not active:
  - Toggles active category (`"adventures"` ↔ `"bible"`).
  - Resets theme index to 0 or clamps to the new list length.
- `ArrowUp` and `ArrowDown` navigate themes within the active category.

### Faith & Character Prompt Engine
- In `server/index.js`, prompt tuning activates when `category === "bible"` or theme is biblical:
  - Weaves children/family as gentle observers or helpers (e.g. gathering smooth river stones, folding blankets, tending animals).
  - Emphasizes virtues: trust, peace, kindness, humility, and courage.
  - Guarantees calm bedtime tone (no violence, frightening monsters, or frightening peril).
  - Amazon Nova Canvas prompt tuned with soft radiant light beams, ancient olive trees, starlit canopies, and warm luminous watercolor tones.

## Testing Strategy

Each feature is thoroughly tested across:
1. **Unit Tests**: Component logic, localStorage, voice resolution, token scaling, device detection, category switching.
2. **Integration Tests**: SetupScreen → Story Generation → Lesson & Choices → Chapter 2 generation.
3. **Hardware / Remote Tests**: Full D-pad simulation (37, 38, 39, 40, 13, 36, 179, 227, 228).
4. **Performance Tests**: Offline compressed storage, Swiper memory cleanup.

## Success Criteria

- ✓ All features maintain 100% backward compatibility
- ✓ All 20 client test suites (113 tests) pass with zero errors
- ✓ All server tests (24 tests) pass
- ✓ Production bundle builds cleanly and packages into submission zip
- ✓ Full hands-free and D-pad remote support on Amazon Fire TV

