# Amazon Fire TV & AWS Developer Friction Log

This document outlines specific developer friction encountered during the development of **Family Story Night** for the Amazon Fire TV and AWS Builder hackathon tracks, including the task attempted, steps taken, expected vs. actual behavior, severity, workaround applied, and actionable platform suggestions.

---

## Friction Log Entry 1: Amazon Polly SpeechMark Synchronization & Fire TV WebView Storage Quotas
**Date:** September 19, 2026

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
**Date:** September 21, 2026

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
2. **Native Alexa Voice Bridge for Web Apps**: Expose a JavaScript bridge API (e.g., `window.AmazonFireTV.speechRecognizer` or `AmazonVoiceService`) within the Fire TV Web App Runtime and Silk Browser. This would allow web apps to tap into Amazon's own Alexa cloud speech-to-text engine instead of depending on unavailable Google speech services.
3. **Local Intent Routing for Web Apps**: Allow Fire TV web apps to register an intent receiver locally with Fire TV OS so that pressing the remote Alexa button while the web app is foregrounded routes voice intents directly to the app without requiring an external AWS Lambda / HTTPS webhook round-trip.

---

## Friction Log Entry 3: D-Pad Focus Navigation Does Not Highlight Buttons on Fire TV Silk Browser
**Date:** September 21, 2026

### Task Attempted
Using the Fire TV remote D-pad (directional arrows) to navigate between interactive buttons, links, and inputs displayed in the web application — expecting each focused element to show a visible highlight ring so users can see what is currently selected.

---

### Steps Taken
1. Connected Fire TV to the dev server running on the local network.
2. Pressed D-pad arrow keys on the Fire TV remote while the application was open.
3. Verified that the D-pad keypresses were received correctly (story page-turning worked, theme cycling worked).
4. Observed that **no focus highlight ring** appeared on any button or link at any time, even though Tab navigation in a desktop browser produced correct highlighting.

---

### Expected Result
Pressing D-pad arrow keys should move a visible highlight ring (focus indicator) between interactive elements (buttons, links), matching the behaviour of Tab key navigation in a desktop browser.

---

### Actual Result
No visible focus ring appeared on any button or link when navigating with the D-pad on Fire TV.

The Fire TV Silk browser dispatches standard `keydown` events for D-pad keys (ArrowUp/Down/Left/Right → keyCodes 38/40/37/39), but it does **not** automatically move browser focus between elements in response to arrow keys. Desktop browsers move focus on `Tab`, not on arrow keys, so the platform's native behaviour is fundamentally different. As a result, `document.activeElement` always remained `<body>`, and `:focus`/`:focus-visible` CSS rules never triggered on any button.

Additionally, the existing `:focus-visible` CSS rule is not reliably supported on older Fire TV Silk versions, so even if focus were set programmatically, the ring may not have rendered without a fallback `:focus` rule.

---

### Severity
**High** — D-pad navigation is the primary input method on Fire TV. Without visible focus indicators, users cannot tell which button is currently selected, making the app effectively unusable with the remote.

---

### Workaround Applied
1. **Spatial Focus Navigation Engine** (`src/utils/spatialNav.js`): Implemented a custom spatial navigation engine that, on each arrow keypress, queries all visible focusable elements in the DOM, applies a directional cone filter (45° half-angle), scores candidates by weighted primary/secondary axis distance, and calls `.focus()` on the nearest element. This replicates the spatial focus model used by all native TV OS applications (webOS, Tizen, tvOS, Fire OS) for web apps.

2. **Integration in `App.jsx`**: The global `keydown` handler now calls `moveFocus(direction)` before falling back to the existing custom navigation logic. A `useEffect` calls `focusFirst()` with a 120ms delay whenever the active screen changes, ensuring something is always focused after a screen transition.

3. **Robust Focus Ring CSS** (`src/index.css`): Added a broad `:focus:not(input):not(textarea)` rule alongside `:focus-visible` so the amber glow ring appears even on older Silk versions that don't support `:focus-visible`. Ring thickness increased to 3px with a 4px offset and a `box-shadow` glow halo for TV-distance legibility.

---

### Actionable Suggestions for Amazon Developer Platform
1. **Automatic Spatial Navigation in Silk/Web App Runtime**: Implement automatic spatial D-pad focus management in the Fire TV Web App Runtime (or Amazon's Silk Browser in TV mode) so that web apps receive focus-on-arrow-key behaviour by default, eliminating the need for every developer to build a custom spatial navigation engine. This is a standard feature in WebKit for tvOS and should be available in Silk for Fire TV.
2. **`:focus-visible` Support Documentation**: Provide clear documentation and testing guidance about which CSS pseudo-classes (`:focus`, `:focus-visible`, `:focus-within`) are supported in each version of the Amazon Silk Browser, along with recommended fallback CSS patterns for TV web apps.
3. **TV Web App Starter Template**: Provide an official Amazon Fire TV web app starter kit that pre-includes spatial navigation, D-pad event handling, and proper focus ring CSS — reducing the barrier to building accessible, navigable web apps.

---

## Friction Log Entry 4: Deep-Learning Voice Cloning (XTTS-v2) & AWS Serverless (Lambda / API Gateway) Roadblocks
**Date:** September 26–30, 2026

### Task Attempted
Deploying the custom voice cloning microservice (XTTS-v2) onto AWS Serverless infrastructure (AWS Lambda + Amazon API Gateway) to provide a unified, zero-infrastructure AWS deployment alongside Amazon Bedrock and Amazon Polly.

---

### Steps Taken
1. Packaged the zero-shot voice cloning service into a Docker container image adhering to AWS Lambda container specifications.
2. Evaluated runtime cold-start and inference latency on x86_64 Lambda runtimes with maximum memory (10,240 MB RAM).
3. Attempted synchronous synthesis invocations routed through Amazon API Gateway (`/synthesize`).

---

### Expected Result
1. Lambda would cold-start in under 5–10 seconds, load the PyTorch model checkpoint, and synthesize 2–3 bedtime story sentences on CPU in under 3–5 seconds.
2. Amazon API Gateway would stream the resulting audio and speech marks to the Fire TV client without timing out.

---

### Actual Result
1. **No GPU Acceleration on AWS Lambda**: Lambda runtimes are strictly CPU-bound (x86_64 / ARM64). Deep autoregressive transformers and vocoders in XTTS-v2 require GPU tensor cores. On Lambda's shared vCPUs, synthesizing a single 3-sentence story page took **25 to 45+ seconds**, rendering the interactive bedtime reading experience sluggish and unviable.
2. **API Gateway 29-Second Hard Limit**: Amazon API Gateway enforces an immutable maximum integration timeout of **29 seconds**. Whenever CPU synthesis exceeded 29 seconds, API Gateway severed the connection and returned a `504 Gateway Timeout` before synthesis finished.
3. **Severe Cold-Start Penalty**: Pulling and loading the ~2.2 GB XTTS-v2 checkpoint and PyTorch runtime into memory during cold starts took **35 to 60+ seconds**, failing initial requests immediately.
4. **Container Image & Memory Footprint**: The uncompressed PyTorch + CUDA + XTTS-v2 container was ~7.2 GB, approaching Lambda's 10 GB container image limit and requiring costly 8–10 GB RAM allocations.

---

### Severity Rating
**High** (precluded running deep-learning zero-shot voice cloning on AWS Lambda serverless infrastructure).

---

### Workaround Applied
1. **Hybrid Cloud & Dedicated GPU Deployments**:
   - **Google Cloud Run with NVIDIA L4 GPU** (`deploy-cloudrun.sh`): Deployed on serverless Google Cloud Run with an NVIDIA L4 GPU (24 GB VRAM) providing **sub-second inference (~350–450ms per page)** while preserving scale-to-zero when idle ($0 idle cost).
   - **Amazon ECS / EC2 `g4dn.xlarge` Alternative**: Documented native AWS deployment using Amazon ECS with an EC2 `g4dn.xlarge` spot instance (NVIDIA T4 GPU) for teams requiring a single AWS cloud perimeter.
   - **Turn-key Google Colab T4 Runner** (`colab_voice_service.ipynb`): Created a fully scripted Colab notebook using a free NVIDIA T4 GPU and Cloudflare HTTPS tunneling, allowing judges and developers to run zero-shot voice cloning with zero setup cost.
2. **Narration Pipeline Prefetching & Non-Blocking Audio**:
   - Engineered `prefetchSubsequentPage` in `client/src/App.jsx` to prefetch narration for page $N+1$ in the background while page $N$ is being read aloud.
   - Decoupled audio playback from background illustration rendering so voice narration starts immediately without waiting for image diffusion.
3. **In-Memory Microservice Latent Caching**:
   - In `kokoroVoiceService.js`, tracked synchronized voice IDs in memory and omitted sending heavy base64 audio samples once the microservice has extracted and cached speaker conditioning latents (`.pt`), drastically cutting network payload overhead.

---

### Actionable Suggestions for Amazon Developer Platform
1. **GPU-Accelerated AWS Lambda Runtimes**: Provide optional fractional GPU or vGPU runtime slices (e.g., NVIDIA T4 / L4) for AWS Lambda container images, enabling modern generative AI and speech synthesis workloads to run in true serverless mode without dedicated EC2 management.
2. **Configurable API Gateway Timeouts**: Allow developers to configure HTTP API Gateway integration timeouts up to 60–120 seconds for AI and deep-learning inference payloads where response latency exceeds 29 seconds.
3. **Zero-Shot Voice Cloning Support in Amazon Polly**: Extend Amazon Polly Neural with a voice enrollment endpoint that accepts a 10-second reference audio sample, enabling developers to synthesize custom family voices directly through native Polly APIs without managing third-party PyTorch microservices.

---

## Friction Log Entry 5: Karaōke Highlighting Drift from Polly UTF-8 Byte Offsets & Acoustic Speech Marks Alignment
**Date:** September 27–30, 2026

### Task Attempted
Achieving pixel-perfect Karaōke read-along highlighting across both Amazon Polly Neural narration and custom XTTS-v2 cloned family voices on a 65" Fire TV screen, ensuring word glow precisely matches spoken words across stories containing quotes, dialogue dashes, and bedtime punctuation.

---

### Steps Taken
1. Requested word-level speech marks from Amazon Polly using `SpeechMarkTypes: ["word"]`.
2. Sliced story text in JavaScript using `mark.start` and `mark.end` returned by Polly.
3. Implemented synthetic speech mark generation for XTTS-v2 based on uniform character duration.

---

### Expected Result
1. The gold Karaōke highlight glow precisely tracks the spoken word on the TV screen.
2. The highlight cleanly pauses during breath pauses, punctuation breaks, and sentence transitions.

---

### Actual Result
1. **Polly UTF-8 Byte Offset vs. JavaScript UTF-16 Character Drift**: Amazon Polly specifies `start` and `end` offsets as **byte counts in UTF-8**. Bedtime stories generated by Claude 3.5 Sonnet frequently contain smart quotes (`“`, `”`), curly apostrophes (`’`), and em dashes (`—`), which occupy 3 bytes in UTF-8 but count as 1 character in JavaScript strings. After the first curly quote or apostrophe in a story, the client-side character slicing drifted by 2+ characters, highlighting the wrong words or splitting syllables across words.
2. **Highlight Stalling Across Punctuation**: Uniform character durations caused the Karaōke highlight to linger on the last word of a clause or sentence during natural speech pauses (e.g. at commas, semicolons, and periods), making the highlight appear stuck before jumping ahead.

---

### Severity Rating
**Medium-High** (jarring visual defect that undermined the literacy-reinforcing read-along experience on the living room display).

---

### Workaround Applied
1. **UTF-8 Byte to UTF-16 Character Offset Converter** (`server/controllers/narrateController.js`):
   - Implemented `convertPollyMarksToCharIndices` using Node.js `Buffer.from(text, "utf8").subarray(0, m.start).toString("utf8").length`.
   - Converts all incoming Polly speech mark offsets from UTF-8 byte positions into true JavaScript string character indices before delivering them to the Fire TV client.
2. **Acoustic Waveform Energy & Punctuation Pause Alignment** (`voice-service/xtts_manager.py`):
   - Replaced uniform character estimation with an acoustic energy envelope detector (`np.abs(audio_data) > 0.012`) to detect true speech onset and trailing silence.
   - Incorporated phonetic duration weighting (vowels count $1.6\times$ vs. consonants $0.7\times$).
   - Explicitly modeled natural punctuation pauses (480ms for periods/exclamations, 260ms for commas/dashes, 50ms inter-word gap).
3. **Clamped Word Glow Duration** (`client/src/utils/speechMarks.js`):
   - Updated `getActiveSpeechMarkAtTime` to honor explicit `mark.duration` with a strict lower bound (`Math.max(..., 80ms)`) and upper clamp, ensuring highlights cleanly extinguish during natural sentence pauses.

---

### Actionable Suggestions for Amazon Developer Platform
1. **Polly Character Offset Option**: Provide an option in the Amazon Polly SDK (e.g. `SpeechMarkUnit: "character"`) to return string character indices directly rather than UTF-8 byte offsets, eliminating the need for server-side byte re-encoding in web applications.
2. **Pre-Built Karaōke Component for Fire TV**: Include a reference Karaōke read-along component in the Fire TV developer sample library that demonstrates proper speech mark synchronization with HTML5 audio elements on Amazon Silk.



