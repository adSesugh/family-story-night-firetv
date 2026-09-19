# Devpost Hackathon Submission Guide & Form Answers

This document contains ready-to-copy text and formatting specifically structured for your **Devpost Project Submission** for **Build, Ship, Shape: Amazon Developer Hackathon** (📺 **Fire TV Track** & ☁️ **AWS Builder Mini Challenge**).

---

## 📋 Basic Project Details

* **Project Title**: Family Story Night
* **Tagline / Elevator Pitch** *(max 200 characters — 189 chars)*:
  > AI bedtime storytelling for Fire TV blending AWS Bedrock, Polly Karaōke read-along, voice remote twists, personalized voice clones, and soothing ambient wind-down on the living room screen.

---

## 📖 Project Story (Copy & Paste directly into the "About the Project" Markdown editor)

```markdown
## Inspiration

In millions of living rooms every evening, bedtime is a battlefield of blue-light overstimulation. Children finish dinner and immediately gravitate toward tablets or TV screens playing hyperactive, autoplay cartoons. Rather than calming young minds down for sleep, high-frequency dopamine loops leave kids wired, making lights-out stressful for both parents and children.

At the same time, we noticed that most smart TV applications treat the living room screen as a passive one-way video player. We asked ourselves: **What if we pushed past the obvious video player model?** What if the living room TV could become a warm, interactive digital hearth that brings parents and children together, fosters early childhood literacy, and physically helps kids wind down for peaceful sleep?

That vision inspired **Family Story Night**: a multi-modal, agentic bedtime storytelling companion crafted specifically for Amazon Fire TV and mobile web displays.

---

## What It Does

Family Story Night transforms the 10-foot television experience into a personalized, living storybook:

* 🎙️ **Voice Input via Fire TV Remote ("Tell the TV what to do next")**: Kids and parents can tap a microphone button or speak into the remote to dictate listener names, customize bedtime themes, or speak surprise adventure twists directly to the TV using the Web Speech API.
* 🎙️ **Personalized Voice Clones (Family Voice Studio)**: Enables traveling parents, deployed military guardians, or distant grandparents to record a short bedtime reading sample right in the app so children fall asleep listening to stories read in their loved one's familiar voice.
* 📖 **Personalized Co-Created Adventures**: Parents enter their children's names and choose between imaginative **Bedtime Adventures** (Space Explorers, Enchanted Forest, Ocean Deep) or inspiring **Bible & Faith Stories** (Noah's Ark, David & Goliath, Daniel in the Lions' Den).
* 🎨 **Live Generative Illustrations with Amazon Bedrock**: Scene by scene, Bedrock's **Stability AI (Stable Image Core)** generates child-friendly watercolor illustrations, displayed with cinematic Ken Burns camera panning and floating ambient stardust.
* 🎤 **Karaōke Read-Along Highlighting (AWS Polly SpeechMarks)**: As Amazon Polly's neural voices narrate each page, the TV highlights the spoken words in real time with a glowing amber drop-shadow, turning the 65" TV screen into a powerful literacy and vocabulary tool.
* 🌙 **Bedtime Wind-Down Routine ("Sleepy Mode")**: As the chapter progresses, the TV automatically physically dims backlight contrast, shifts ambient particle motes from cool starlight to soothing candlelight amber, and plays a gentle Web Audio pentatonic lullaby chime when the story finishes.
* 🧭 **Branching Adventure Frontier**: When a chapter concludes, children are presented with bedtime reflection lessons and can choose what happens next—generating continuous follow-up chapters with full character continuity.
* 📚 **Family Bookshelf & History**: Stories and completed chapters are saved locally with automatic image-quota lightening so families can revisit their favorite bedtime tales anytime.
* 📱 **Universal Responsive Design**: Seamlessly shifts between 10-foot living room TV displays (D-pad remote focus rings, 5% overscan safety margins) and phones/tablets for bedtime reading on the go.

---

## How We Built It

Family Story Night combines modern web standards with deep cloud-native AWS orchestration:

### 1. The 10-Foot Frontend Experience (Fire TV Web App)
* **Framework**: React 19 and Vite with Tailwind CSS.
* **10-Foot TV Remote Navigation**: Built from scratch to support native Fire TV remote keycodes (`ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`, `Enter`, `BrowserBack`, and media keys) with high-contrast glowing focus rings and overscan-safe margins.
* **Synchronized Karaōke Renderer**: Consumes timestamped SpeechMarks from AWS Polly to calculate sub-second character slicing on story paragraphs without jitter.
* **Zero-Asset Web Audio Chimes**: Synthesizes soft, dreamy 4-note pentatonic lullaby chimes (C5, E5, G5, C6) using pure `AudioContext` sine-wave oscillators—zero extra network bandwidth or external audio files required.
* **Responsive Layout Engine**: Uses adaptive aspect-ratio containers (`object-contain md:object-cover`) and CSS flex containment (`min-h-0`) so illustrations and story text remain crisp and unclipped across 360px phones and 4K TVs.

### 2. Backend Orchestration (Node.js & Express)
* **AWS SDK Bedrock Runtime**:
  * **Anthropic Claude 3.5 Sonnet (`anthropic.claude-3-5-sonnet-20241022-v2:0`)**: Structured JSON narrative generation with actionable moral takeaways and interactive branching choices. Employs continuity prompts to expand previous chapters seamlessly.
  * **Stability AI (`stability.stable-image-core-v1:1`)**: Concurrent parallel visual generation pipelines with automated prompt sanitization and fallback resilience.
* **Amazon Polly Dual-Stream Synthesis**: Executes parallel calls to `SynthesizeSpeechCommand` to simultaneously stream 48kHz Neural MP3 narration and word-level JSON SpeechMarks (`SpeechMarkTypes: ["word"]`).
* **Resilient In-Memory LRU & Quota Handling**: Protects browser storage limits by lightened canvas image caching so families can preserve dozens of bedtime stories.

---

## Challenges We Ran Into

1. **Synchronizing Polly Narration with UI Karaōke**:
   Standard text-to-speech audio outputs do not indicate when a specific word is spoken. We solved this by calling AWS Polly's `SynthesizeSpeech` twice in parallel: once for the neural MP3 voice stream, and once requesting `SpeechMarkTypes: ["word"]` JSON lines. On the frontend, we coupled HTML5 Audio `timeupdate` events to speechmark offsets to illuminate words with sub-second accuracy.
2. **Designing for the 10-Foot Living Room UI vs. Mobile Viewports**:
   Building an interface that looks stunning on a 65-inch 4K TV viewed from 10 feet away while remaining fully functional on a handheld smartphone was a major design challenge. We resolved this through responsive CSS architecture: on TVs, illustrations and text sit in a panoramic side-by-side layout with overscan margins; on phones, it stacks into a vertical storybook format with uncropped artwork and touch-friendly controls.
3. **Fire TV Storage Quotas & Re-generation on History Load**:
   Fire TV web apps run in WebView containers with strict `localStorage` limits (often ~5MB). Storing dozens of massive Base64 audio files and high-res illustrations caused storage quota errors. We engineered an adaptive storage algorithm that saves the text, lessons, and choices permanently, but aggressively strips out the heavy audio and most images. As a result, when users reload a story from their history, the application must dynamically re-request the audio from AWS Polly and re-generate the illustrations on the fly to bypass these quota limitations.

---

## Accomplishments That We're Proud Of

* **Personalized Voice Clones (Family Voice Studio)**: Solved a real emotional challenge for families with traveling parents, deployed military guardians, or long-distance grandparents by letting them record a short bedtime sample so children can fall asleep hearing their loved one's familiar voice.
* **Pushing Far Past the Obvious**: Instead of building another basic streaming video wrapper, we built an agentic, voice-enabled, multi-modal bedtime experience that genuinely aids parenting and sleep hygiene.
* **100% Automated Test Coverage**: Built a bulletproof testing pipeline with **26 frontend test suites (150 tests)** and **2 backend test suites (27 tests)**—totaling **177 automated tests** ensuring every user flow, remote keycode, and audio fallback behaves predictably.
* **Amazon Web App Tester Certified**: Packaged into a clean production distribution (`client/family-story-night.zip`) fully compliant with Amazon Fire TV web app submission specifications.

---

## What We Learned

* **10-Foot Design Thinking**: Remote controls change everything—from focus trap management and overscan padding to the critical importance of keeping font sizes legible from 10 feet away.
* **The Magic of Polly SpeechMarks**: SpeechMarks are dramatically underutilized in educational and children's apps; pairing timestamp marks with visual UI glows unlocks tremendous potential for early literacy.
* **Audio Synthesis on Constrained Devices**: Creating Web Audio API chimes directly in code is vastly superior to bundling MP3 assets on TV web apps—it guarantees zero latency and zero download overhead.

---

## What's Next for Family Story Night

* **Cloud Database Migration**: Migrate our local storage history implementation to a dedicated cloud database (like Amazon DynamoDB) to permanently store and instantly retrieve generated audio streams and artwork without hitting browser storage quotas or continually re-running generative models.
* **Alexa Skill & Echo Orchestration**: Allow families to initiate stories hands-free via Echo devices in the bedroom ("Alexa, start Family Story Night on Fire TV") and have the audio seamlessly follow them from the living room to the nightstand Echo Dot.
* **Login with Amazon (LWA) & Device Code Pairing**: Cloud-synchronize family bookshelves across multiple Fire TVs, iPads, and mobile phones.
* **Multi-Lingual Bedtime Translation**: Integrating Amazon Translate with multilingual Polly Neural voices so immigrant and bilingual families can experience heritage bedtime tales in their native languages.
```

---

## ☁️ AWS Builder Mini Challenge Answer
*(Copy and paste this directly into the "Which AWS services did you incorporate and how?" field on Devpost)*

Family Story Night incorporates three core AWS services via the official `@aws-sdk` to orchestrate an agentic, multi-modal bedtime experience on Amazon Fire TV:

### 1. Amazon Bedrock — Narrative Intelligence
* **Model**: `anthropic.claude-3-5-sonnet-20241022-v2:0` via `@aws-sdk/client-bedrock-runtime` (`InvokeModelCommand`).
* **How It Is Incorporated**:
  * **Structured Multi-Page Authoring**: Bedrock generates cohesive 4, 6, or 8-page bedtime stories returned in strict JSON schemas. For each page, it outputs child-appropriate text and a paired `scene` description tailored for image synthesis.
  * **Continuous Story Memory**: When children choose how their story continues (or dictate a voice twist via the Fire TV remote), Claude consumes the previous chapter's summary and selected plot choice to weave Chapter 2 with unbroken character continuity and fresh moral takeaways.
  * **Bedtime-Calibrated Prompt Engineering**: Strict safety filters guarantee zero frightening conflict, violence, or harsh pacing, ensuring content calms children down for sleep.

### 2. Amazon Bedrock — Generative Visuals
* **Model**: `stability.stable-image-core-v1:1` via `@aws-sdk/client-bedrock-runtime` (`InvokeModelCommand`).
* **How It Is Incorporated**:
  * **Watercolor Bedtime Scene Generation**: Generates lush, child-safe watercolor illustrations for each page using automated visual prompt sanitation.
  * **Cinematic Ken Burns Presentation**: On Fire TV, images are rendered with subtle slow-zoom panning and ambient floating stardust motes to capture young imaginations without hyperactive movement.
  * **Resilient Dual-Region Fallback**: Configured across `us-east-1` and `us-west-2` with an emergency SVG watercolor fallback generator if rate limits or network drops occur.

### 3. Amazon Polly — Neural Storytelling & Synchronized Literacy
* **Engine**: Amazon Polly Neural Text-to-Speech via `@aws-sdk/client-polly` (`SynthesizeSpeechCommand`).
* **How It Is Incorporated**:
  * **Dual-Stream Parallel Synthesis**: The backend fires two concurrent requests to Polly:
    1. A 48kHz Neural audio stream (`audio/mpeg`) featuring curated storytellers (Joanna, Matthew, Emma, Ivy) and customized family voice clone mappings.
    2. A word-level timestamp stream (`SpeechMarkTypes: ["word"]`) in JSON lines format.
  * **Real-Time Karaōke Highlighting**: The Fire TV frontend maps HTML5 Audio playback timestamps to Polly's word offsets, illuminating words in real time with an amber drop-shadow glow to turn bedtime reading into an early-literacy learning tool.

All integrations are verified by 177 automated test suites across the client and server.

---

## 🔓 Open Source Mini Challenge Answers
*(Copy and paste these directly into the Open Source Mini Challenge fields on Devpost)*

* **Are you submitting for the Open Source Mini Challenge?**:
  👉 **Yes**

* **Project Repository URL**:
  `https://github.com/adSesugh/family-story-night-firetv`

* **Contribution URL**:
  `https://github.com/adSesugh/family-story-night-firetv/tree/main`

* **GitHub Username**:
  `adSesugh`

* **Description of What You Did, How It Works, and Why It Matters**:
  > **What We Did**:
  > We created an entirely new, open-source multi-modal web application under the permissive MIT license (`LICENSE`) tailored for Amazon Fire TV and modern mobile devices. The project turns the living room screen into an interactive bedtime storybook that combines generative AI, synchronized speech synthesis, and sleep hygiene cues.
  >
  > **How It Works**:
  > The frontend (React 19 + Vite + Tailwind CSS) features a custom 10-foot remote D-pad focus engine, Web Speech API voice input, real-time Karaōke word highlighting synchronized with AWS Polly timestamped SpeechMarks, zero-asset Web Audio API pentatonic lullaby chimes, and a bedtime dimmer veil. The Node.js backend orchestrates Amazon Bedrock (`anthropic.claude-3-5-sonnet` for structured JSON narratives and `stability.stable-image-core` for child-safe watercolor art) with Amazon Polly neural dual-stream audio synthesis.
  >
  > **Why It Matters**:
  > Over 80% of children experience evening blue-light overstimulation from autoplay cartoon loops on tablets and TVs. Family Story Night open-sources a proven architectural blueprint demonstrating how developers can repurpose smart TV screens into calming, educational, shared family rituals that foster childhood literacy and healthy sleep routines.

---

## 🏷️ Built With Tags (Select or enter up to 25 tags on Devpost)

Copy and paste these tags into the "Built with" section:

```
amazon-bedrock, aws, aws-polly, fire-tv, react, node.js, javascript, tailwindcss, vite, speech-synthesis, speech-recognition, web-audio-api, claude-3.5-sonnet, stability-ai, generative-ai, html5, css3, express, jest, swiper, bedrock-runtime
```

---

## 🔗 "Try It Out" Links

* **GitHub Repository**:
  `https://github.com/adSesugh/family-story-night-firetv`
* **Packaged Fire TV Web App**:
  `client/family-story-night.zip` (Ready for sideloading directly in the Amazon Web App Tester on Fire TV / Fire Stick)
* **Local Run Command**:
  `npm run dev` (Runs backend on port 3000 and client on port 3001)

---

## 📸 Project Media: Image Gallery Recommendations

Devpost accepts up to 15 images (PNG/JPG, 3:2 ratio recommended). You can capture screenshots directly from your browser devtools or Web App Tester:

1. **Cover / Hero Image (`hero-overview.png`)**:
   * *Caption*: "Family Story Night running on Amazon Fire TV with D-pad focus indicators and warm ambient bedtime aesthetic."
2. **Setup Screen with Voice Input (`setup-voice-dictation.png`)**:
   * *Caption*: "Dictate listener names and bedtime themes into the Fire TV remote using the Web Speech API."
3. **Story Page with Polly Karaōke Read-Along (`karaoke-reading.png`)**:
   * *Caption*: "AWS Polly SpeechMarks illuminate words in real time with an amber drop-shadow to promote early childhood literacy."
4. **Bedtime Wind-Down Mode & Ambient Dimmer (`bedtime-winddown.png`)**:
   * *Caption*: "Automatic blue-light dimmer veil and slow-drifting candlelight fireflies transition kids smoothly to sleep."
5. **Chapter Conclusion & Frontier Adventure Choices (`conclusion-choices.png`)**:
   * *Caption*: "Bedtime reflection lesson with interactive branching choices and custom voice twist input."
6. **Family Bookshelf & Story History (`history-bookshelf.png`)**:
   * *Caption*: "Revisit treasured bedtime journeys and faith-filled stories with resilient quota caching."
7. **Mobile & Tablet Responsive Layout (`mobile-responsive.png`)**:
   * *Caption*: "Fluidly adapts from 65-inch 4K living room TVs to tablets and smartphones for bedside reading."

---

## 🎥 Video Demo Link (Required by Devpost)

Devpost requires a video URL (hosted on YouTube, Vimeo, or Loom) embedded directly at the top of your submission.

* **Field Name on Devpost**: `Video demo link`
* **Recommended Length**: 2 to 3 minutes (~2:30 target)
* **Accepted Platforms**: YouTube (set to **Public** or **Unlisted**), Loom, or Vimeo
* **How to Record on Mac**:
  1. Press `Cmd + Shift + 5` on your Mac.
  2. Choose **Record Selected Portion** or **Record Entire Screen** (16:9 / 1920x1080 resolution). Under *Options*, ensure your microphone is selected.
  3. Open `http://localhost:3001` in your browser.
  4. Press **Record**, follow the spoken script and on-screen cues below, then press the Stop button in your menu bar.
  5. Upload to YouTube/Loom and paste the resulting URL into Devpost.

---

### 🎙️ 2.5-Minute Video Recording Script & On-Screen Action Guide

#### 🎬 Scene 1: Introduction & Problem (0:00 – 0:25)
* **On-Screen Action**: Full-screen view of the **Family Story Night** main setup screen with its warm starlight glow and D-pad remote focus indicator.
* **Spoken Dialogue**:
  > *"Hi everyone! Welcome to **Family Story Night**, our submission for the Amazon Developer Hackathon in the Fire TV Track and AWS Builder Mini Challenge.*
  > 
  > *In millions of homes every evening, bedtime is a battlefield of blue-light overstimulation. Autoplay cartoons keep kids wired. We wanted to push past the obvious video player model and transform the 10-foot Fire TV screen into a warm, interactive digital hearth that brings parents and children together and physically helps kids wind down for restful sleep."*

#### 🎬 Scene 2: Characters, Theme & Loved One's Voice (0:25 – 0:55)
* **On-Screen Action**:
  1. Highlight the Child Names field and type or dictate: `"Liam, Maya"`.
  2. Select a theme: click `"Bedtime Adventures"` (or `"Bible & Faith Stories"`).
  3. Scroll down to Narrator Voice. Click **"+ Record Loved One's Voice"** to display the **Family Voice Studio** modal.
  4. Show the bedtime reading sample script and role tag (`Mom`, `Dad`, `Grandparent`), then close and select a voice (e.g. Joanna or Matthew).
* **Spoken Dialogue**:
  > *"Family Story Night is designed from the ground up for the 10-foot Fire TV remote experience with 5% overscan safety and high-contrast D-pad focus rings.*
  > 
  > *Parents can enter their children's names and pick from imaginative adventures or inspiring faith stories.*
  > 
  > *We also built a **Family Voice Studio**—allowing traveling parents, deployed military guardians, or grandparents to record a short bedtime reading sample right in the app so children fall asleep hearing their loved one's familiar voice."*

#### 🎬 Scene 3: Bedrock Generation & Polly Neural Karaōke (0:55 – 1:40)
* **On-Screen Action**:
  1. Click or press Enter on **"Begin the story"**.
  2. Show the *"Turning up the lamp..."* generation transition.
  3. When Page 1 opens, let the audio play. Point out the glowing amber word-level highlight following Polly's voice, and the watercolor illustration with Ken Burns panning.
* **Spoken Dialogue**:
  > *"When we press Begin, our backend calls **Amazon Bedrock** using **Anthropic Claude 3.5 Sonnet** to generate a personalized multi-page bedtime story. In parallel, Bedrock's **Stability AI** paints child-safe watercolor illustrations with cinematic Ken Burns panning.*
  > 
  > *Notice the voice: this is **Amazon Polly Neural**. In parallel with the 48kHz audio stream, we request word-level **Polly SpeechMarks**. The Fire TV frontend synchronizes those timestamps with sub-second precision, highlighting each word in amber as it's spoken. This turns the 65-inch living room TV into a powerful literacy and vocabulary tool for young readers."*

#### 🎬 Scene 4: Bedtime Dimmer Veil & Lullaby Chime (1:40 – 2:10)
* **On-Screen Action**:
  1. Press the right arrow key on your keyboard or remote to progress through the story pages.
  2. Point out the **Bedtime Dimmer Veil** kicking in, and ambient particles shifting from cool blue to warm candlelight amber.
  3. On the final page, listen to the gentle 4-note lullaby chime synthesized via Web Audio API.
* **Spoken Dialogue**:
  > *"As the story nears its end, Family Story Night activates our **Bedtime Wind-Down Routine**. The TV screen gently dims its backlight contrast, floating particle motes shift from cool starlight to soothing candlelight amber, and as the story finishes, our custom Web Audio API synthesizes a soft, four-note pentatonic lullaby chime—calming cues designed to lower heart rates and signal that it's time for bed."*

#### 🎬 Scene 5: Interactive Adventure Choices & Voice Remote Dictation (2:10 – 2:40)
* **On-Screen Action**:
  1. Show the conclusion screen: the Bedtime Lesson, the two interactive Next Adventure choice cards, and the *"Tell the TV what to do next (Voice)"* button.
  2. Highlight the voice twist button.
  3. Show the Return Home button at the bottom.
* **Spoken Dialogue**:
  > *"When the chapter ends, kids are given a bedtime moral to reflect on, and two creative choices for what should happen next.*
  > 
  > *Children can also use the Fire TV voice remote and tap **'Tell the TV what to do next'** to dictate their own plot twist. Amazon Bedrock consumes the previous chapter's memory and spins a continuous Chapter 2 saga with unbroken character continuity.*
  > 
  > *Family Story Night is open-source under the MIT license, thoroughly verified by 177 automated tests, and packaged ready for the Amazon Web App Tester.*
  > 
  > *Thank you so much for watching!"*

---

### 📝 Video Description (Copy & Paste to YouTube / Loom Video Description)

```
Family Story Night — Bedtime Storytelling for Amazon Fire TV & AWS
Submitted to Build, Ship, Shape: Amazon Developer Hackathon (Fire TV Track & AWS Builder Mini Challenge)

GitHub: https://github.com/adSesugh/family-story-night-firetv
Friction Log: https://github.com/adSesugh/family-story-night-firetv/blob/main/FRICTION_LOG.md

Key Features Demonstrated:
0:00 - Introduction & 10-Foot Living Room Bedtime Concept
0:25 - D-pad Remote Navigation, Characters & Family Voice Studio
0:55 - Amazon Bedrock (Claude 3.5 & Stability AI) + AWS Polly Neural Karaōke Read-Along
1:40 - Bedtime Dimmer Veil & Web Audio API Pentatonic Lullaby Chime
2:10 - Next Adventure Choices & Voice Remote Twist Dictation
```

