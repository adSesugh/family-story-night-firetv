# Family Story Night 📺✨

A Fire TV web app for the **Build, Ship, Shape: Amazon Developer Hackathon**
(Fire TV track + AWS Builder mini challenge).

Enter a few details about your family, and the app generates a short,
illustrated bedtime story starring them — narrated aloud and displayed
page-by-page, 10-foot-UI style, navigable with a Fire TV remote.

## Stack

- **Frontend**: React (Fire TV Web App Starter Kit compatible), D-pad/remote
  navigation, large-text TV-safe layout
- **Backend**: Node/Express
- **AWS Bedrock**: generates the story text (Claude via Bedrock)
- **AWS Polly**: narrates the story as audio

## Project structure

```
family-story-night/
  client/     # React frontend (deploy to Fire TV as a packaged web app)
  server/     # Node/Express backend calling Bedrock + Polly
```

## Setup

### 1. AWS credentials

You'll need an AWS account with Bedrock model access enabled (e.g. Anthropic
Claude models) and Polly enabled in your region. Set these environment
variables for the server:

```bash
export AWS_ACCESS_KEY_ID=your_key
export AWS_SECRET_ACCESS_KEY=your_secret
export AWS_REGION=us-east-1
export BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0
export BEDROCK_IMAGE_MODEL_ID=amazon.nova-canvas-v1:0
export BEDROCK_IMAGE_REGION=us-west-2
export POLLY_ENGINE=standard
```

### 2. Install & run the backend

```bash
cd server
npm install
npm start   # runs on http://localhost:4000
```

### 3. Install & run the frontend

```bash
cd client
npm install
npm start   # runs on http://localhost:3000
```

### 4. Package for Fire TV

Once you're happy with it locally, use Amazon's [Web App Tester](https://developer.amazon.com/docs/web-app-startkit/web-app-tester-overview.html)
to sideload and test on a real Fire TV device or the Vega/Fire TV simulator,
then package with the Amazon Web App Starter Kit for submission.