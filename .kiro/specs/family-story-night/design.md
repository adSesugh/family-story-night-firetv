# Family Story Night - Design Document

## Overview

Family Story Night is a Fire TV web application that generates personalized, illustrated bedtime stories for families. The system comprises two primary layers:

- **Frontend**: A React-based single-page application (SPA) that manages user input, story display, and audio playback with Fire TV remote compatibility
- **Backend**: An Express server that orchestrates AWS Bedrock for story generation and AWS Polly for text-to-speech narration

The application guides users through three screen states:
1. **Setup Screen**: Collect family member names and theme selection
2. **Loading Screen**: Display progress indicator during story generation
3. **Story Screen**: Display and navigate story pages with synchronized audio narration

The entire experience is optimized for viewing on a TV screen with remote control interaction, featuring a warm, book-like aesthetic designed to evoke a cozy bedtime environment.

## Architecture

### System-Level Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     FAMILY STORY NIGHT SYSTEM                   │
└─────────────────────────────────────────────────────────────────┘

USER INTERACTION (Fire TV Remote)
    ↓
┌─────────────────────────────────────────────────────────────────┐
│                    REACT FRONTEND (Vite + React 18)             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ App Component (Global State & Orchestration)            │   │
│  │  • screen: "setup" | "loading" | "story"                │   │
│  │  • names, themeIndex, pages, pageIndex, error           │   │
│  │  • Keyboard event handling (Fire TV remote mapping)     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                            ↓                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Screen Components                                        │   │
│  │ • SetupScreen: Input names, select theme                │   │
│  │ • LoadingScreen: "Turning up the lamp..."               │   │
│  │ • StoryScreen: Display pages, navigation controls       │   │
│  └──────────────────────────────────────────────────────────┘   │
│                            ↓                                     │
│                 HTTP API Calls (REST JSON)                       │
└─────────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────────┐
│                 EXPRESS BACKEND (Node.js)                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ /generate-story (POST)                                   │   │
│  │  Input:  { familyMembers: string[], theme: string }     │   │
│  │  Output: { pages: string[] }                            │   │
│  │  Action: Invoke AWS Bedrock → Claude model              │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ /narrate (POST)                                          │   │
│  │  Input:  { text: string }                               │   │
│  │  Output: audio/mpeg stream                              │   │
│  │  Action: Invoke AWS Polly → Neural voice synthesis      │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ /health (GET)                                            │   │
│  │  Output: { status: "ok" }                               │   │
│  │  Purpose: Liveness check for deployment                 │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────────┐
│                     AWS SERVICES (Managed)                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Bedrock Runtime (Story Generation)                       │   │
│  │ • Model: Claude 3.5 Sonnet                              │   │
│  │ • Region: us-east-1 (default, configurable)             │   │
│  │ • Input: Detailed prompt with family names & theme      │   │
│  │ • Output: JSON array of 6 page strings                  │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Polly (Audio Narration)                                  │   │
│  │ • Voice: Joanna (neural engine)                          │   │
│  │ • Format: MP3                                            │   │
│  │ • Input: Plain text from page                            │   │
│  │ • Output: Audio stream (audio/mpeg)                      │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Frontend Architecture

#### React Component Hierarchy

```
App
├── Screen State Management (useState, useRef, useCallback, useEffect)
├── Keyboard Event Handler (Fire TV remote mapping)
├── Audio Playback Controller (useRef + useEffect)
├── Auto-advance Logic (page turn after narration)
│
├── SetupScreen (conditionally rendered)
│   ├── Family names input field
│   ├── Theme selector with dot indicators
│   ├── Error message display
│   └── "Begin the story" button
│
├── LoadingScreen (conditionally rendered)
│   └── "Turning up the lamp..." message
│
└── StoryScreen (conditionally rendered)
    ├── Story page text (with page-in animation)
    ├── Page navigation buttons (Previous/Next)
    ├── Page counter (e.g., "Page 1 of 6")
    └── Auto-advance on narration end
```

#### State Variables (App Component)

| Variable | Type | Purpose |
|----------|------|---------|
| `screen` | `"setup"\|"loading"\|"story"` | Current UI screen |
| `names` | `string` | Comma-separated family member names |
| `themeIndex` | `number` | Index into THEMES array (0-3) |
| `pages` | `string[]` | All 6 story pages from Bedrock |
| `pageIndex` | `number` | Current page being displayed |
| `error` | `string\|null` | Error message to display on Setup Screen |
| `turnKey` | `number` | Incremented to trigger page-turn animation |
| `audioRef` | `React.Ref<HTMLAudioElement>` | Reference to HTML5 audio element |

#### Key React Hooks and Patterns

**1. Story Generation Flow (`generateStory` callback)**
```typescript
const generateStory = useCallback(async () => {
  setError(null);
  setScreen("loading");
  try {
    // Parse names: comma-separated → trimmed array
    const familyMembers = names
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean);

    // POST to /generate-story
    const res = await fetch(`${API_BASE}/generate-story`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ familyMembers, theme: THEMES[themeIndex] }),
    });

    if (!res.ok) throw new Error("Story generation failed");
    const data = await res.json();

    // Update state and transition to story screen
    setPages(data.pages || []);
    setPageIndex(0);
    setTurnKey((k) => k + 1); // Trigger animation
    setScreen("story");
  } catch (err) {
    // Fallback to setup with error message
    setError("Couldn't reach the storyteller. Is the backend running?");
    setScreen("setup");
  }
}, [names, themeIndex]);
```

**Dependencies**: `names`, `themeIndex` — regenerated if either changes

**2. Audio Narration with Auto-Advance (`useEffect` for audio)**
```typescript
// Fetch and play narration whenever the current page changes
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
    cancelled = true; // Cleanup: prevent memory leaks
  };
}, [screen, pageIndex, pages]);
```

**Auto-advance After Narration:**
```typescript
useEffect(() => {
  if (!audioRef.current) return;

  const audio = audioRef.current;
  let turnTimer = null;

  const handleEnded = () => {
    if (screen !== "story" || pageIndex >= pages.length - 1) return;

    // After 1200ms delay, advance to next page
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
```

**3. Fire TV Remote Keyboard Mapping**
```typescript
useEffect(() => {
  const handleKeyDown = (e) => {
    if (screen === "setup") {
      if (e.key === "ArrowDown") {
        setThemeIndex((i) => (i + 1) % THEMES.length);
      }
      if (e.key === "ArrowUp") {
        setThemeIndex((i) => (i - 1 + THEMES.length) % THEMES.length);
      }
      if (e.key === "Enter") {
        generateStory();
      }
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
```

**Remote Button Mapping**:
- ↑ (ArrowUp): Cycle backward through themes
- ↓ (ArrowDown): Cycle forward through themes
- → (ArrowRight): Next page
- ← (ArrowLeft): Previous page
- Enter: Generate story (Setup) / Next page (Story)
- Back (Escape/Backspace): Return to Setup Screen

#### Theme Configuration

```typescript
const THEMES = [
  "a cozy adventure",
  "a magical treasure hunt",
  "a trip to outer space",
  "a friendly dragon's forest",
];
```

Four predefined themes, displayed in visual dots on Setup Screen. User cycles through with arrow keys.

#### Visual Design System (Tailwind CSS)

**Color Palette**:
- `dusk`: `#151030` — Dark blue background (main canvas)
- `parchment`: `#F4EFE6` — Warm light tan (primary text)
- `lamp`: `#E8A33D` — Warm gold (interactive elements, accents)
- `starlight`: `#7C93C9` — Soft purple (secondary text, labels)
- `panel`: `#2A2158` — Deep purple panel (story text background)

**Typography**:
- **Serif**: `Fraunces` (with Georgia, serif fallback) — story text, headings
- **Sans**: `Inter` (system-ui fallback) — labels, buttons, UI

**Animations**:
- `page-in`: 400ms ease-out fade-in and slight upward slide (appliedto story page text)

**Layout Strategy**:
- Full-screen (100vh, 100vw) centered container
- Radial light gradient behind main content to evoke ambient lamp lighting
- Rounded corners with shadow depth on story panel for book-like appearance
- Large text sizing for TV viewing (3xl+ body, 6xl headings)

#### Component Details

**SetupScreen**:
- Family name input with serif font, large placeholder text
- Theme selector with visual dot indicators
- Theme name displayed below input
- Color-coded dots: active = lamp color, inactive = starlight/30
- "Begin the story" button with hover scale effect
- Error message display in red

**LoadingScreen**:
- Centered italic text: "Turning up the lamp…"
- Minimal UI to convey waiting state
- No interactive elements

**StoryScreen**:
- Story text in semi-transparent panel with rounded corners and shadow
- Page counter: "Page X of 6" in center
- Previous/Next buttons with opacity toggle (disabled at boundaries)
- Keyboard hint text below buttons
- Page-turn animation on every page change

### Backend Architecture

#### Express Server Setup

```javascript
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const REGION = process.env.AWS_REGION || "us-east-1";
const MODEL_ID = process.env.BEDROCK_MODEL_ID || "amazon.nova-pro-v1:0";

const bedrock = new BedrockRuntimeClient({ region: REGION });
const polly = new PollyClient({ region: REGION });

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server on port ${PORT}`));
```

#### Endpoint: POST /generate-story

**Request**:
```json
{
  "familyMembers": ["Maya", "Dad", "Biscuit the dog"],
  "theme": "a cozy adventure"
}
```

**Response**:
```json
{
  "pages": [
    "Once upon a time, Maya and Dad were tucking in Biscuit the dog...",
    "The adventure began when a mysterious door appeared...",
    "...",
    "...",
    "...",
    "And they all fell asleep under the stars."
  ]
}
```

**Behavior**:
1. Validate `familyMembers` array is non-empty; return 400 if absent
2. Construct detailed prompt for Claude:
   - Include all family member names
   - Specify theme
   - Request exactly 6 pages
   - Specify 2-3 sentences per page
   - Instruct: no dashes, hyphens, or em dashes (plain language only)
3. Invoke Bedrock runtime with Claude model
4. Parse response as JSON array of strings
5. Fallback: If JSON parsing fails, split response into 6 rough chunks
6. Return `{ pages: [...] }` to frontend

**Configuration**:
- `AWS_REGION`: Defaults to `us-east-1`
- `BEDROCK_MODEL_ID`: Defaults to `amazon.nova-pro-v1:0`
- AWS credentials: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (required)

**Error Handling**:
- 400: Missing or empty `familyMembers`
- 500: Bedrock invocation failure, JSON parsing failure, or other runtime error

#### Endpoint: POST /narrate

**Request**:
```json
{
  "text": "Once upon a time, Maya and Dad were tucking in Biscuit the dog..."
}
```

**Response**: Audio stream (content-type: `audio/mpeg`)

**Behavior**:
1. Validate `text` is present; return 400 if absent
2. Invoke Polly SynthesizeSpeechCommand:
   - Voice: `Joanna` (human-like, female)
   - Engine: `neural` (natural prosody)
   - OutputFormat: `mp3`
3. Stream the audio data to the response
4. Frontend receives blob and creates object URL for playback

**Error Handling**:
- 400: Missing `text` parameter
- 500: Polly invocation failure or other runtime error

**Frontend Resilience**:
- If `/narrate` fails, log error and continue story without audio
- Story display and page navigation unaffected

#### Endpoint: GET /health

**Response**:
```json
{
  "status": "ok"
}
```

**Purpose**: Kubernetes/container liveness probe, deployment health check

## Components and Interfaces

### Frontend Component API

#### App (Root Component)
- **Props**: None
- **State**: Global state for all screens
- **Renders**: Conditional rendering based on `screen` state
- **Side effects**: Keyboard events, audio playback, API calls

#### SetupScreen
- **Props**:
  - `names: string` — Current input value
  - `setNames: (s: string) => void` — Update names input
  - `themeIndex: number` — Selected theme index
  - `setThemeIndex: (i: number) => void` — Update theme selection
  - `error: string | null` — Error message
  - `onSubmit: () => void` — Trigger story generation
- **Renders**: Input field, theme selector, buttons, error message

#### LoadingScreen
- **Props**: None
- **Renders**: Loading message only

#### StoryScreen
- **Props**:
  - `pages: string[]` — All story pages
  - `pageIndex: number` — Current page index
  - `turnKey: number` — Incremented to trigger animation
  - `onTurn: (pageIndex: number) => void` — Navigate to page
- **Renders**: Current page with navigation

### API Contracts

#### POST /generate-story
- **Content-Type**: `application/json`
- **Request Body**:
  ```typescript
  {
    familyMembers: string[];    // Non-empty array
    theme: string;               // One of 4 predefined themes
  }
  ```
- **Response Body**:
  ```typescript
  {
    pages: string[];             // Array of exactly 6 page strings
  }
  ```
- **Status Codes**: 200 (success), 400 (validation), 500 (server error)

#### POST /narrate
- **Content-Type**: `application/json` (request), `audio/mpeg` (response)
- **Request Body**:
  ```typescript
  {
    text: string;                // Page text to narrate
  }
  ```
- **Response**: Binary audio/mpeg stream
- **Status Codes**: 200 (success), 400 (validation), 500 (server error)

#### GET /health
- **Response Body**:
  ```typescript
  {
    status: "ok";
  }
  ```

## Data Models

### Story Object

```typescript
interface Story {
  pages: string[];  // Array of 6 narrative strings
}
```

Each page is a plain string containing 2-3 sentences of narrative text, with no special formatting (no dashes, hyphens, or em dashes).

### Theme

```typescript
type Theme = 
  | "a cozy adventure"
  | "a magical treasure hunt"
  | "a trip to outer space"
  | "a friendly dragon's forest";
```

Themes are predefined constants; no runtime generation or user input.

### Application State

```typescript
interface AppState {
  screen: "setup" | "loading" | "story";
  names: string;
  themeIndex: number;
  pages: string[];
  pageIndex: number;
  error: string | null;
  turnKey: number;
}
```

All state lives in the App component via `useState` hooks.

## Error Handling

### Frontend Error Handling

**Setup Screen**:
- Failed story generation: Display error message, remain on Setup Screen
- Error message: "Couldn't reach the storyteller. Is the backend running?"
- User can retry by entering names and pressing Enter again

**Story Screen**:
- Narration failure: Log error, continue story playback without audio
- No UI indication; story remains readable
- User can still navigate pages

**Network Errors**:
- Caught in try-catch blocks around fetch calls
- Error state prevents indeterminate UI (e.g., stuck on loading)

### Backend Error Handling

**POST /generate-story**:
- Empty `familyMembers`: Return 400 with error message
- Bedrock API failure: Return 500, log error
- JSON parse failure: Fallback to splitting response into chunks

**POST /narrate**:
- Missing `text`: Return 400 with error message
- Polly API failure: Return 500, log error
- Frontend catches and continues without audio

**Principle**: Fail gracefully without leaving the user in an indeterminate state.

## Testing Strategy

### Unit Tests (Frontend - React)

**Test Type: Example-based unit tests** (not property-based)

Reasoning: React components involve UI rendering, side effects, and browser APIs that are not suitable for property-based testing. These benefit from specific example-based tests and integration tests.

#### Components to Test

1. **SetupScreen Component**
   - Renders input field, theme selector, buttons
   - Updates parent state on input change
   - Cycles themes correctly with theme index
   - Calls onSubmit when "Begin the story" button clicked
   - Displays error message when provided
   - Theme dots show active/inactive state

2. **StoryScreen Component**
   - Renders current page from pages array
   - Displays correct page counter ("Page X of 6")
   - Next button disabled on last page
   - Previous button disabled on first page
   - onTurn callback fired with correct index on button click
   - Page-in animation applied via CSS class

3. **LoadingScreen Component**
   - Renders loading message
   - No interactive elements

4. **App Component - State Management**
   - Initial state: screen = "setup", empty names, themeIndex = 0
   - Transitions to "loading" on story generation
   - Transitions to "story" when pages received
   - Returns to "setup" on error
   - Page navigation updates pageIndex correctly
   - Error message displayed and cleared appropriately

5. **Keyboard Event Handling**
   - ArrowUp cycles themes backward on Setup Screen
   - ArrowDown cycles themes forward on Setup Screen
   - Enter generates story on Setup Screen
   - ArrowRight advances page on Story Screen
   - ArrowLeft goes to previous page on Story Screen
   - Backspace/Escape returns to Setup Screen
   - No action outside valid screen state

6. **Audio Playback**
   - Audio element created and referenced
   - Narration URL fetched and set on page change
   - Audio auto-advances to next page after playback ends (1200ms delay)
   - Audio paused when page changes while playing

#### Test Examples

```javascript
describe("SetupScreen", () => {
  it("renders theme selector with all 4 themes", () => {
    // Render component
    // Assert 4 dots are visible
  });

  it("calls onSubmit when button clicked", () => {
    // Render with mock onSubmit
    // Click button
    // Assert onSubmit called
  });

  it("displays error message when provided", () => {
    // Render with error prop
    // Assert error text visible
  });
});

describe("App - Keyboard Navigation", () => {
  it("cycles forward through themes on ArrowDown", () => {
    // Render App
    // Simulate ArrowDown
    // Assert themeIndex incremented
  });

  it("returns to setup on Backspace in story screen", () => {
    // Navigate to story screen
    // Simulate Backspace
    // Assert screen === "setup"
  });
});

describe("App - Audio Playback", () => {
  it("fetches narration and plays audio on page change", async () => {
    // Mock fetch for /narrate endpoint
    // Change pageIndex
    // Assert fetch called
    // Assert audio.play() called
  });

  it("auto-advances to next page after narration ends", async () => {
    // Mock audio ended event
    // Trigger ended event after 1200ms
    // Assert pageIndex incremented
  });
});
```

### Integration Tests (API - Backend)

**Test Type: Example-based integration tests** (not property-based)

Reasoning: AWS service integrations (Bedrock, Polly) are external dependencies. We test with specific example payloads to verify the integration works correctly, not with generated inputs.

#### Tests to Implement

1. **POST /generate-story Integration**
   - Valid request: Returns 6 pages with correct structure
   - Empty familyMembers: Returns 400
   - Missing theme: Uses default theme
   - Bedrock failure: Returns 500
   - JSON parsing failure: Fallback chunking works

2. **POST /narrate Integration**
   - Valid text: Returns audio/mpeg stream
   - Missing text: Returns 400
   - Polly failure: Returns 500

3. **GET /health**
   - Returns { status: "ok" }

#### Test Examples

```javascript
describe("POST /generate-story", () => {
  it("generates 6-page story with valid input", async () => {
    const response = await request(app)
      .post("/generate-story")
      .send({
        familyMembers: ["Alice", "Bob"],
        theme: "a cozy adventure",
      });
    expect(response.status).toBe(200);
    expect(response.body.pages).toHaveLength(6);
    expect(response.body.pages.every(p => typeof p === "string")).toBe(true);
  });

  it("returns 400 when familyMembers is empty", async () => {
    const response = await request(app)
      .post("/generate-story")
      .send({
        familyMembers: [],
        theme: "a cozy adventure",
      });
    expect(response.status).toBe(400);
  });
});

describe("POST /narrate", () => {
  it("returns audio/mpeg stream for valid text", async () => {
    const response = await request(app)
      .post("/narrate")
      .send({ text: "Once upon a time..." });
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("audio/mpeg");
  });
});

describe("GET /health", () => {
  it("returns status ok", async () => {
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
  });
});
```

### End-to-End Tests (Frontend + Backend)

**Test Type: Example-based E2E tests**

1. **Complete Story Flow**
   - Launch app
   - Enter family names and select theme
   - Click "Begin the story"
   - Wait for loading screen
   - Story screen renders with page 1
   - Narration plays
   - Navigate to next page with arrow key
   - Verify new page displays and narration plays
   - Return to setup with Backspace
   - Verify setup screen displays

2. **Error Scenarios**
   - Backend unreachable: Error message on Setup Screen
   - Invalid input (no names): Prevent story generation
   - Narration failure: Story continues without audio

### Testing Tools and Configuration

**Frontend Testing Stack**:
- **Test Runner**: Vitest (already in package.json ecosystem)
- **Component Testing**: React Testing Library (shallow + integration tests)
- **Mocking**: `jest.mock()` for fetch, audio element

**Backend Testing Stack**:
- **Test Runner**: Vitest or Jest
- **HTTP Testing**: Supertest for endpoint testing
- **AWS SDK Mocking**: `@aws-sdk/smithy-client` mocks or localstack for local testing

**Test Organization**:
- Frontend: `client/src/__tests__/`
- Backend: `server/__tests__/`
- E2E: `e2e/`

## Correctness Properties

**Why Property-Based Testing is NOT Applicable for This Feature**

This application is not a suitable candidate for property-based testing (PBT) for several reasons:

1. **UI Rendering**: React components display visual content that varies with input state. While some state transitions can be tested, the rendering itself (layout, positioning, visual feedback) is not amenable to universal property testing. UI tests are better served by snapshot tests, visual regression tests, and specific example-based tests.

2. **External AWS API Dependencies**: The `/generate-story` endpoint invokes AWS Bedrock, and `/narrate` invokes AWS Polly. These are external managed services; running 100+ iterations against them is costly and unnecessary. Testing AWS service behavior is better served by integration tests with 1-3 representative examples.

3. **Stateful Browser APIs**: Audio playback relies on the HTML5 `<audio>` element, which is a browser API with side effects (DOM state, playback timing). The behavior of audio events and timing is deterministic for specific scenarios but not universally generalizable across random inputs in a way that would add value with 100+ iterations.

4. **Configuration and Setup**: Many acceptance criteria concern one-time setup (theme selection, initial state transitions) or infrastructure wiring (API endpoint availability). These are smoke tests or integration tests, not property-based tests.

Instead, correctness properties serve as a specification layer that guides example-based unit and integration test implementations. The properties below document the invariants, state transitions, and API contracts that the application must maintain.

---

### UI State Invariants

### Property 1: Valid Screen State**
**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

The `screen` state variable must always be one of exactly three valid values: `"setup"`, `"loading"`, or `"story"`. No other values are permitted, and transitions between these states must follow defined rules.

**Invariant**: `screen ∈ {"setup", "loading", "story"}`

**Implications for Testing**:
- App initial state must render Setup Screen
- Transitions must always move between these three states
- No state should render multiple screens simultaneously
- Error conditions must transition back to "setup", never to an undefined state

**Example-Based Tests**:
- Initial render: screen === "setup"
- After story generation starts: screen === "loading"
- After pages received: screen === "story"
- After error: screen === "setup" with error message

---

### Property 2: Page Animation Trigger**
**Validates: Requirements 4.6**

When the `pageIndex` is updated, the `turnKey` counter must be incremented to trigger the page-turn animation. This ensures that returning to a previously-viewed page (same `pageIndex`) still triggers the animation (because `turnKey` is different).

**Invariant**: `pageIndex` changes → `turnKey` increments (monotonically)

**Implications for Testing**:
- Moving from page 2 to page 3: pageIndex changes, turnKey increments
- Returning from page 3 to page 2: pageIndex changes, turnKey increments (animation plays again)
- Static page (no navigation): turnKey does not change unless pageIndex changes
- Animation CSS class is applied only when turnKey changes

**Example-Based Tests**:
- Navigate to page 3: turnKey incremented
- Navigate back to page 1: turnKey incremented again (different value)
- Stay on page 1: turnKey does not change
- Animation effect re-triggers on second visit to same page

---

### Property 3: Pages Array Presence**
**Validates: Requirements 3.1, 3.2, 3.3**

The `pages` array can only be non-empty when the `screen` state is either `"loading"` or `"story"`. When on the Setup Screen, the pages array must be empty or not used. If the screen transitions back to Setup due to error, pages must be cleared or retained but ignored.

**Invariant**: `pages.length > 0` ⟹ `screen ∈ {"loading", "story"}`

**Contrapositive**: `screen === "setup"` ⟹ `pages.length === 0 OR pages not rendered`

**Implications for Testing**:
- Setup Screen render never accesses `pages`
- Loading Screen may have pages loaded but does not display them
- Only Story Screen reads and displays from `pages`
- Error recovery clears or ignores pages when returning to Setup

**Example-Based Tests**:
- Initial setup screen: pages array is empty
- After story generation: pages array populated with 6 strings
- Remaining on loading screen: pages present but not displayed
- Return to setup after error: pages ignored or cleared

---

### API Contract Invariants

### Property 4: Story Generation Always Produces 6 Pages**
**Validates: Requirements 2.3, 2.6, 2.8**

The `/generate-story` endpoint must always return exactly 6 pages in the response. If Bedrock returns more or fewer, the backend must normalize to exactly 6 (e.g., truncate or fall back to chunking logic).

**Invariant**: `POST /generate-story` → `response.pages.length === 6`

**Implications for Testing**:
- Response validation: always check `pages.length === 6`
- Frontend storage: `pages` array always has exactly 6 elements
- Story Screen pagination: page counter always shows "X of 6"
- No partial story states (e.g., 3 pages before load completes)

**Example-Based Tests**:
- Valid request with 2 family members: returns 6 pages
- Valid request with 5 family members: returns 6 pages
- Bedrock truncates response: backend chunks into 6 pages
- JSON parsing fails: fallback logic produces 6 pages

---

### Property 5: Page Content is Non-Empty**
**Validates: Requirements 2.6, 4.1, 4.2**

Each page in the `pages` array returned by `/generate-story` must be a non-empty string. No page should be an empty string, null, or undefined.

**Invariant**: `∀ page ∈ pages: typeof page === "string" ∧ page.length > 0`

**Implications for Testing**:
- Frontend renders all pages without null/undefined checks
- Each page displays at least some text
- No blank pages in the story
- Type safety: all pages are strings, not other types

**Example-Based Tests**:
- Validate each of 6 pages is a non-empty string
- Empty page is rejected/replaced with fallback text
- Type mismatch (e.g., number, object) is rejected

---

### Property 6: Narration Returns Audio MIME Type**
**Validates: Requirements 5.1, 5.2, 5.3**

The `/narrate` endpoint must always return a response with `content-type: audio/mpeg`. The response body must be a valid binary audio stream that can be played by the HTML5 `<audio>` element.

**Invariant**: `POST /narrate` → `response.headers["content-type"].includes("audio/mpeg")`

**Implications for Testing**:
- Response content-type validation on every narration request
- Frontend `URL.createObjectURL(blob)` receives valid audio blob
- Audio element can play the stream without errors
- No text or invalid audio is returned

**Example-Based Tests**:
- Valid page text: returns audio/mpeg stream
- Polly returns valid MP3: plays without errors
- Invalid text or Polly failure: error is caught, not crash

---

### Property 7: Health Endpoint Always Returns OK Status**
**Validates: Requirements 10.5**

The `/health` endpoint must always return a JSON response with `status: "ok"`. This is a liveness check for deployment.

**Invariant**: `GET /health` → `response.body.status === "ok"`

**Implications for Testing**:
- Container health checks always succeed if backend is running
- No conditional logic (never returns "degraded" or other statuses in this version)
- Synchronous response (no async work)

**Example-Based Tests**:
- Backend running: `/health` returns status ok
- Used by Kubernetes or load balancers to verify liveness

---

### Audio Playback Invariants

### Property 8: Only One Audio Element Playing at a Time**
**Validates: Requirements 5.4, 5.5**

The application maintains a single `<audio>` element (referenced via `audioRef`). When a new narration is requested (page change), any existing audio playback must be stopped and the audio element repurposed for the new narration.

**Invariant**: `audioRef.current.paused === false` ⟹ `pageIndex` matches currently playing page

**Implications for Testing**:
- Page navigation pauses existing audio before fetching new narration
- Audio URL is reset when navigating
- No overlapping audio streams
- `audioRef.current.pause()` is called before loading new source

**Example-Based Tests**:
- Page 1 audio playing: navigate to page 2
  - Page 1 audio paused
  - New narration fetched for page 2
  - Page 2 audio plays
- Audio ends before user navigates: auto-advance triggers

---

### Property 9: Auto-Advance Does Not Trigger on Last Page**
**Validates: Requirements 5.6**

When audio playback ends, the auto-advance logic checks if the current page is the last page (pageIndex === 5 for 6-page story). If so, auto-advance does not fire; the user must manually navigate backward or return to Setup.

**Invariant**: `pageIndex === 5` ∧ `audio.ended` ⟹ `auto-advance does not fire`

**Contrapositive**: `auto-advance fires` ⟹ `pageIndex < 5`

**Implications for Testing**:
- Last page audio plays without auto-advance
- Second-to-last page audio auto-advances to page 6
- Page 6 reached: no "Page 7" attempt
- User must intentionally return to Setup

**Example-Based Tests**:
- Audio ends on page 5: auto-advances to page 6
- Audio ends on page 6: no auto-advance
- User tries to navigate past page 6: arrow key has no effect

---

### Property 10: Audio Fetch Cancellation Prevents Memory Leaks**
**Validates: Requirements 5.1**

When audio playback is initiated for a page, a fetch request is made to `/narrate`. If the user navigates to another page before the fetch completes, the `cancelled` flag is set to true, and the fetch result is ignored. This prevents the old audio blob from being retained and played.

**Invariant**: `useEffect` cleanup on page change → `cancelled = true`

**Implications for Testing**:
- Rapid page navigation does not cause multiple audio requests to queue
- Old audio blobs are not retained in memory
- Only the most recent narration request is processed
- No console errors from aborted requests

**Example-Based Tests**:
- Start narration for page 1
- Immediately navigate to page 2 (before page 1 audio fetches)
  - Page 1 fetch is cancelled
  - Page 2 fetch is initiated
  - Page 1 audio does not play
  - Page 2 audio plays when fetch completes

---

### Data Consistency Invariants

### Property 11: Story Pages are Immutable Once Loaded**
**Validates: Requirements 11.1, 11.2**

Once the `pages` array is populated from the `/generate-story` response, it must not be modified. Navigating through pages reads from this immutable array; no mutations (splice, push, etc.) occur after load.

**Invariant**: `pages` loaded → `pages` array never mutated

**Implications for Testing**:
- Page content never changes during story playback
- Revisiting page 3 displays identical text to first visit
- No state management that modifies individual pages
- All page transitions are read-only

**Example-Based Tests**:
- Load story with 6 pages
- Navigate: page 1 → page 3 → page 1
- Page 1 text identical on both visits
- No mutations logged during navigation

---

### Property 12: Page Text Matches Exactly on Revisit**
**Validates: Requirements 11.2, 11.3**

When a user navigates to a page they have already viewed, the page text must be identical to the first viewing. This follows from Property 11 (immutability) but is tested from the user's perspective.

**Invariant**: `page text at index i on first visit` === `page text at index i on second visit`

**Implications for Testing**:
- Story text consistency during the user session
- No re-fetching or regeneration of pages
- No modifications between visits
- Text is deterministic for the loaded story

**Example-Based Tests**:
- Load and view page 2: capture text
- Navigate to page 4
- Navigate back to page 2: text identical
- Repeat for multiple pages and navigation patterns

---

### Property 13: Family Member Names Must be Trimmed and Non-Empty**
**Validates: Requirements 1.6, 12.1, 12.2, 12.3**

Before the `/generate-story` API call, the frontend processes family member names by splitting the input on commas, trimming whitespace, and filtering empty strings. Only non-empty names are sent to the backend.

**Invariant**: `names sent to API` = `trim(names.split(",")).filter(n => n.length > 0)`

**Implications for Testing**:
- Input "  Alice  ,  Bob  " → API receives ["Alice", "Bob"]
- Input "Alice, , Bob" → API receives ["Alice", "Bob"]
- Input "   ,   ,   " → API receives [] (error: no valid names)
- Whitespace-only names are rejected

**Example-Based Tests**:
- Input with extra spaces: trimmed before API call
- Input with empty commas: empty entries filtered
- Input with only whitespace: rejected (error state)
- Valid input processed and sent to API

---

## Sequence Diagrams

### Story Generation Flow

```
User                 Frontend              Backend              Bedrock
  │                    │                      │                    │
  ├─ Enter names ──→   │                      │                    │
  ├─ Select theme ──→  │                      │                    │
  ├─ Press Enter ──→   │                      │                    │
  │                    ├─ Loading Screen ──→  │                    │
  │                    │                      │                    │
  │                    ├─ POST /generate-story→                    │
  │                    │                      ├─ Create prompt ──→ │
  │                    │                      ├─ InvokeModel ───→  │
  │                    │                      │  (await response)   │
  │                    │                      ←─ JSON: 6 pages ────┤
  │                    ←─ { pages: [...] } ───┤                    │
  │                    │                      │                    │
  │                    ├─ Story Screen ──→    │                    │
  │                    ├─ Fetch narration ─→  │                    │
  │                    │  (page 1)            │                    │
```

### Page Navigation with Auto-Advance

```
User                 Frontend             Backend      Audio
  │                    │                    │            │
  │                    ├─ Display Page 1 ──→│            │
  │                    ├─ POST /narrate ────→│            │
  │                    │  (Page 1 text)      │            │
  │                    │                     ├─ Polly ──→ │
  │                    │  (audio blob)       │            │
  │                    ←────────────────────────────────────
  │                    ├─ <audio> play() ───→│            │
  │                    │                     │            │
  │  (wait 4-5 sec)    │                     │  Playing   │
  │                    │                     │            │
  │                    │                     │            │
  │                    │ (audio ended) ←─────┤            │
  │                    ├─ setTimeout 1200ms  │            │
  │                    ├─ pageIndex++ ──────→│            │
  │                    │                     │            │
  │                    ├─ Display Page 2 ──→ │            │
  │                    ├─ POST /narrate ────→ │            │
  │                    │  (Page 2 text)      │            │
  │                    │                     ├─ Polly ──→ │
```

## Configuration and Deployment

### Environment Variables

**Frontend (.env)**:
```
VITE_API_BASE=http://localhost:4000
```

If not set, defaults to `http://localhost:4000` in code.

**Backend (.env)**:
```
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=amazon.nova-pro-v1:0
AWS_ACCESS_KEY_ID=<your-key>
AWS_SECRET_ACCESS_KEY=<your-secret>
PORT=4000
```

### Local Development Setup

**Backend**:
```bash
cd server
npm install
npm run dev
# Runs on http://localhost:4000
```

**Frontend**:
```bash
cd client
npm install
npm run dev
# Runs on http://localhost:5173 (Vite default)
```

### Production Deployment

**Backend**:
- Container image with `node index.js`
- AWS credentials from IAM role or secrets manager
- Configure `AWS_REGION` and `BEDROCK_MODEL_ID` as needed
- Expose port 4000

**Frontend**:
- Build with `npm run build` (outputs to `dist/`)
- Serve static files via CDN or web server
- Set `VITE_API_BASE` to production backend URL
- Deploy to Fire TV app store or web-accessible URL

## Future Enhancements

1. **Story History**: Persist generated stories for later viewing
2. **Custom Themes**: Allow users to describe themes in their own words
3. **Multiple Voices**: Support different Polly voices and languages
4. **Story Length Options**: Generate 4, 6, or 8-page stories
5. **Illustrations**: Generate or fetch illustrations for each page
6. **Parent Controls**: Password-protected settings for customization
7. **Analytics**: Track story generation and feature usage

