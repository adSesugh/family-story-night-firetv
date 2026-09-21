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

---

## Friction Log Entry 2: Fire TV Remote Alexa Voice Input & Web App Tester Microphone Access

### Task Attempted
Enabling family voice input via the Fire TV remote to dictate family member names, choose bedtime story themes, and control story playback hands-free.

---

### Steps Taken
1. Integrated the standard HTML5 Web Speech API (`webkitSpeechRecognition` / `SpeechRecognition`) in the React client for speech-to-text.
2. Deployed the client to Fire TV using **Amazon Web App Tester (WAT)** connected to the local development server via LAN IP (`http://<PC_IP>:3001`).
3. Clicked the on-screen microphone icon and attempted to speak using the Fire TV remote's physical Alexa button.

---

### Expected Result
1. The web application would prompt for microphone access and capture voice input through the Fire TV remote or TV microphone.
2. The remote's physical Alexa button would pipe audio into the browser or trigger an in-app speech recognition event.

---

### Actual Result
1. **Insecure Context Block**: Connecting to the local development server via network IP (`http://192.168.X.X:3001`) caused Chromium / Android WebView to classify the page as an insecure context (`window.isSecureContext === false`). The browser unconditionally blocked microphone access and threw `event.error: "not-allowed"` without displaying a permission prompt.
2. **Web App Tester Lacks Address Bar & Flag Access**: Unlike Silk browser, Amazon Web App Tester runs inside a full-screen kiosk WebView without a URL bar, preventing developers from accessing `chrome://flags/#unsafely-treat-insecure-origin-as-secure` to whitelist the dev server IP.
3. **Absence of Google Speech Services on Fire OS**: The standard Chromium `webkitSpeechRecognition` engine relies under the hood on Google Play Speech Services (`com.google.android.googlequicksearchbox`), which are absent on Amazon Fire OS. Consequently, in-browser speech recognition fails even on secure origins inside Fire TV WebViews.
4. **Alexa Remote Button OS Interception**: The physical Alexa button on the Fire TV remote communicates over Bluetooth directly with the Fire TV OS kernel. The OS intercepts the audio for system-wide Alexa search and does not expose a raw audio stream to sandboxed web apps.

---

### Severity Rating
**High** (completely prevented in-browser microphone input on Fire TV Web App Tester).

---

### Workaround Used
1. **Insecure Context & Fire TV Platform Detection**:
   * Updated `useSpeechRecognition` and `SetupScreen` to detect `isSecureContext === false` and Fire TV Web App Tester user agents (`AmazonWebAppRuntime`).
   * Replaced generic browser permission error strings with specific, friendly on-screen guidance directing users to supported voice workflows.
2. **Fire TV On-Screen Virtual Keyboard Dictation**:
   * Configured the text input so pressing **Select** on the remote opens the native Fire TV virtual keyboard. In this native OS input mode, holding the remote's Alexa button successfully dictates text into the input field.
3. **Direct Alexa Skill Cloud Integration (Option 2)**:
   * Built a custom Alexa Skill webhook service (`/alexa`) on the Node.js backend.
   * Created `alexaSyncService` with session management and 4-digit numeric pairing codes (with zero-friction auto-pairing for single-TV households).
   * Developed the `useAlexaVoiceSync` client hook to poll for queued voice commands (`SET_NAMES`, `SET_THEME`, `START_STORY`, `NAVIGATE_PAGE`, `TOGGLE_NARRATION`) every 1.5 seconds.
   * Generated a complete Alexa Skills Kit `interactionModel.json` and setup guide, enabling users to control the TV by speaking to any Alexa device (*"Alexa, tell Family Story Night that the heroes are Maya and Liam"*).

---

### Actionable Suggestions for Amazon Developer Platform
1. **Insecure Origin Whitelist in Web App Tester**: Add a setting in the Amazon Web App Tester app to allow developers to whitelist specific local network IP addresses (`http://192.168.x.x:port`) as secure origins, allowing camera, audio, and media APIs to be tested without configuring custom SSL certificates.
2. **Native Alexa Voice Bridge for Web Apps**: Expose a JavaScript bridge API (e.g., `window.AmazonFireTV.speechRecognizer` or `AmazonVoiceService`) within the Fire TV Web App Runtime and Silk Browser. This would allow web apps to tap into Amazon’s own Alexa cloud speech-to-text engine instead of depending on unavailable Google speech services.
3. **Local Intent Routing for Web Apps**: Allow Fire TV web apps to register an intent receiver locally with Fire TV OS so that pressing the remote Alexa button while the web app is foregrounded routes voice intents directly to the app without requiring an external AWS Lambda / HTTPS webhook round-trip.

