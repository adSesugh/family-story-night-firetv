# Future Enhancements - Feature Requirements

## Overview

This document outlines planned features to extend Family Story Night beyond the MVP. These enhancements will deepen user engagement, provide personalization, support diverse families, and enable content persistence.

## Feature 1: Story History

### Requirements

1.1 WHEN a user generates a story THEN the system SHALL save it with metadata (date, family members, theme)

1.2 WHEN a user navigates back to the setup screen THEN the system SHALL display a "View History" button

1.3 WHEN a user clicks "View History" THEN the system SHALL display a list of previously generated stories with:
  - Generation date and time
  - Family members featured in the story
  - Theme used
  - Story preview (first 50 characters)

1.4 WHEN a user selects a story from history THEN the system SHALL display the complete story without re-generating

1.5 WHEN a user generates a new story THEN the system SHALL add it to the history (maximum 50 stories stored locally)

1.6 WHEN the local history reaches 50 stories THEN the system SHALL remove the oldest story to make room for the newest

1.7 WHEN a user has no history THEN the system SHALL hide or disable the "View History" button

### Storage

- Use browser localStorage for client-side persistence
- Store story content, metadata, and generation timestamp
- Graceful degradation if localStorage is unavailable

## Feature 2: Custom Themes

### Requirements

2.1 WHEN a user is on the setup screen THEN they SHALL have an option to "Create Custom Theme"

2.2 WHEN a user selects "Create Custom Theme" THEN the system SHALL display a text input field

2.3 WHEN a user enters a custom theme description (e.g., "a spooky haunted house adventure") THEN the system SHALL use that description instead of preset themes

2.4 WHEN a user enters a custom theme THEN the system SHALL pass it to the story generation endpoint

2.5 WHEN a custom theme is provided THEN the backend SHALL generate a story based on the custom description instead of preset options

2.6 WHEN a custom theme is successfully used THEN the system MAY save it to a "favorites" list for quick access

### Constraints

- Custom theme text limited to 100 characters
- Backend must support dynamic theme input (not just hardcoded themes)
- Custom themes still maintain story quality and appropriateness for children

## Feature 3: Multiple Voices

### Requirements

3.1 WHEN a user is on the setup screen THEN they SHALL see voice selection options (default: "Default Voice")

3.2 WHEN a user selects a voice THEN the system SHALL store the selection

3.3 WHEN a story is generated THEN the system SHALL use the selected voice for narration via Polly

3.4 WHEN narration is fetched THEN the system SHALL pass the voice ID to the `/narrate` endpoint

3.5 WHEN the `/narrate` endpoint receives a voice ID THEN the backend SHALL use that specific Polly voice

### Voice Options

- English voices: Joanna (female, warm), Matthew (male, calm), Emma (female, youthful), etc.
- Future: Support for Spanish, French, and other languages with appropriate voices
- Default: Joanna (warm, friendly for bedtime stories)

### Backend Changes

- Accept `voiceId` parameter in `/narrate` POST body
- Pass voice to Polly `synthesize_speech()` call
- Fallback to default voice if unsupported voice is requested

## Feature 4: Story Length Options

### Requirements

4.1 WHEN a user is on the setup screen THEN they SHALL see story length options: 4 pages, 6 pages, 8 pages

4.2 WHEN a user selects a story length THEN the system SHALL store the selection

4.3 WHEN a story is generated THEN the system SHALL pass the length preference to the story generation endpoint

4.4 WHEN the backend receives a length preference THEN it SHALL generate a story with approximately that many pages

4.5 WHEN a user does not select a length THEN the system SHALL default to 6 pages

### Constraints

- Minimum 4 pages, maximum 8 pages
- Backend must adjust content generation to match requested length
- Stories should maintain quality regardless of length

## Feature 5: Illustrations

### Requirements

5.1 WHEN a story is generated THEN the system MAY fetch or generate an illustration for each page

5.2 WHEN illustrations are available THEN the system SHALL display them on the story card above the text

5.3 WHEN a user navigates between pages THEN illustrations SHALL update alongside the text

5.4 WHEN an illustration fails to load THEN the system SHALL display the story text without illustration (graceful degradation)

### Implementation Options

- **Option A**: Use DALL-E or similar API to generate illustrations (requires API key)
- **Option B**: Fetch illustrations from free stock image APIs based on story themes
- **Option C**: Use simple SVG illustrations based on story content

### Backend Changes

- Add illustration generation/fetching to story generation flow
- Store illustration URLs or data with story content
- Return illustrations alongside story pages

## Feature 6: Parent Controls

### Requirements

6.1 WHEN a user is on the setup screen THEN they MAY access "Settings" (optional, hidden by default)

6.2 WHEN a user enters the settings password THEN parent controls are unlocked

6.3 WHEN parent controls are unlocked THEN a parent SHALL be able to:
  - Disable custom themes (use only presets)
  - Disable story history (no persistence)
  - Set content restrictions (age appropriateness)
  - Configure Polly voice defaults
  - Lock settings with a PIN

6.4 WHEN parent controls are configured THEN the system SHALL enforce those settings for all users

6.5 WHEN settings are locked THEN only users who enter the correct PIN can modify them

### Security

- PIN should be simple (4-6 digits) for parental oversight
- Settings stored in localStorage with basic obfuscation
- Not cryptographically secure; intended for family-friendly gatekeeping only

## Feature 7: Analytics

### Requirements

7.1 WHEN a story is generated THEN the system SHALL record the event with metadata:
  - Generation timestamp
  - Family members featured
  - Theme used
  - Story length
  - Time to generate (latency)
  - Voice selected

7.2 WHEN a user navigates through a story THEN the system MAY track page transitions and time spent per page

7.3 WHEN a user completes a story (reaches last page) THEN the system MAY record a "story completed" event

7.4 WHEN analytics data is collected THEN the system SHALL:
  - Store locally in browser (client-side analytics)
  - Optionally send to backend for aggregation (opt-in)

7.5 WHEN a parent views settings THEN they MAY see analytics dashboard showing:
  - Total stories generated
  - Most popular themes
  - Average story completion rate
  - Frequently featured family members

### Privacy

- Analytics are local-first (no data sent by default)
- Parent opt-in required for cloud analytics
- No personally identifiable information beyond family member names

## Feature 8: Bedtime Lessons & Story Morals

### Requirements

8.1 WHEN a story is generated THEN the system SHALL generate a 1–2 sentence bedtime moral or lesson learned from the story.

8.2 WHEN the user reaches the conclusion slide ("The End") THEN the system SHALL display the bedtime lesson in a highlighted takeaway card with star badge styling.

8.3 WHEN voice narration is active and the conclusion slide is displayed THEN the system SHALL automatically narrate: *"The End. Tonight's lesson: [lesson text]"*.

8.4 WHEN a story is saved to history THEN the system SHALL store the lesson alongside pages and metadata.

8.5 WHEN a previous story is reloaded from history THEN the system SHALL restore and display the original lesson.

## Feature 9: Interactive Next Chapter Choices

### Requirements

9.1 WHEN a story reaches the conclusion slide THEN the system SHALL present 2 distinct, child-friendly adventure choices for what should happen next.

9.2 WHEN a user selects a choice THEN the system SHALL generate the next chapter (incrementing chapter count) carrying forward family members, active theme, and storyline context from the selected choice.

9.3 WHEN generating the next chapter THEN the system SHALL display a personalized loading screen showing *"Weaving Chapter [N]: [choice text]..."*.

9.4 WHEN the user is on the conclusion slide THEN the system SHALL provide a "Return to Home & Start a New Story" option to reset back to setup.

9.5 WHEN the user uses a Fire TV remote or keyboard THEN the system SHALL support D-pad directional navigation (`ArrowLeft`, `ArrowRight`, `ArrowDown`, `ArrowUp`) between choice buttons and the Return Home button, with `Enter`/Select triggering the active action.

9.6 WHEN the user presses `ArrowLeft` from the first choice or presses `MediaRewind` THEN the system SHALL navigate back to the previous story page.

## Feature 10: Living Picture Book (Ken Burns & Ambient Motion)

### Requirements

10.1 WHEN an illustration is displayed on a story page THEN the system SHALL apply a subtle, slow cinematic Ken Burns pan/zoom camera animation (18–22s duration) matching voice narration pacing.

10.2 WHEN moving across story pages THEN the system SHALL alternate across 4 distinct camera trajectories (`kenburns-0` to `kenburns-3`: zoom-in, diagonal drift, zoom-out, reverse diagonal).

10.3 WHEN an illustration is rendered THEN the system SHALL display a subtle ambient particle overlay (`AmbientParticles`) featuring floating golden firefly motes and twinkling starlight dust motes.

10.4 WHEN an illustration is loading or encounters an error THEN the system SHALL gracefully degrade to an illustration placeholder without crashing or blocking narration.

10.5 WHEN the user or device has `prefers-reduced-motion: reduce` enabled THEN the system SHALL disable Ken Burns camera movement and particle float animations.

## Feature 11: Fire TV Web App Packaging & TV Experience

### Requirements

11.1 WHEN deployed on Fire TV or viewed in fullscreen THEN the system SHALL provide a Web App Manifest (`manifest.json`) specifying landscape orientation, fullscreen display, and theme colors.

11.2 WHEN packaged for the Amazon Appstore THEN the project SHALL provide an automated build script (`npm run package`) that produces a deployment-ready zip bundle (`family-story-night.zip`).

11.3 WHEN running in the browser THEN the system SHALL detect Fire TV user agents (`device.js`) based on Amazon Silk / AFT device identifiers.

11.4 WHEN the user presses the `Home` or `BrowserHome` key (`keyCode 36`) on the remote THEN the system SHALL immediately navigate back to the setup screen from any state.

11.5 WHEN interactive controls are navigated with the remote THEN the system SHALL display a high-contrast focus ring (`:focus-visible`), while excluding text input and textarea fields to preserve their underline styles.

11.6 WHEN remote media keys are pressed THEN the system SHALL support Play/Pause (`keyCode 179`), Fast Forward (`keyCode 228`), Rewind (`keyCode 227`), and Back (`keyCode 4`, `8`, `27`).

## Implementation Status & Timeline

All 11 features are fully implemented, unit tested, and integrated:
- **Phase 1**: Story History + Story Length Options (Completed)
- **Phase 2**: Custom Themes + Multiple Voices (Completed)
- **Phase 3**: Illustrations with Progressive Background Fetching (Completed)
- **Phase 4**: Parent Controls + Privacy-First Analytics (Completed)
- **Phase 5**: Bedtime Lessons + Interactive Next Chapter Choices (Completed)
- **Phase 6**: Living Picture Book (Ken Burns Motion + Ambient Particles) (Completed)
- **Phase 7**: Fire TV Web App Packaging & TV Navigation (Completed)
