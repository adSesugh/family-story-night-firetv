# Family Story Night — 2.5-Minute Video Demo Script

Follow this step-by-step recording guide when filming your demo video using **Mac Screen Recording** (`Cmd + Shift + 5`) or **Loom**. 

* **Target Length**: ~2 minutes 30 seconds
* **Setup before recording**: Have `http://localhost:3001` open in your browser in full screen (or 16:9 1080p). Make sure your server is running.

---

## 🎬 Scene 1: Introduction & Problem (0:00 – 0:25)
**What to show on screen**: Open on the **Family Story Night** main setup screen with its warm starlight glow.

**What to say**:
> *"Hi everyone! Welcome to **Family Story Night**, our submission for the Amazon Developer Hackathon in the Fire TV Track and AWS Builder Mini Challenge.*
> 
> *In millions of homes every evening, bedtime is a battlefield of blue-light overstimulation. Autoplay cartoons keep kids wired. We wanted to push past the obvious video-streaming player and transform the living room television into a warm, interactive digital hearth that brings parents and children together and physically helps kids wind down for peaceful sleep."*

---

## 🎬 Scene 2: Setup, 10-Foot UI & Family Voice Studio (0:25 – 0:55)
**What to show on screen**: 
1. Hover over the title and type in names: `"Liam, Maya"`.
2. Scroll to the **Narrator Voice** section. Click **"+ Record Loved One's Voice"** to display the Family Voice Studio modal.
3. Show the bedtime reading script and role selector, then close it and select a storyteller (e.g. Joanna or Matthew from the dropdown).
4. Cycle through theme categories showing Bible Stories, Space Voyage, Underwater Tales using left/right arrows.
5. Select story length (Quick 3 pages / Standard 6 pages / Extended 9 pages).

**What to say**:
> *"Family Story Night is designed from the ground up for the 10-foot Fire TV experience. It is fully navigable with the Fire TV remote D-pad, adheres to 5% overscan safety margins, and features high-contrast focus rings.*
> 
> *Parents can enter their children's names, pick imaginative Bedtime Adventures or inspiring Bible stories, select story length, and choose who tells tonight's story.*
> 
> *We even built a **Family Voice Studio**—allowing traveling parents, deployed military guardians, or grandparents to record a short bedtime reading sample so children fall asleep hearing their loved one's familiar voice, powered by XTTS-v2 zero-shot voice cloning."*

---

## 🎬 Scene 3: AI Story Generation & Live Illustration (0:55 – 1:40)
**What to show on screen**: 
1. Click **"Begin the story"**. 
2. Show the *"Turning up the lamp..."* generation screen with the book and candle animation.
3. When Page 1 opens, let the audio narrate. Point out:
   - The glowing amber word highlight following the voice
   - The watercolor illustration with Ken Burns panning
   - The page indicator at the bottom
4. Turn to page 2 using arrow key to show smooth page transitions.

**What to say**:
> *"When we press Begin, our Node.js backend calls **Amazon Bedrock** using **Amazon Nova Pro** to generate a structured multi-page bedtime story tailored to our children. Concurrently, Bedrock's **Amazon Nova Canvas** paints child-safe watercolor scene illustrations with cinematic Ken Burns camera panning.*
> 
> *Notice the voice: this is **Amazon Polly Standard**. In parallel with the 48kHz audio stream, we request word-level **Polly SpeechMarks**. The frontend synchronizes those timestamps with sub-second precision, highlighting each word in amber as it's spoken. This turns the 65-inch living room TV into a powerful literacy and vocabulary tool for young readers.*
>
> *We also support **Stability AI** as an alternative illustration engine for even faster image generation when needed."*

---

## 🎬 Scene 4: Bedtime Wind-Down Routine (1:40 – 2:10)
**What to show on screen**: 
1. Advance through the pages using the right arrow key on your keyboard.
2. Point out the screen dimmer veil activating and the ambient particles shifting from cool blue to candlelight amber.
3. On the final page, listen to the gentle 4-note lullaby chime synthesized via Web Audio API.
4. Show the ambient particle motion slowing down.

**What to say**:
> *"As the story nears its end, Family Story Night activates our **Bedtime Wind-Down Routine**. The TV screen gently dims its backlight contrast, floating particle motes shift from cool starlight to soothing candlelight amber, and as the story finishes, our custom Web Audio API synthesizes a soft, four-note pentatonic lullaby chime—cues designed to lower heart rates and signal that it's time for bed.*
>
> *This is backed by circadian research: the amber color temperature mimics candlelight at 2700K, and the particle slow-down creates a calming visual rhythm."*

---

## 🎬 Scene 5: Interactive Multi-Chapter Adventures & Testing (2:10 – 2:40)
**What to show on screen**: 
1. Show the conclusion slide: the Bedtime Lesson, the two interactive Next Adventure choice cards.
2. Click or highlight one of the adventure choices using D-pad navigation.
3. Show the "Tell the TV what to do next (Voice)" button if Alexa is configured.
4. Briefly show the History screen with saved stories.
5. Show the Return Home button at the bottom.

**What to say**:
> *"When the chapter ends, kids are given a bedtime moral to reflect on, and two creative choices for what should happen next.*
> 
> *Children can also use the Fire TV voice remote to dictate their own plot twist. Amazon Bedrock consumes the previous chapter's memory and spins a continuous Chapter 2 saga with unbroken character continuity.*
>
> *All stories are saved locally and can be replayed offline from the History screen.*
> 
> *Family Story Night is open-source under the MIT license, thoroughly verified by **290 automated tests with 100% pass rate**, and packaged ready for the Amazon Web App Tester.*
>
> *We also documented 5 significant Fire TV and AWS platform friction points we solved—from Polly SpeechMark UTF-8 byte offset conversion to custom spatial D-pad navigation engines.*
> 
> *Thank you so much for watching!"*

---

## 📝 Technical Notes for Recording

### Current Configuration (as of server/.env):
- **Story Generation**: Amazon Bedrock (Nova Pro v1:0)
- **Illustrations**: Amazon Bedrock (Nova Canvas) + Stability AI fallback available
- **Voice Narration**: Amazon Polly (Standard engine)
- **Voice Cloning**: XTTS-v2 via Cloudflare tunnel (https://insights-star-backing-presidential.trycloudflare.com)
- **AWS Region**: us-east-1
- **Illustration Region**: us-west-2

### Recording Tips:
1. **Clear your browser cache** before recording to ensure fresh state
2. **Close unnecessary browser tabs** for performance
3. **Use full screen mode** (F11 or presentation mode)
4. **Record at 1080p or 4K** for clarity
5. **Speak slowly and clearly** - remember judges may watch at 1.5x speed
6. **Show, don't just tell** - demonstrate features actively
7. **Use cursor highlighting** if available to guide viewer's eye
8. **Keep timer visible** to stay on pace (2.5 minutes total)

### What to Emphasize:
- ✅ **Fire TV optimization** (D-pad navigation, overscan-safe UI, 10-foot design)
- ✅ **AWS service integration** (Bedrock Nova Pro + Nova Canvas, Polly)
- ✅ **Innovation** (voice cloning, karaoke literacy, bedtime wind-down)
- ✅ **Production quality** (290 tests passing, comprehensive docs, friction log)
- ✅ **Real problem solving** (5 platform friction points documented with solutions)

### What to Avoid:
- ❌ Don't mention sensitive keys or credentials
- ❌ Don't show server terminal logs with API keys
- ❌ Don't dwell on technical implementation details (keep it user-focused)
- ❌ Don't go over 2:40 (judges have many videos to watch)

---

**Ready to record? Good luck! 🎥✨**
