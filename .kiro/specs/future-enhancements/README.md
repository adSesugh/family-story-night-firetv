# Future Enhancements Roadmap

This directory contains the planned feature roadmap for Family Story Night beyond the MVP.

## Quick Summary

## Quick Summary

**13 Implemented Enhancements**:

1. **Story History** ✅ Completed
   - Save and replay previously generated stories
   - Persistent local storage, max 50 stories
   - Timeline view with metadata, delete and clear features

2. **Custom Themes** ✅ Completed
   - Users describe themes in their own words (up to 100 characters)
   - Real-time character counter and validation
   - Backend generates stories from custom descriptions

3. **Multiple Voices** ✅ Completed
   - Choose between Joanna, Matthew, Emma, Ivy
   - Different narration styles for variety
   - Persistent voice preference in localStorage and Parent Settings

4. **Story Length Options** ✅ Completed
   - 4-page, 6-page (default), or 8-page stories
   - Customization on setup screen and parent settings
   - Dynamically scaled token limits and page prompts

5. **Illustrations & Progressive Loading** ✅ Completed
   - Immediate first-page illustration generation
   - Background progressive fetching for remaining pages with rate limiting
   - Offline compressed caching in localStorage

6. **Parent Controls** ✅ Completed
   - PIN-protected settings for parents
   - Control theme options, history, content restrictions
   - Reset PIN with security guard

7. **Analytics** ✅ Completed
   - Track story generation, completion, and page views
   - Privacy-first (local storage by default)
   - Parent dashboard summarizing favorites and completion rates

8. **Bedtime Lessons & Morals** ✅ Completed
   - Bedtime takeaway/moral generated with each story
   - Displayed on conclusion slide with warm amber starlight badge
   - Automatically read aloud by voice narration (*"The End. Tonight's lesson: ..."*)

9. **Interactive Next Chapter Choices** ✅ Completed
   - 2 branching adventure choices presented on completion screen
   - Episodic continuity carrying forward characters, theme, and previous chapter storyline
   - Full Fire TV D-pad / keyboard navigation between choices and Return Home

10. **Living Picture Book (Ken Burns & Ambient Motion)** ✅ Completed
    - 4 alternating GPU-accelerated cinematic camera pan/zoom variations over watercolor art
    - Ambient particle layer with floating golden fireflies and twinkling stardust motes
    - Automatic `prefers-reduced-motion` accessibility support

11. **Fire TV Web App Packaging & TV Navigation** ✅ Completed
    - Landscape fullscreen Web App Manifest (`manifest.json`) and app icons (192px, 512px)
    - `npm run package` zip build script for Amazon Appstore submission
    - Fire TV device detection (`device.js`)
    - Global Home key navigation (`keyCode 36`) and high-contrast focus rings (excluding text inputs)

12. **Illustration Performance, Concurrent Generation & Resilience** ✅ Completed
    - Amazon Nova Canvas (`amazon.nova-canvas-v1:0`) integration with fast standard rendering (7–9s)
    - Concurrency-limited worker pool (2 workers) and session cancellation to avoid stale requests
    - Bedrock ValidationException automatic retry with sanitized theme prompt
    - SVG watercolor stardust fallback stream guaranteeing no page ever hangs without imagery
    - Living canvas shimmer placeholder with starlight particles and progress indicator

13. **Bible Stories & Category Switcher** ✅ Completed
    - Category switcher tab system (`[ 🌟 Bedtime Adventures ]` and `[ 📖 Bible Stories ]`)
    - 6 curated biblical presets (Noah's Ark, David & Goliath, Daniel & Lions, Jonah, Good Samaritan, Bethlehem)
    - Fire TV remote D-pad category navigation (`ArrowLeft`/`ArrowRight`)
    - Claude 3.5 Sonnet faith and virtues prompt tuning (gentle helpers, timeless moral values, comforting bedtime atmosphere)
    - Radiant golden watercolor prompt styling with ancient Mediterranean warmth

## Implementation Timeline

| Phase | Features | Status |
|-------|----------|--------|
| 1 | Story History + Length Options | ✅ Completed |
| 2 | Custom Themes + Multiple Voices | ✅ Completed |
| 3 | Illustrations & Progressive Loading | ✅ Completed |
| 4 | Parent Controls + Analytics | ✅ Completed |
| 5 | Bedtime Lessons + Interactive Next Chapter Choices | ✅ Completed |
| 6 | Living Picture Book (Ken Burns + Ambient Particles) | ✅ Completed |
| 7 | Fire TV Packaging & TV Remote Experience | ✅ Completed |
| 8 | Illustration Performance & Concurrent Generation | ✅ Completed |
| 9 | Bible Stories & Category Switcher | ✅ Completed |

## Files in This Directory

- `requirements.md`: Detailed feature requirements with acceptance criteria
- `design.md`: Technical design, data structures, implementation strategy
- `tasks.md`: Granular task checklist with implementation details
- `README.md`: This roadmap summary file

## Key Principles

1. **Backward Compatible**: Existing MVP users and stories remain fully functional
2. **Client-First & Offline Resilience**: Local storage caching and graceful degradation
3. **Progressive Enhancement**: Media and animation enhance experience without blocking reading
4. **Family-Friendly & Bedtime-Ready**: Calming pacing, moral lessons, and parent controls

## Current App Status

✅ Full Production Ready:
- Story generation (AWS Bedrock Claude 3.5 Sonnet) with multi-category support (Bedtime Adventures & Bible Stories)
- Bedtime morals & interactive branching choices
- Text-to-speech narration (AWS Polly neural voices)
- Living picture book illustrations (Amazon Nova Canvas + Ken Burns + Ambient Particles)
- High-performance concurrent illustration worker pool with resilience fallbacks
- Complete Fire TV remote D-pad & gamepad controller support
- Amazon Web App packaging readiness
- Parent settings, history management, and privacy-first analytics
