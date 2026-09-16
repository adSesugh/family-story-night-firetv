# Audio Auto-Start Bugfix Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Initial Story Load Audio Failure
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists on initial story load
  - **Scoped PBT Approach**: Scope the property to the concrete failing case: screen="story" AND pageIndex===0 on initial render
  - Test that when story generation completes and screen transitions to "story" with pageIndex===0, the narration fetch executes and audio.play() is called on the audio element
  - The test assertions should match the Expected Behavior Properties from design (Property 1)
  - Simulate the story generation flow: generate story → screen becomes "story" → pageIndex is 0 → pages array has content
  - Verify that narration fetch is triggered and audio playback starts
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists on page 0)
  - Document counterexamples found: "Audio fetch succeeds but audio.play() is not called on initial load" or "Audio playback fails silently despite successful fetch"
  - Mark task complete when test is written, run on unfixed code, and failure is documented
  - _Requirements: 1.1, 1.2_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Page Navigation Audio Playback (Page 2+)
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: Generate story, navigate to page 2 (pageIndex===1), verify narration fetches and plays on unfixed code
  - Observe: From page 2, navigate to page 3, verify narration still plays on unfixed code
  - Observe: Navigate backwards from page 3 to page 2, verify narration still plays on unfixed code
  - Write property-based test: For any pageIndex >= 1 on screen="story", narration fetch executes and audio plays exactly as it does on unfixed code
  - Test keyboard navigation, button clicks, and mixed navigation patterns
  - Property should generalize: "For all page navigation after initial load (pageIndex >= 1), audio narration plays consistently"
  - Verify test passes on UNFIXED code (confirms baseline behavior to preserve)
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Fix audio auto-start on initial story load

  - [x] 3.1 Implement the screen-change narration effect
    - Add new useEffect hook in App.jsx after the existing narration effect (around line 77)
    - Dependency array: `[screen]` only - triggers when screen changes
    - Effect body:
      - Check if `screen === "story"` and `pageIndex === 0` and `pages.length > 0`
      - Fetch narration for page 0: POST to `/narrate` with `pages[0]` content
      - On successful fetch, create blob and object URL
      - Set audio element: pause, set src, load(), play()
      - Include error handling: `.catch(() => {})` to silently catch play errors
      - Include cancellation flag to prevent state updates on cleanup
    - This effect runs once when transitioning to story screen, handling the initial load case
    - The existing pageIndex-based effect continues to handle page 2+ navigation
    - _Bug_Condition: screen==="story" AND pageIndex===0 from design_
    - _Expected_Behavior: narrationFetches AND audioPlays from design Property 1_
    - _Preservation: Preservation Requirements from design - page 2+ navigation must be unchanged_
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Initial Story Load Audio Success
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the fix works for initial story load
    - Run bug condition exploration test from step 1 on the FIXED code
    - Verify narration fetches and plays on initial story load (pageIndex===0)
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - Document success: "Audio now plays on initial story load"
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Page Navigation Audio Playback Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2 on the FIXED code
    - Verify page 2+ navigation still plays narration exactly as before (no regressions)
    - Verify all preservation behaviors: page navigation, auto-advance, keyboard handlers
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Document success: "All page navigation behaviors preserved - no regressions"
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 4. Checkpoint - Ensure all tests pass
  - Run all three test categories:
    - Bug Condition test from task 1 (must pass after fix)
    - Preservation tests from task 2 (must pass after fix)
    - Any existing tests (must continue to pass)
  - Verify no regressions were introduced
  - Verify initial story load now has audio
  - Verify page 2+ navigation behavior is unchanged
  - Ensure all tests pass, ask the user if questions arise.
