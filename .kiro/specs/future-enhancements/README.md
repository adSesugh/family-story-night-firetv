# Future Enhancements Roadmap

This directory contains the planned feature roadmap for Family Story Night beyond the MVP.

## Quick Summary

**7 Planned Enhancements**:

1. **Story History** ⭐ High Priority
   - Save and replay previously generated stories
   - Persistent local storage, max 50 stories
   - Timeline view with metadata

2. **Custom Themes** ⭐ High Priority
   - Users describe themes in their own words
   - "Spooky haunted house", "underwater adventure", etc.
   - Backend generates stories from custom descriptions

3. **Multiple Voices** ⭐ Medium Priority
   - Choose between Joanna, Matthew, Emma, Ivy
   - Different narration styles for variety
   - Persistent voice preference

4. **Story Length Options** ⭐ High Priority
   - 4-page, 6-page (default), or 8-page stories
   - Quick customization on setup screen
   - Maintains story quality across lengths

5. **Illustrations** ⭐ Lower Priority
   - Generate or fetch images for each page
   - Display above story text
   - Graceful fallback if unavailable

6. **Parent Controls** ⭐ Lower Priority
   - PIN-protected settings for parents
   - Control theme options, history, content restrictions
   - Analytics dashboard for usage insights

7. **Analytics** ⭐ Lower Priority
   - Track story generation, completion, favorites
   - Privacy-first (local storage by default)
   - Optional cloud sync for parents

## Implementation Timeline

| Phase | Features | Duration | Start |
|-------|----------|----------|-------|
| 1 | Story History + Length Options | 4 weeks | Q1 2024 |
| 2 | Custom Themes + Multiple Voices | 4 weeks | Q2 2024 |
| 3 | Illustrations (if approved) | 4 weeks | Q3 2024 |
| 4 | Parent Controls + Analytics | 4 weeks | Q4 2024 |

## Files in This Directory

- `requirements.md`: Detailed feature requirements with acceptance criteria
- `design.md`: Technical design, data structures, implementation strategy
- `README.md`: This file

## Key Principles

1. **Backward Compatible**: Existing MVP users see no breaking changes
2. **Client-First**: Leverage browser APIs before adding backend complexity
3. **Progressive Enhancement**: Features layer on top without breaking core
4. **Family-Friendly**: Privacy-first design, parental controls where needed

## Current MVP Status

✅ Core features complete:
- Story generation (AWS Bedrock)
- Text-to-speech narration (AWS Polly)
- Fire TV remote support
- Swiper.js for page navigation
- Tailwind CSS responsive design
- Audio auto-play on first page
- Keyboard/remote navigation

## Next Steps (When Ready)

1. **Discuss Priority**: Which features would add most value?
2. **Allocate Resources**: Developer time for each phase
3. **Gather Feedback**: User testing on Story History and Custom Themes
4. **Plan Backend Changes**: Coordinate with API team for new parameters

## Questions?

Refer to requirements.md for detailed specs, or design.md for technical details.
