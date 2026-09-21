# Amazon Alexa Skill Setup Guide for Family Story Night

This guide walks you through setting up the **Family Story Night** Alexa Skill in the Amazon Developer Console so you can control your Fire TV app using voice commands from your Fire TV remote or any Amazon Echo smart speaker.

---

## Prerequisites
1. An Amazon Developer account (free to create at [developer.amazon.com](https://developer.amazon.com)).
2. Your backend server running with HTTPS:
   * **Production / Deployed**: `https://family-story-night-firetv.onrender.com/alexa`
   * **Local Dev**: Use an HTTPS tunnel like ngrok (`ngrok http 4000` -> `https://xxxx.ngrok-free.app/alexa`).

---

## Step 1: Create a New Alexa Skill
1. Go to the [Alexa Developer Console](https://developer.amazon.com/alexa/console/ask).
2. Click **Create Skill**.
3. **Skill Name**: Enter `Family Story Night`.
4. **Primary Locale**: Select `English (US)`.
5. **Model**: Select **Custom**.
6. **Hosting**: Select **Provision your own** (your Node.js web service).
7. Click **Next** (or **Create Skill**) and choose the **Start from Scratch** template.

---

## Step 2: Import the Interaction Model
1. In the left navigation menu, click **Interaction Model** > **JSON Editor**.
2. Replace all the contents of the JSON editor with the contents of [`interactionModel.json`](./interactionModel.json).
3. Click **Save Model** at the top of the page.
4. Click **Build Model** and wait 30–60 seconds for the model build to complete.

---

## Step 3: Configure the HTTPS Webhook Endpoint
1. In the left navigation menu, click **Endpoint**.
2. Select **HTTPS**.
3. Under **Default Region**, paste your server's Alexa endpoint:
   ```text
   https://family-story-night-firetv.onrender.com/alexa
   ```
   *(Or your local ngrok HTTPS URL: `https://<YOUR_SUBDOMAIN>.ngrok-free.app/alexa`)*
4. Under **Select SSL certificate type**, select:
   * For Render / custom domain: **My development endpoint is a sub-domain of a domain that has a wildcard certificate from a certificate authority**.
   * For ngrok: **My development endpoint is a sub-domain of a domain that has a wildcard certificate from a certificate authority**.
5. Click **Save Endpoints**.

---

## Step 4: Test in the Simulator or on Your Fire TV Remote
1. Click the **Test** tab in the top navigation bar.
2. Change the dropdown from **Off** to **Development**.
3. In the input box, type or speak:
   * *"open family story night"*
4. Alexa will respond:
   > *"Welcome to Family Story Night! You can tell me the heroes' names, choose an adventure theme, or say start the story."*

---

## Voice Commands Reference

| What You Say to Alexa | Action on Fire TV |
| :--- | :--- |
| *"Alexa, tell Family Story Night that the heroes are Maya and Liam"* | Fills in **"Maya, Liam"** on the TV setup screen |
| *"Alexa, ask Family Story Night to choose Space Odyssey"* | Switches the active collection & theme on TV |
| *"Alexa, ask Family Story Night to start the story"* | Triggers story generation and begins narration |
| *"Alexa, tell Family Story Night next page"* | Turns to the next story page |
| *"Alexa, tell Family Story Night previous page"* | Returns to the previous page |
| *"Alexa, tell Family Story Night to toggle narration"* | Pauses or resumes audio narration |
| *"Alexa, tell Family Story Night to link code 4 8 2 1"* | Pairs with a specific TV session code |

> [!TIP]
> **Zero-Friction Single TV Mode**: If you have one Fire TV running Family Story Night, the skill automatically routes all voice commands to your active TV session without requiring you to speak a pairing code!
