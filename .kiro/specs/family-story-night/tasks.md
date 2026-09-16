# Implementation Plan: Family Story Night

## Overview

This document serves as a comprehensive validation and testing checklist for the Family Story Night application. The app is fully implemented; these tasks verify that the implementation meets all requirements from the requirements.md document, includes proper test coverage, and handles edge cases and error scenarios correctly.

The validation is structured in seven phases:
1. **Requirements Verification**: Confirm each requirement is implemented
2. **Component Testing**: Unit tests for React components and keyboard handling
3. **API Testing**: Integration tests for backend endpoints
4. **Audio & Playback Testing**: Audio narration and auto-advance functionality
5. **Error Scenario Testing**: Error handling and fallback behaviors
6. **Fire TV Integration Testing**: Fire TV remote compatibility and edge cases
7. **Documentation & Deployment**: Final validation and deployment readiness

**Testing Approach**: This app is not suitable for property-based testing due to UI rendering, external AWS API dependencies, browser APIs, and stateful effects. Instead, example-based unit tests and integration tests are used to verify specific behaviors and edge cases.

---

## Tasks

### Phase 1: Requirements Verification

- [x] 1. Verify Requirement 1 - Story Generation from Family Input
  - [x] 1.1 Verify Setup Screen displays on app launch
    - Launch the application in browser
    - Confirm Setup Screen is the initial view
    - Verify input field for family names is visible
    - Verify theme selector with dots is displayed
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 1.2 Verify comma-separated name input is accepted
    - Input: "Maya, Dad, Biscuit"
    - Verify system accepts input in input field
    - Confirm comma separation is parsed correctly
    - _Requirements: 1.2, 12.1, 12.2_

  - [x] 1.3 Verify theme selection and display works
    - Input multiple theme selections using arrow keys
    - Verify theme name updates on screen
    - Verify visual indicator (dots) shows active theme
    - Verify all 4 themes are available
    - _Requirements: 1.3, 7.1, 7.2, 7.3_

  - [x] 1.4 Verify story generation submission works
    - Input family names and select theme
    - Press Enter key
    - Verify POST request to /generate-story is sent with correct payload
    - Verify request includes familyMembers array and theme string
    - _Requirements: 1.4, 1.5_

  - [x] 1.5 Verify input validation prevents empty submissions
    - Leave names field empty
    - Press Enter
    - Verify story generation is prevented
    - Verify validation message is displayed
    - _Requirements: 1.6_

- [ ] 2. Verify Requirement 2 - Story Generation via Bedrock
  - [-] 2.1 Verify backend invokes Bedrock with correct prompt
    - Send story generation request with test family names
    - Verify backend constructs prompt with family names
    - Verify prompt includes theme
    - Verify prompt requests exactly 6 pages
    - Verify prompt specifies 2-3 sentences per page
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [-] 2.2 Verify backend parses Bedrock response into 6 pages
    - Generate a story
    - Verify response is JSON with pages array
    - Verify pages array has exactly 6 elements
    - Verify each page is a non-empty string
    - _Requirements: 2.6, 2.8_

  - [-] 2.3 Verify fallback chunking if JSON parsing fails
    - Simulate malformed JSON response from Bedrock
    - Verify backend splits response into 6 approximate chunks
    - Verify fallback doesn't crash the application
    - Verify frontend still receives valid pages array
    - _Requirements: 2.7_

- [ ] 3. Verify Requirement 3 - Loading State During Story Generation
  - [-] 3.1 Verify Loading Screen displays during generation
    - Submit story generation request
    - Verify app transitions to Loading Screen immediately
    - Verify "Turning up the lamp…" message is displayed
    - Verify no other UI is shown during loading
    - _Requirements: 3.1, 3.2_

  - [-] 3.2 Verify transition to Story Screen on success
    - Complete story generation (wait for Bedrock response)
    - Verify app transitions to Story Screen
    - Verify first page is displayed
    - Verify loading message is gone
    - _Requirements: 3.2_

  - [x] 3.3 Verify transition back to Setup on error
    - Simulate backend error (stop server or mock 500 response)
    - Submit story generation request
    - Verify app transitions back to Setup Screen
    - Verify error message is displayed
    - _Requirements: 3.4, 8.1, 8.2_

- [x] 4. Verify Requirement 4 - Story Display with Page Navigation
  - [x] 4.1 Verify Story Screen displays first page on load
    - Generate a story successfully
    - Verify first page is displayed
    - Verify page text is in large, readable font
    - Verify page number shows "Page 1 of 6"
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 4.2 Verify next page navigation with arrow keys
    - Press Right arrow key on page 1
    - Verify page advances to page 2
    - Verify page counter updates to "Page 2 of 6"
    - Repeat for all pages
    - _Requirements: 4.4_

  - [x] 4.3 Verify previous page navigation with arrow keys
    - Navigate to page 3
    - Press Left arrow key
    - Verify page goes back to page 2
    - Repeat navigation backward through all pages
    - _Requirements: 4.5_

  - [x] 4.4 Verify Enter key advances page on Story Screen
    - Press Enter on any page (not last)
    - Verify page advances to next page
    - _Requirements: 4.4_

  - [x] 4.5 Verify page-turn animation plays on navigation
    - Navigate between pages
    - Visually confirm fade-in and upward slide animation
    - Verify animation duration is smooth (~400ms)
    - _Requirements: 4.6_

  - [x] 4.6 Verify button disabled states at boundaries
    - Navigate to page 1
    - Verify Previous button is disabled (opacity reduced)
    - Navigate to page 6
    - Verify Next button is disabled (opacity reduced)
    - _Requirements: 4.7, 4.8_

  - [x] 4.7 Verify Backspace/Escape returns to Setup Screen
    - On any story page, press Backspace
    - Verify app returns to Setup Screen
    - Verify Setup Screen is blank and ready for new input
    - Repeat with Escape key
    - _Requirements: 4.9_

- [x] 5. Verify Requirement 5 - Audio Narration
  - [x] 5.1 Verify audio narration starts on page display
    - Generate story and navigate to Story Screen
    - Verify audio request is sent to /narrate endpoint
    - Verify audio plays automatically
    - Verify audio source is mp3 format
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 5.2 Verify audio switches on page navigation
    - Listen to page 1 narration
    - While audio is playing, press Right arrow
    - Verify page 1 audio stops
    - Verify page 2 audio starts playing
    - _Requirements: 5.5_

  - [x] 5.3 Verify auto-advance after narration ends
    - On page 1, wait for narration to complete
    - After 1200ms delay, verify page automatically advances to page 2
    - Verify new narration starts playing for page 2
    - _Requirements: 5.6_

  - [x] 5.4 Verify auto-advance doesn't trigger on last page
    - Navigate to page 6 (last page)
    - Wait for narration to complete
    - Verify page remains at page 6
    - Verify app doesn't attempt to go to page 7
    - _Requirements: 5.6_

- [x] 6. Verify Requirement 6 - Fire TV Remote Integration
  - [x] 6.1 Verify up arrow cycles themes backward
    - On Setup Screen, press Up arrow
    - Verify theme index decrements
    - Verify theme name updates
    - Verify visual indicator updates
    - _Requirements: 6.2_

  - [x] 6.2 Verify down arrow cycles themes forward
    - On Setup Screen, press Down arrow
    - Verify theme index increments
    - Verify theme name updates
    - Verify cycling wraps from last theme to first
    - _Requirements: 6.3_

  - [x] 6.3 Verify Enter generates story on Setup Screen
    - Input family names
    - Press Enter
    - Verify story generation begins
    - _Requirements: 6.4_

  - [x] 6.4 Verify right arrow navigates forward on Story Screen
    - On Story Screen, press Right arrow
    - Verify page advances
    - _Requirements: 6.5_

  - [x] 6.5 Verify left arrow navigates backward on Story Screen
    - On Story Screen, press Left arrow
    - Verify page goes backward
    - _Requirements: 6.6_

  - [x] 6.6 Verify back button returns to setup
    - On Story Screen, press Backspace or Escape
    - Verify app returns to Setup Screen
    - _Requirements: 6.7, 4.9_

- [x] 7. Verify Requirement 7 - Theme Selection
  - [x] 7.1 Verify all 4 themes are available
    - On Setup Screen, verify these themes are accessible:
      - "a cozy adventure"
      - "a magical treasure hunt"
      - "a trip to outer space"
      - "a friendly dragon's forest"
    - _Requirements: 7.1_

  - [x] 7.2 Verify theme is sent to backend in request
    - Select each theme one at a time
    - Generate story for each
    - Verify POST payload includes correct theme string
    - Verify generated stories reflect theme differences
    - _Requirements: 7.5, 7.6_

- [x] 8. Verify Requirement 8 - Error Handling
  - [x] 8.1 Verify backend unreachable message
    - Stop the backend server
    - On Setup Screen, enter names and press Enter
    - Verify error message: "Couldn't reach the storyteller. Is the backend running?"
    - Verify user remains on Setup Screen
    - _Requirements: 8.1_

  - [x] 8.2 Verify app recovers from API errors
    - Generate story successfully
    - Simulate network error or 500 response
    - Verify error is handled gracefully
    - Verify user can retry story generation
    - _Requirements: 8.2, 8.4_

  - [x] 8.3 Verify narration failure doesn't stop story
    - Generate story successfully
    - Simulate /narrate endpoint failure (mock 500 response)
    - Navigate to page with failing narration
    - Verify error is logged to console
    - Verify story page still displays and is readable
    - Verify navigation still works
    - _Requirements: 8.3_

- [x] 9. Verify Requirement 9 - Visual Design
  - [x] 9.1 Verify color palette is applied
    - Inspect CSS for dusk, parchment, lamp, starlight colors
    - Verify background uses dusk color
    - Verify text uses parchment color
    - Verify buttons/accents use lamp color
    - _Requirements: 9.1_

  - [x] 9.2 Verify text sizes are appropriate for TV
    - Measure font sizes with browser dev tools
    - Verify body text is at least 3xl (30px+)
    - Verify headings are 6xl (60px+)
    - Visually confirm readability from TV viewing distance
    - _Requirements: 9.2_

  - [x] 9.3 Verify gradient and panel styling
    - Verify radial gradient is present behind content
    - Verify story text is in semi-transparent panel
    - Verify panel has rounded corners and shadow
    - Verify contrast is sufficient for readability
    - _Requirements: 9.3, 9.4, 9.5_

- [x] 10. Verify Requirement 10 - Configuration
  - [x] 10.1 Verify frontend API URL configuration
    - Check .env.example and actual .env files
    - Verify VITE_API_BASE defaults to http://localhost:4000
    - Test with custom VITE_API_BASE value
    - Verify frontend uses configured URL
    - _Requirements: 10.1_

  - [x] 10.2 Verify backend AWS configuration
    - Check backend .env.example
    - Verify AWS_REGION defaults to us-east-1
    - Verify BEDROCK_MODEL_ID has correct default
    - Verify AWS credentials are required
    - _Requirements: 10.2, 10.3, 10.4_

  - [x] 10.3 Verify health endpoint
    - Make GET request to /health
    - Verify response is { "status": "ok" }
    - Verify response code is 200
    - _Requirements: 10.5_

- [x] 11. Verify Requirement 11 - Multi-Page Story Persistence
  - [x] 11.1 Verify story pages persist in memory
    - Generate a story
    - Navigate to page 2
    - Navigate back to page 1
    - Verify page 1 displays the exact same text
    - Verify no additional API calls are made
    - _Requirements: 11.1, 11.2_

  - [x] 11.2 Verify narration replays for previously viewed pages
    - Generate story and navigate to page 2
    - Navigate back to page 1
    - Verify narration is fetched and plays for page 1 again
    - Verify narration is not cached (fresh /narrate request)
    - _Requirements: 11.3_

- [x] 12. Verify Requirement 12 - Keyboard Input Validation
  - [x] 12.1 Verify leading/trailing spaces are trimmed
    - Input: "  Maya  ,  Dad  ,  Biscuit  "
    - Verify backend receives trimmed names: ["Maya", "Dad", "Biscuit"]
    - _Requirements: 12.1_

  - [x] 12.2 Verify empty names are filtered out
    - Input: "Maya,,Dad,,Biscuit"
    - Verify backend receives only non-empty names
    - _Requirements: 12.2_

  - [x] 12.3 Verify single name is accepted
    - Input: "Maya"
    - Verify story generation succeeds with single family member
    - _Requirements: 12.3_

---

### Phase 2: Component Testing (React Frontend)

- [x] 13. SetupScreen Component Unit Tests
  - [x] 13.1 Write unit test: SetupScreen renders input field
    - Test that input element is rendered
    - Test that input has correct placeholder text
    - Test that input value is controlled by parent state
    - _Requirements: 1.1, 1.2_

  - [x] 13.2 Write unit test: SetupScreen renders theme selector
    - Test that 4 theme dots are displayed
    - Test that active theme dot has lamp color
    - Test that inactive dots have starlight color
    - Test that theme name is displayed
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 13.3 Write unit test: SetupScreen updates parent on input change
    - Simulate user typing in input field
    - Test that setNames callback is called with input value
    - Test that names value updates in parent
    - _Requirements: 1.2_

  - [x] 13.4 Write unit test: SetupScreen displays error message
    - Render with error prop set
    - Test that error message is visible
    - Test that error message is dismissed on new attempt
    - _Requirements: 8.1, 8.2_

  - [x] 13.5 Write unit test: SetupScreen button calls onSubmit
    - Render component with mock onSubmit
    - Click "Begin the story" button
    - Test that onSubmit is called exactly once
    - _Requirements: 1.4_

- [x] 14. StoryScreen Component Unit Tests
  - [x] 14.1 Write unit test: StoryScreen displays current page
    - Render with pages array and pageIndex = 0
    - Test that pages[0] text is displayed
    - Test font size is large (3xl+)
    - _Requirements: 4.1, 4.2_

  - [x] 14.2 Write unit test: StoryScreen displays page counter
    - Render with 6 pages and pageIndex = 1
    - Test that "Page 2 of 6" is displayed
    - Test that counter updates on pageIndex change
    - _Requirements: 4.3_

  - [x] 14.3 Write unit test: StoryScreen next button disabled on last page
    - Render with pageIndex = 5 (last page of 6)
    - Test that Next button is disabled (pointer-events: none or disabled attr)
    - Test that Next button opacity is reduced
    - _Requirements: 4.8_

  - [x] 14.4 Write unit test: StoryScreen previous button disabled on first page
    - Render with pageIndex = 0
    - Test that Previous button is disabled
    - Test that Previous button opacity is reduced
    - _Requirements: 4.7_

  - [x] 14.5 Write unit test: StoryScreen next button calls onTurn with next index
    - Render with pageIndex = 2
    - Click Next button
    - Test that onTurn is called with 3
    - _Requirements: 4.4_

  - [x] 14.6 Write unit test: StoryScreen previous button calls onTurn with prev index
    - Render with pageIndex = 3
    - Click Previous button
    - Test that onTurn is called with 2
    - _Requirements: 4.5_

  - [x] 14.7 Write unit test: Page-turn animation CSS class is applied
    - Render component
    - Test that page content has animation class (e.g., 'page-in')
    - Verify CSS animation is defined (400ms fade-in + slide)
    - _Requirements: 4.6_

- [x] 15. LoadingScreen Component Unit Tests
  - [x] 15.1 Write unit test: LoadingScreen displays message
    - Render LoadingScreen component
    - Test that "Turning up the lamp…" text is displayed
    - Test that text is in italic or special styling
    - _Requirements: 3.2_

  - [x] 15.2 Write unit test: LoadingScreen has no interactive elements
    - Render LoadingScreen
    - Test that no buttons or input fields are present
    - Test that no keyboard events are handled
    - _Requirements: 3.1_

- [x] 16. App Component State Management Tests
  - [x] 16.1 Write unit test: App initializes with correct state
    - Render App component
    - Test that screen = "setup"
    - Test that names = ""
    - Test that themeIndex = 0
    - Test that pages = []
    - Test that pageIndex = 0
    - Test that error = null
    - _Requirements: 1.1, 10.1_

  - [x] 16.2 Write unit test: App transitions to loading on story generation
    - Render App with Setup Screen
    - Enter family names
    - Mock fetch to delay response
    - Press Enter
    - Test that screen transitions to "loading"
    - _Requirements: 3.1_

  - [x] 16.3 Write unit test: App transitions to story on successful generation
    - Mock fetch to return 6 pages
    - Trigger story generation
    - Wait for promise to resolve
    - Test that screen transitions to "story"
    - Test that pages array is populated with 6 items
    - Test that pageIndex = 0
    - _Requirements: 3.2, 2.8_

  - [x] 16.4 Write unit test: App returns to setup with error on API failure
    - Mock fetch to reject or return 500
    - Trigger story generation
    - Test that screen transitions to "setup"
    - Test that error message is set
    - _Requirements: 3.4, 8.1, 8.2_

  - [x] 16.5 Write unit test: App clears error when retrying
    - Set app to error state
    - Verify error message is displayed
    - Trigger new story generation
    - Test that error is cleared (error = null)
    - _Requirements: 8.2_

- [x] 17. Keyboard Event Handling Tests
  - [x] 17.1 Write unit test: Up arrow cycles themes backward on Setup Screen
    - Render App on Setup Screen
    - Set themeIndex = 2
    - Simulate keydown event with key = "ArrowUp"
    - Test that themeIndex = 1
    - _Requirements: 6.2_

  - [x] 17.2 Write unit test: Up arrow wraps around from 0 to 3
    - Render App on Setup Screen
    - Set themeIndex = 0
    - Simulate ArrowUp event
    - Test that themeIndex = 3 (wraps to end)
    - _Requirements: 6.2_

  - [x] 17.3 Write unit test: Down arrow cycles themes forward on Setup Screen
    - Render App on Setup Screen
    - Set themeIndex = 1
    - Simulate keydown event with key = "ArrowDown"
    - Test that themeIndex = 2
    - _Requirements: 6.3_

  - [x] 17.4 Write unit test: Down arrow wraps from 3 to 0
    - Render App on Setup Screen
    - Set themeIndex = 3
    - Simulate ArrowDown event
    - Test that themeIndex = 0 (wraps to start)
    - _Requirements: 6.3_

  - [x] 17.5 Write unit test: Enter triggers story generation on Setup Screen
    - Render App on Setup Screen
    - Set names = "Maya, Dad"
    - Mock fetch
    - Simulate keydown with key = "Enter"
    - Test that fetch is called with /generate-story
    - _Requirements: 6.4_

  - [x] 17.6 Write unit test: Right arrow advances page on Story Screen
    - Navigate to Story Screen with pageIndex = 1
    - Simulate keydown with key = "ArrowRight"
    - Test that pageIndex = 2
    - _Requirements: 6.5_

  - [x] 17.7 Write unit test: Right arrow does not advance past last page
    - Navigate to Story Screen with pageIndex = 5 (last)
    - Simulate ArrowRight
    - Test that pageIndex remains 5
    - _Requirements: 6.5_

  - [x] 17.8 Write unit test: Left arrow goes to previous page on Story Screen
    - Navigate to Story Screen with pageIndex = 2
    - Simulate keydown with key = "ArrowLeft"
    - Test that pageIndex = 1
    - _Requirements: 6.6_

  - [x] 17.9 Write unit test: Left arrow does not go before first page
    - Navigate to Story Screen with pageIndex = 0
    - Simulate ArrowLeft
    - Test that pageIndex remains 0
    - _Requirements: 6.6_

  - [x] 17.10 Write unit test: Enter advances page on Story Screen (not last page)
    - Navigate to Story Screen with pageIndex = 2
    - Simulate keydown with key = "Enter"
    - Test that pageIndex = 3
    - _Requirements: 4.4_

  - [x] 17.11 Write unit test: Backspace returns to Setup Screen
    - Navigate to Story Screen
    - Simulate keydown with key = "Backspace"
    - Test that screen transitions to "setup"
    - _Requirements: 4.9, 6.7_

  - [x] 17.12 Write unit test: Escape returns to Setup Screen
    - Navigate to Story Screen
    - Simulate keydown with key = "Escape"
    - Test that screen transitions to "setup"
    - _Requirements: 4.9, 6.7_

  - [x] 17.13 Write unit test: Invalid keys don't trigger actions
    - Simulate keydown with key = "ArrowDown" on Story Screen
    - Test that no action is taken (Down arrow only works on Setup)
    - _Requirements: 6.8_

---

### Phase 3: API Endpoint Testing (Backend)

- [x] 18. POST /generate-story Endpoint Tests
  - [x] 18.1 Write integration test: Valid request returns 200 with 6 pages
    - Send POST to /generate-story with valid payload
    - Verify response status is 200
    - Verify response has pages array
    - Verify pages array has exactly 6 elements
    - Verify each page is a non-empty string
    - _Requirements: 2.1, 2.8_

  - [x] 18.2 Write integration test: Response includes all family member names
    - Send POST with familyMembers: ["Alice", "Bob", "Charlie"]
    - Verify response pages mention all three names
    - Verify names appear in story content
    - _Requirements: 2.2_

  - [x] 18.3 Write integration test: Response reflects selected theme
    - Send POST with theme: "a trip to outer space"
    - Verify response pages contain space/cosmic references
    - Send POST with theme: "a friendly dragon's forest"
    - Verify response pages contain forest/dragon references
    - _Requirements: 2.2, 7.5, 7.6_

  - [x] 18.4 Write integration test: Each page has 2-3 sentences
    - Send POST to /generate-story
    - For each page in response, count sentences (end with . ! ?)
    - Verify each page has 2-3 sentences
    - _Requirements: 2.4_

  - [x] 18.5 Write integration test: Response has no dashes or hyphens
    - Send POST to /generate-story
    - For each page, verify no em dashes (—), hyphens (-), or smart dashes
    - Verify pages use plain language only
    - _Requirements: 2.5_

  - [x] 18.6 Write integration test: Empty familyMembers returns 400
    - Send POST with familyMembers: []
    - Verify response status is 400
    - Verify error message is returned
    - _Requirements: 1.6, 2.1_

  - [x] 18.7 Write integration test: Missing familyMembers field returns 400
    - Send POST without familyMembers field
    - Verify response status is 400
    - _Requirements: 2.1_

  - [x] 18.8 Write integration test: Missing theme field uses default
    - Send POST with familyMembers but no theme
    - Verify response status is 200
    - Verify 6 pages are returned
    - _Requirements: 10.3_

  - [x] 18.9 Write integration test: Bedrock failure returns 500
    - Mock Bedrock client to throw error
    - Send POST to /generate-story
    - Verify response status is 500
    - Verify error is logged
    - _Requirements: 2.7_

  - [x] 18.10 Write integration test: Fallback chunking on JSON parse failure
    - Mock Bedrock to return non-JSON response
    - Send POST to /generate-story
    - Verify response status is 200
    - Verify pages array has 6 elements (chunked fallback)
    - Verify each chunk is non-empty
    - _Requirements: 2.7_

  - [x] 18.11 Write integration test: Request timeout handling
    - Mock Bedrock to delay response > timeout threshold
    - Send POST to /generate-story
    - Verify appropriate error is returned
    - Verify user can retry
    - _Requirements: 8.2_

- [x] 19. POST /narrate Endpoint Tests
  - [x] 19.1 Write integration test: Valid request returns audio/mpeg
    - Send POST to /narrate with text: "Once upon a time..."
    - Verify response status is 200
    - Verify content-type is audio/mpeg
    - Verify response body is binary audio data
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 19.2 Write integration test: Uses Joanna voice with neural engine
    - Send POST to /narrate
    - Verify Polly was invoked with VoiceId = "Joanna"
    - Verify Polly was invoked with Engine = "neural"
    - _Requirements: 5.2_

  - [x] 19.3 Write integration test: Output format is mp3
    - Send POST to /narrate
    - Verify Polly was invoked with OutputFormat = "mp3"
    - _Requirements: 5.3_

  - [x] 19.4 Write integration test: Missing text field returns 400
    - Send POST without text field
    - Verify response status is 400
    - _Requirements: 5.1_

  - [x] 19.5 Write integration test: Empty text field returns 400
    - Send POST with text: ""
    - Verify response status is 400
    - _Requirements: 5.1_

  - [x] 19.6 Write integration test: Polly failure returns 500
    - Mock Polly client to throw error
    - Send POST to /narrate
    - Verify response status is 500
    - Verify error is logged
    - _Requirements: 8.3_

  - [x] 19.7 Write integration test: Long text is handled
    - Send POST with long text (500+ characters)
    - Verify Polly successfully synthesizes
    - Verify response is returned
    - _Requirements: 5.1_

  - [x] 19.8 Write integration test: Special characters are handled
    - Send POST with text containing quotes, ellipsis, etc.
    - Verify Polly synthesizes without error
    - Verify audio is returned
    - _Requirements: 5.1_

- [x] 20. GET /health Endpoint Tests
  - [x] 20.1 Write unit test: /health returns 200 with status ok
    - Send GET to /health
    - Verify response status is 200
    - Verify response body is { "status": "ok" }
    - _Requirements: 10.5_

  - [x] 20.2 Write unit test: /health has correct content-type
    - Send GET to /health
    - Verify content-type is application/json
    - _Requirements: 10.5_

---

### Phase 4: Audio & Playback Testing

- [x] 21. Audio Playback Integration Tests
  - [x] 21.1 Write integration test: Audio element is created and referenced
    - Render Story Screen
    - Verify audio element exists in DOM
    - Verify React ref correctly points to audio element
    - _Requirements: 5.1_

  - [x] 21.2 Write integration test: Audio src is set on page change
    - Navigate to Story Screen, page 1
    - Verify fetch to /narrate is made
    - Verify audio.src is set to blob URL
    - _Requirements: 5.1_

  - [x] 21.3 Write integration test: Audio plays automatically
    - Mock Audio.play()
    - Navigate to new page
    - Wait for fetch to resolve
    - Verify audio.play() is called
    - _Requirements: 5.1_

  - [x] 21.4 Write integration test: Audio pauses on page change mid-playback
    - Page 1 audio is playing
    - Press Right arrow to go to page 2
    - Verify page 1 audio.pause() is called
    - Verify page 2 audio.src is updated
    - _Requirements: 5.5_

  - [x] 21.5 Write integration test: Auto-advance triggers after narration ends
    - Mock audio ended event
    - On page 1, simulate audio ended after playback complete
    - Wait 1200ms
    - Verify pageIndex advances to 2
    - _Requirements: 5.6_

  - [x] 21.6 Write integration test: Auto-advance doesn't trigger on page 6
    - Navigate to page 6 (last page)
    - Mock audio ended event
    - Simulate audio ended
    - Verify pageIndex remains 6
    - Verify no attempt to load page 7
    - _Requirements: 5.6_

  - [x] 21.7 Write integration test: Audio cleanup on component unmount
    - Render Story Screen
    - Unmount component
    - Verify audio listener is removed
    - Verify timeout is cleared
    - Verify no memory leaks
    - _Requirements: 5.1_

  - [x] 21.8 Write integration test: Narration requests are made for each page
    - Generate story and navigate through all 6 pages
    - Count /narrate requests made
    - Verify exactly 6 requests are made (one per page)
    - Verify each request includes the correct page text
    - _Requirements: 5.1_

  - [x] 21.9 Write integration test: Clicking next button cancels pending narration fetch
    - On page 1, click next button quickly before narration arrives
    - Verify pending fetch for page 1 is cancelled
    - Verify page 2 narration fetch is initiated
    - _Requirements: 5.5_

- [x] 22. Audio Error Handling Tests
  - [x] 22.1 Write integration test: Narration failure doesn't break story
    - Mock /narrate to return 500 error
    - Navigate to page with failing narration
    - Verify error is logged to console
    - Verify page text is still visible
    - Verify page navigation still works
    - _Requirements: 8.3_

  - [x] 22.2 Write integration test: Audio play() promise rejection is handled
    - Mock audio.play() to reject (e.g., autoplay policy)
    - Navigate to Story Screen
    - Verify error is caught
    - Verify story continues to display
    - _Requirements: 8.3_

  - [x] 22.3 Write integration test: Network error during narration
    - Simulate network timeout on /narrate request
    - Navigate to Story Screen
    - Verify error is logged
    - Verify story display is not affected
    - _Requirements: 8.3_

---

### Phase 5: Error Scenario Testing

- [x] 23. Backend Unreachable Tests
  - [x] 23.1 Write integration test: Cannot reach backend on story generation
    - Stop backend server (or mock connection refused)
    - On Setup Screen, enter names and press Enter
    - Verify error message: "Couldn't reach the storyteller. Is the backend running?"
    - Verify screen remains on Setup Screen
    - _Requirements: 8.1, 3.4_

  - [x] 23.2 Write integration test: User can retry after backend error
    - Simulate backend unreachable error
    - Verify error message is displayed
    - Restart backend (or unmock connection)
    - Enter names again and press Enter
    - Verify story generation succeeds
    - _Requirements: 8.2_

  - [x] 23.3 Write integration test: Different error messages for different failures
    - Test 500 error response
    - Test network timeout
    - Test JSON parse error
    - Verify appropriate error handling for each
    - _Requirements: 8.2_

- [x] 24. Input Validation Error Tests
  - [x] 24.1 Write unit test: Empty input prevents story generation
    - Leave names field empty
    - Press Enter
    - Verify API call is not made
    - Verify app remains on Setup Screen
    - _Requirements: 1.6_

  - [x] 24.2 Write unit test: Only commas input is invalid
    - Input: ",,,"
    - Press Enter
    - Verify API call is not made or returns 400
    - _Requirements: 1.6, 12.2_

  - [x] 24.3 Write unit test: Whitespace-only input is invalid
    - Input: "   ,   ,   "
    - Press Enter
    - After trimming, no names remain
    - Verify story generation is prevented
    - _Requirements: 12.1, 1.6_

  - [x] 24.4 Write integration test: Backend validation for empty familyMembers
    - Send POST with empty familyMembers array
    - Verify 400 response
    - Verify error message includes helpful text
    - _Requirements: 1.6, 2.1_

- [x] 25. State Recovery Tests
  - [x] 25.1 Write integration test: App recovers from failed generation attempt
    - Trigger story generation with valid input
    - Mock Bedrock to fail (return error)
    - Verify error message on Setup Screen
    - Modify input (different names)
    - Press Enter again
    - Verify story generation succeeds with new input
    - _Requirements: 8.2, 8.4_

  - [x] 25.2 Write integration test: Page state resets on new story generation
    - Generate story 1 and navigate to page 3
    - Return to Setup Screen
    - Generate story 2
    - Verify app starts at page 1 of new story
    - Verify old pages are cleared
    - _Requirements: 11.1, 1.1_

  - [x] 25.3 Write integration test: Multiple rapid story generations
    - Generate story 1 (don't wait for completion)
    - Click Enter to generate story 2 (during loading)
    - Verify app handles gracefully
    - Verify only story 2 pages are displayed
    - _Requirements: 8.4_

---

### Phase 6: Fire TV Integration Testing

- [x] 26. Fire TV Remote Button Mapping Tests
  - [x] 26.1 Write manual test: Up arrow behavior
    - On Setup Screen, press Up arrow multiple times
    - Verify theme cycles backward correctly
    - Verify wrapping from first to last works
    - _Requirements: 6.2_

  - [x] 26.2 Write manual test: Down arrow behavior
    - On Setup Screen, press Down arrow multiple times
    - Verify theme cycles forward correctly
    - Verify wrapping from last to first works
    - _Requirements: 6.3_

  - [x] 26.3 Write manual test: Right arrow on Story Screen
    - On Story Screen, press Right arrow
    - Verify page advances
    - Verify reaches last page and stops
    - _Requirements: 6.5_

  - [x] 26.4 Write manual test: Left arrow on Story Screen
    - On Story Screen, press Left arrow
    - Verify page goes backward
    - Verify reaches first page and stops
    - _Requirements: 6.6_

  - [x] 26.5 Write manual test: Enter on Setup Screen
    - On Setup Screen with filled input, press Enter
    - Verify story generation starts
    - _Requirements: 6.4_

  - [x] 26.6 Write manual test: Back button on Story Screen
    - On Story Screen, press Backspace or Escape (Back button equivalent)
    - Verify returns to Setup Screen
    - _Requirements: 6.7, 4.9_

  - [x] 26.7 Write manual test: Enter on Story Screen advances page
    - On Story Screen (not last page), press Enter
    - Verify page advances
    - _Requirements: 4.4, 6.5_

- [x] 27. Fire TV Edge Cases
  - [x] 27.1 Write manual test: Rapid key presses on Setup Screen
    - Rapidly press Up/Down arrows
    - Verify theme selection is responsive
    - Verify no skipped themes
    - _Requirements: 6.2, 6.3_

  - [x] 27.2 Write manual test: Rapid key presses on Story Screen
    - Rapidly press Right/Left arrows
    - Verify page navigation is responsive
    - Verify no skipped pages
    - Verify audio plays for final page
    - _Requirements: 6.5, 6.6_

  - [x] 27.3 Write manual test: Key press before page loads
    - Navigate to Story Screen
    - Immediately press Right arrow before page content loads
    - Verify app handles gracefully
    - Verify page advances when ready
    - _Requirements: 8.4_

  - [x] 27.4 Write manual test: Long family names on Fire TV
    - Input very long names (20+ characters each)
    - Verify text wraps and displays correctly on TV screen
    - Verify layout doesn't break
    - _Requirements: 4.1, 9.2_

  - [x] 27.5 Write manual test: Many family members input
    - Input 5-6 family member names
    - Verify story generation succeeds
    - Verify all names appear in story
    - Verify page layout accommodates input
    - _Requirements: 1.2, 1.4, 2.2_

- [x] 28. Fire TV Display Testing
  - [x] 28.1 Write manual test: Text readability from TV distance
    - Display app on actual Fire TV or simulate large display
    - View from 8-10 feet away
    - Verify all text is readable
    - Verify buttons are identifiable
    - _Requirements: 9.2_

  - [x] 28.2 Write manual test: Color contrast on Fire TV
    - Display on Fire TV
    - Verify text color (parchment) contrasts well with background (dusk)
    - Verify buttons (lamp color) are distinct
    - Verify no color accessibility issues
    - _Requirements: 9.5_

  - [x] 28.3 Write manual test: Animation smoothness on Fire TV
    - Navigate between pages on Fire TV
    - Verify page-turn animation is smooth
    - Verify no stuttering or lag
    - _Requirements: 4.6_

  - [x] 28.4 Write manual test: Audio playback on Fire TV speakers
    - Generate story on Fire TV
    - Verify narration plays through TV speakers
    - Verify volume is appropriate
    - Verify audio quality is natural (neural voice)
    - _Requirements: 5.1, 5.2_

  - [x] 28.5 Write manual test: Layout on different Fire TV resolutions
    - Test on Fire TV (1080p)
    - Test on Fire TV 4K
    - Test on simulated different aspect ratios
    - Verify layout remains centered and readable
    - _Requirements: 4.1, 9.2, 9.3_

---

### Phase 7: Documentation & Deployment

- [x] 29. Documentation Tasks
  - [x] 29.1 Verify README contains setup instructions
    - Check README.md in repo root
    - Verify Frontend setup instructions are present
    - Verify Backend setup instructions are present
    - Verify AWS credentials setup is documented
    - Verify environment variables are documented
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [x] 29.2 Verify .env.example files are complete
    - Check client/.env.example
    - Verify VITE_API_BASE is listed
    - Check server/.env.example
    - Verify AWS_REGION, BEDROCK_MODEL_ID, AWS credentials are listed
    - Verify PORT is listed
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [x] 29.3 Verify API documentation is accurate
    - Check API endpoint documentation in design or README
    - Verify /generate-story request/response format is correct
    - Verify /narrate request/response format is correct
    - Verify /health request/response format is correct
    - Verify error status codes are documented
    - _Requirements: 2.1, 5.1, 10.5_

  - [x] 29.4 Document testing setup and execution
    - Create or update test documentation
    - Document how to run frontend tests
    - Document how to run backend tests
    - Document how to run E2E tests
    - Document test coverage expectations
    - _Requirements: All phases_

  - [x] 29.5 Create deployment guide
    - Document backend container/deployment steps
    - Document frontend build and deployment steps
    - Document how to set environment variables in production
    - Document how to configure Bedrock and Polly access
    - Document health check procedures
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 30. Pre-Deployment Validation
  - [x] 30.1 Verify all unit tests pass
    - Run all frontend component tests
    - Run all keyboard handling tests
    - Verify 100% pass rate
    - _Requirements: 13-17_

  - [x] 30.2 Verify all API integration tests pass
    - Run all /generate-story endpoint tests
    - Run all /narrate endpoint tests
    - Run all /health endpoint tests
    - Verify 100% pass rate
    - _Requirements: 18-20_

  - [x] 30.3 Verify all error scenario tests pass
    - Run error handling tests
    - Run input validation tests
    - Run state recovery tests
    - Verify 100% pass rate
    - _Requirements: 23-25_

  - [x] 30.4 Verify no console errors on standard flows
    - Generate story
    - Navigate through all pages
    - Verify no errors in browser console
    - Verify no errors in server logs
    - _Requirements: 1-12_

  - [x] 30.5 Verify performance baselines
    - Story generation time < 30 seconds
    - Audio narration starts < 2 seconds after page displayed
    - Page navigation response < 500ms
    - No memory leaks on extended use (30+ page transitions)
    - _Requirements: 4.4, 5.1_

- [x] 31. Final Acceptance Tests
  - [x] 31.1 Perform end-to-end story generation flow
    - Launch app
    - Enter family names: "Alice, Bob, Charlie"
    - Select theme: "a cozy adventure"
    - Press Enter
    - Wait for story to load
    - Verify all 6 pages display correctly with narration
    - Navigate backward and forward through pages
    - Verify auto-advance after last page narration completes
    - Return to Setup Screen with Backspace
    - _Requirements: 1, 2, 3, 4, 5, 6, 7, 11_

  - [x] 31.2 Perform complete error recovery flow
    - Stop backend server
    - Try to generate story
    - Verify error message is clear
    - Restart backend
    - Generate story successfully
    - Simulate narration API failure
    - Verify story continues without audio
    - _Requirements: 8, 23, 24_

  - [x] 31.3 Verify all requirements checklist
    - Go through all 12 requirements
    - Confirm each acceptance criterion is met
    - Document any deviations or workarounds
    - Sign off on requirement verification
    - _Requirements: 1-12_

- [x] 32. Deployment Readiness
  - [x] 32.1 Backend ready for production deployment
    - All tests passing
    - Environment variables properly documented
    - Error logging in place
    - Health endpoint functional
    - AWS credentials verified
    - _Requirements: 10.2, 10.3, 10.4, 10.5_

  - [x] 32.2 Frontend ready for production deployment
    - All tests passing
    - Build succeeds without errors
    - VITE_API_BASE configured for production backend
    - No console errors on production build
    - Performance acceptable
    - _Requirements: 10.1_

  - [x] 32.3 Deployment documentation complete
    - README updated with all setup instructions
    - .env.example files complete
    - Deployment guide created
    - Test execution documented
    - Troubleshooting guide included
    - _Requirements: 29_

  - [x] 32.4 Fire TV deployment verified
    - App runs on Fire TV hardware or emulator
    - Remote controls work as expected
    - Audio plays through TV speakers
    - All text is readable on TV screen
    - Performance is acceptable
    - _Requirements: 6, 27, 28_

---

## Notes

### Testing Approach: Why No Property-Based Tests?

Based on the design document analysis, this application is **not suitable for property-based testing (PBT)** for the following reasons:

1. **UI Rendering**: React components with visual output cannot be meaningfully property-tested. Screen state transitions are deterministic and best tested with example-based unit tests that verify specific state changes.

2. **External AWS API Dependencies**: Story generation via Bedrock and audio synthesis via Polly are external, non-deterministic services. PBT cannot generate meaningful properties for services we don't control. Integration tests with mocked AWS responses are appropriate.

3. **Browser APIs and Side Effects**: Audio playback, keyboard event handlers, and DOM manipulation involve browser APIs and imperative code that don't benefit from property-based testing. Example-based tests with mocked browser APIs are more effective.

4. **Stateful User Interactions**: The app maintains complex state (current screen, page index, audio playback) that changes based on user input and asynchronous events. PBT is not well-suited for testing state machines with side effects.

**Example-Based Testing Strategy**:
- **Unit Tests**: Test individual components and functions with specific inputs and expected outputs (e.g., "given pageIndex=5 and 6 pages, Next button should be disabled")
- **Integration Tests**: Test API endpoints with concrete payloads (e.g., "request with 2 family members should return 6 pages")
- **Manual/E2E Tests**: Test user workflows (e.g., "user enters names, presses Enter, sees story, navigates pages")

### Task Completion Criteria

Each task is complete when:
- Code is implemented (or verified as implemented)
- All acceptance criteria are met
- Relevant test cases pass
- No regressions in related features
- For manual tests: documented observations or screenshots

### Optional Testing Tasks

Several testing sub-tasks are marked as optional (with `*`) because they represent additional test coverage beyond the core validation requirements. These can be deferred for an MVP but should be included for production readiness.

### Checkpoint Tasks

Three checkpoint tasks ensure validation progress:
- **After Phase 2**: Confirm all component unit tests pass
- **After Phase 4**: Confirm all API and audio tests pass
- **After Phase 6**: Confirm all error scenarios and Fire TV tests pass

These checkpoints allow for course correction before moving to deployment.



## Task Dependency Graph

```json
{
  "waves": [
    {
      "id": 0,
      "tasks": ["1.1", "1.2", "1.3", "1.4", "1.5"],
      "description": "Phase 1: Basic requirements verification - Setup Screen functionality"
    },
    {
      "id": 1,
      "tasks": ["2.1", "2.2", "2.3", "3.1", "3.2", "3.3"],
      "description": "Phase 1 continued: Story generation and loading state verification"
    },
    {
      "id": 2,
      "tasks": ["4.1", "4.2", "4.3", "4.4", "4.5", "4.6", "4.7"],
      "description": "Phase 1 continued: Story display and navigation verification"
    },
    {
      "id": 3,
      "tasks": ["5.1", "5.2", "5.3", "5.4", "6.1", "6.2", "6.3"],
      "description": "Phase 1 continued: Audio narration and Fire TV remote verification"
    },
    {
      "id": 4,
      "tasks": ["6.4", "6.5", "6.6", "7.1", "7.2", "8.1", "8.2", "8.3"],
      "description": "Phase 1 continued: Theme selection, error handling verification"
    },
    {
      "id": 5,
      "tasks": ["9.1", "9.2", "9.3", "10.1", "10.2", "10.3", "11.1", "11.2", "12.1", "12.2", "12.3"],
      "description": "Phase 1 final: Visual design, configuration, input validation verification"
    },
    {
      "id": 6,
      "tasks": ["13.1", "13.2", "13.3", "13.4", "13.5"],
      "description": "Phase 2: SetupScreen component unit tests"
    },
    {
      "id": 7,
      "tasks": ["14.1", "14.2", "14.3", "14.4", "14.5", "14.6", "14.7"],
      "description": "Phase 2: StoryScreen component unit tests"
    },
    {
      "id": 8,
      "tasks": ["15.1", "15.2", "16.1", "16.2", "16.3"],
      "description": "Phase 2: LoadingScreen and App state management unit tests"
    },
    {
      "id": 9,
      "tasks": ["16.4", "16.5", "17.1", "17.2", "17.3", "17.4", "17.5"],
      "description": "Phase 2: App error handling and keyboard event unit tests (part 1)"
    },
    {
      "id": 10,
      "tasks": ["17.6", "17.7", "17.8", "17.9", "17.10", "17.11", "17.12", "17.13"],
      "description": "Phase 2: Keyboard event unit tests (part 2) - Complete keyboard handling"
    },
    {
      "id": 11,
      "tasks": ["18.1", "18.2", "18.3", "18.4", "18.5"],
      "description": "Phase 3: POST /generate-story endpoint tests (part 1) - Happy path"
    },
    {
      "id": 12,
      "tasks": ["18.6", "18.7", "18.8", "18.9", "18.10", "18.11"],
      "description": "Phase 3: POST /generate-story endpoint tests (part 2) - Error cases"
    },
    {
      "id": 13,
      "tasks": ["19.1", "19.2", "19.3", "19.4", "19.5"],
      "description": "Phase 3: POST /narrate endpoint tests (part 1) - Happy path"
    },
    {
      "id": 14,
      "tasks": ["19.6", "19.7", "19.8", "20.1", "20.2"],
      "description": "Phase 3: POST /narrate and GET /health endpoint tests"
    },
    {
      "id": 15,
      "tasks": ["21.1", "21.2", "21.3", "21.4", "21.5"],
      "description": "Phase 4: Audio playback integration tests (part 1) - Core playback"
    },
    {
      "id": 16,
      "tasks": ["21.6", "21.7", "21.8", "21.9"],
      "description": "Phase 4: Audio playback integration tests (part 2) - Edge cases and cleanup"
    },
    {
      "id": 17,
      "tasks": ["22.1", "22.2", "22.3"],
      "description": "Phase 4: Audio error handling tests"
    },
    {
      "id": 18,
      "tasks": ["23.1", "23.2", "23.3"],
      "description": "Phase 5: Backend unreachable error scenario tests"
    },
    {
      "id": 19,
      "tasks": ["24.1", "24.2", "24.3", "24.4"],
      "description": "Phase 5: Input validation error scenario tests"
    },
    {
      "id": 20,
      "tasks": ["25.1", "25.2", "25.3"],
      "description": "Phase 5: State recovery error scenario tests"
    },
    {
      "id": 21,
      "tasks": ["26.1", "26.2", "26.3", "26.4", "26.5", "26.6", "26.7"],
      "description": "Phase 6: Fire TV remote button mapping tests"
    },
    {
      "id": 22,
      "tasks": ["27.1", "27.2", "27.3", "27.4", "27.5"],
      "description": "Phase 6: Fire TV edge case tests"
    },
    {
      "id": 23,
      "tasks": ["28.1", "28.2", "28.3", "28.4", "28.5"],
      "description": "Phase 6: Fire TV display and audio testing"
    },
    {
      "id": 24,
      "tasks": ["29.1", "29.2", "29.3", "29.4", "29.5"],
      "description": "Phase 7: Documentation tasks - Setup guides and API docs"
    },
    {
      "id": 25,
      "tasks": ["30.1", "30.2", "30.3", "30.4", "30.5"],
      "description": "Phase 7: Pre-deployment validation - All tests and baselines"
    },
    {
      "id": 26,
      "tasks": ["31.1", "31.2", "31.3"],
      "description": "Phase 7: Final acceptance testing - End-to-end workflows"
    },
    {
      "id": 27,
      "tasks": ["32.1", "32.2", "32.3", "32.4"],
      "description": "Phase 7: Deployment readiness final sign-off"
    }
  ]
}
```

### Execution Wave Strategy

The dependency graph organizes tasks into 28 execution waves:

- **Waves 0-5**: Requirements verification (Phase 1) - Validate that implementation meets all documented requirements
- **Waves 6-10**: Component unit tests (Phase 2) - Test React components and keyboard handling in isolation
- **Waves 11-14**: API endpoint tests (Phase 3) - Test backend endpoints with mocked AWS services
- **Waves 15-17**: Audio playback tests (Phase 4) - Test audio integration and error handling
- **Waves 18-20**: Error scenario tests (Phase 5) - Test failure modes and recovery
- **Waves 21-23**: Fire TV integration tests (Phase 6) - Test remote compatibility and display
- **Waves 24-27**: Documentation and deployment (Phase 7) - Verify completeness and readiness

**Parallelization**: Within each wave, all tasks are independent and can run in parallel. Tasks in wave N may only execute after all tasks in waves 0..N-1 are complete.

**Wave Dependencies**:
- Requirements verification (Waves 0-5) should complete first to identify any missing features
- Component and API tests (Waves 6-14) can run in parallel once requirements are verified
- Error and integration tests (Waves 15-23) validate robustness after core functionality is validated
- Documentation and deployment (Waves 24-27) finalize the delivery package

