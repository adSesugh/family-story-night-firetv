# Amazon Fire TV & AWS Developer Friction Log

This document outlines specific developer friction encountered during the development of **Family Story Night** for the Amazon Fire TV and AWS Builder hackathon tracks, including the task attempted, steps taken, expected vs. actual behavior, severity, workaround applied, and actionable platform suggestions.

---

### Task Attempted
Synchronizing real-time text highlight glow on a 65" Fire TV screen with Amazon Polly Neural narration and Fire TV WebView storage.

---

### Steps Taken
1. Invoked AWS Polly `SynthesizeSpeechCommand` requesting an MP3 audio stream for bedtime story narration.
2. Attempted to estimate word highlighting timing client-side using character-per-second ratios.
3. Attempted to store full-resolution 512x640 base64 illustrations in Fire TV WebView `localStorage` for offline family story replay.

---

### Expected Result
1. Story words highlight in real time on the TV screen with sub-second accuracy exactly when pronounced by Amazon Polly.
2. Story chapters with generated cover illustrations persist smoothly across app restarts and power cycles.

---

### Actual Result
1. Character-ratio timing drifted significantly across sentences due to natural pauses and speech cadence, causing Karaōke word highlighting to desync or jitter.
2. Fire TV WebView threw `QuotaExceededError` in `localStorage` when saving multiple multi-chapter stories with high-resolution image data, preventing subsequent stories from saving.

---

### Severity Rating
**High** (directly impacted core early-literacy feature and story persistence).

---

### Workaround Used
1. **Dual-Stream Polly Synthesis**: Dispatched parallel AWS Polly requests—one for the 48kHz Neural audio stream (`audio/mpeg`), and a second concurrent call requesting `SpeechMarkTypes: ["word"]` in JSON lines format. Mapped HTML5 Audio `timeupdate` offsets to the Polly SpeechMarks timestamps to achieve sub-second Karaōke word highlighting.
2. **Adaptive Storage Lightening (`safeSaveStories`)**: Engineered a quota-aware storage algorithm that preserves primary story metadata, chapter text, and cover illustrations while gracefully condensing older page images to remain strictly within Fire TV WebView storage budgets.

---

### Actionable Suggestions for Amazon Developer Platform
1. **Polly Single-Call Timestamp Embedding**: Provide a parameter (e.g. `IncludeSpeechMarks: true`) that embeds word timestamps directly in audio response headers or as a multipart stream, avoiding two separate API round-trips for audio and speech marks.
2. **Fire TV Storage Guidelines**: Document Fire TV WebView `localStorage` and `IndexedDB` quotas and best practices explicitly in the Amazon Fire TV developer documentation.
