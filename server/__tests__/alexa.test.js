import { describe, it, expect, beforeEach } from "vitest";
import alexaSyncService from "../services/alexaSyncService.js";
import {
  handleAlexaWebhook,
  postSession,
  getEvents,
} from "../controllers/alexaController.js";

function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
  return res;
}

describe("Alexa Sync Service & Webhook Controller", () => {
  beforeEach(() => {
    alexaSyncService.reset();
  });

  describe("AlexaSyncService", () => {
    it("creates a new session with a 4-digit pairing code", () => {
      const session = alexaSyncService.createOrTouchSession("tv-session-123");
      expect(session.sessionId).toBe("tv-session-123");
      expect(session.pairingCode).toMatch(/^\d{4}$/);
      expect(session.isNew).toBe(true);
    });

    it("returns existing session if called again with same sessionId", () => {
      const s1 = alexaSyncService.createOrTouchSession("tv-session-123");
      const s2 = alexaSyncService.createOrTouchSession("tv-session-123");
      expect(s1.pairingCode).toBe(s2.pairingCode);
      expect(s2.isNew).toBe(false);
    });

    it("queues commands and consumes them", () => {
      const session = alexaSyncService.createOrTouchSession("tv-session-123");
      const queueResult = alexaSyncService.queueCommand(session.pairingCode, {
        type: "SET_NAMES",
        names: "Leo and Maya",
      });

      expect(queueResult.success).toBe(true);

      const commands = alexaSyncService.consumeCommands("tv-session-123");
      expect(commands.length).toBe(1);
      expect(commands[0].type).toBe("SET_NAMES");
      expect(commands[0].names).toBe("Leo and Maya");

      // Once consumed, queue is empty
      const emptyCommands = alexaSyncService.consumeCommands("tv-session-123");
      expect(emptyCommands.length).toBe(0);
    });

    it("auto-targets the single active session if no code is provided", () => {
      alexaSyncService.createOrTouchSession("single-tv-session");
      const queueResult = alexaSyncService.queueCommand(null, {
        type: "START_STORY",
      });

      expect(queueResult.success).toBe(true);
      expect(queueResult.sessionId).toBe("single-tv-session");

      const commands = alexaSyncService.consumeCommands("single-tv-session");
      expect(commands.length).toBe(1);
      expect(commands[0].type).toBe("START_STORY");
    });

    it("persists pairing code across memory resets and restores identical code", () => {
      const s1 = alexaSyncService.createOrTouchSession("persistent-tv-device-1");
      const code1 = s1.pairingCode;
      expect(code1).toMatch(/^\d{4}$/);

      // Simulate server restart or memory clear
      alexaSyncService.reset();

      // Device reconnects with same sessionId
      const s2 = alexaSyncService.createOrTouchSession("persistent-tv-device-1");
      expect(s2.pairingCode).toBe(code1);
    });

    it("recovers session from SQLite when Alexa sends command to a persistent code after server reset", () => {
      const session = alexaSyncService.createOrTouchSession("living-room-tv");
      const code = session.pairingCode;

      // Simulate server restart / memory clear
      alexaSyncService.reset();

      // Alexa targets the persistent 4-digit code
      const queueResult = alexaSyncService.queueCommand(code, {
        type: "START_STORY",
      });

      expect(queueResult.success).toBe(true);
      expect(queueResult.sessionId).toBe("living-room-tv");
      expect(queueResult.pairingCode).toBe(code);

      const commands = alexaSyncService.consumeCommands("living-room-tv");
      expect(commands.length).toBe(1);
      expect(commands[0].type).toBe("START_STORY");
    });

    it("honors client preferredCode if provided and persists it", () => {
      const session = alexaSyncService.createOrTouchSession("custom-tv", "7788");
      expect(session.pairingCode).toBe("7788");

      alexaSyncService.reset();

      const restored = alexaSyncService.createOrTouchSession("custom-tv");
      expect(restored.pairingCode).toBe("7788");
    });
  });

  describe("Alexa Webhook Controller", () => {
    it("handles LaunchRequest with bedtime welcome speech", async () => {
      const req = {
        body: {
          request: { type: "LaunchRequest" },
          session: { attributes: {} },
        },
      };
      const res = createMockRes();

      await handleAlexaWebhook(req, res);
      expect(res.body.version).toBe("1.0");
      expect(res.body.response.outputSpeech.text).toContain("Welcome to Family Story Night");
      expect(res.body.response.shouldEndSession).toBe(false);
    });

    it("handles SetNamesIntent and queues SET_NAMES command", async () => {
      const session = alexaSyncService.createOrTouchSession("tv-1");
      const req = {
        body: {
          request: {
            type: "IntentRequest",
            intent: {
              name: "SetNamesIntent",
              slots: {
                Names: { value: "Liam and Emma" },
              },
            },
          },
          session: { attributes: { pairingCode: session.pairingCode } },
        },
      };
      const res = createMockRes();

      await handleAlexaWebhook(req, res);
      expect(res.body.response.outputSpeech.text).toContain("Added Liam and Emma");

      const events = alexaSyncService.consumeCommands("tv-1");
      expect(events.length).toBe(1);
      expect(events[0].type).toBe("SET_NAMES");
      expect(events[0].names).toBe("Liam and Emma");
    });

    it("handles ChooseThemeIntent and queues SET_THEME command", async () => {
      const session = alexaSyncService.createOrTouchSession("tv-1");
      const req = {
        body: {
          request: {
            type: "IntentRequest",
            intent: {
              name: "ChooseThemeIntent",
              slots: {
                Theme: { value: "outer space" },
              },
            },
          },
          session: { attributes: { pairingCode: session.pairingCode } },
        },
      };
      const res = createMockRes();

      await handleAlexaWebhook(req, res);
      expect(res.body.response.outputSpeech.text).toContain("Set theme to outer space");

      const events = alexaSyncService.consumeCommands("tv-1");
      expect(events.length).toBe(1);
      expect(events[0].type).toBe("SET_THEME");
      expect(events[0].theme).toBe("outer space");
    });

    it("handles StartStoryIntent and queues START_STORY command", async () => {
      const session = alexaSyncService.createOrTouchSession("tv-1");
      const req = {
        body: {
          request: {
            type: "IntentRequest",
            intent: {
              name: "StartStoryIntent",
            },
          },
          session: { attributes: { pairingCode: session.pairingCode } },
        },
      };
      const res = createMockRes();

      await handleAlexaWebhook(req, res);
      expect(res.body.response.outputSpeech.text).toContain("Beginning tonight's bedtime adventure");
      expect(res.body.response.shouldEndSession).toBe(true);

      const events = alexaSyncService.consumeCommands("tv-1");
      expect(events.length).toBe(1);
      expect(events[0].type).toBe("START_STORY");
    });

    it("handles NextPageIntent, PreviousPageIntent, and ToggleNarrationIntent", async () => {
      alexaSyncService.createOrTouchSession("tv-1");

      const intents = [
        { name: "NextPageIntent", expectedType: "NAVIGATE_PAGE", direction: "next" },
        { name: "PreviousPageIntent", expectedType: "NAVIGATE_PAGE", direction: "prev" },
        { name: "ToggleNarrationIntent", expectedType: "TOGGLE_NARRATION" },
      ];

      for (const item of intents) {
        const req = {
          body: {
            request: {
              type: "IntentRequest",
              intent: { name: item.name },
            },
            session: { attributes: {} },
          },
        };
        const res = createMockRes();
        await handleAlexaWebhook(req, res);
        expect(res.body.response.shouldEndSession).toBe(true);

        const events = alexaSyncService.consumeCommands("tv-1");
        expect(events.length).toBe(1);
        expect(events[0].type).toBe(item.expectedType);
        if (item.direction) {
          expect(events[0].direction).toBe(item.direction);
        }
      }
    });

    it("handles LinkDeviceIntent with a 4-digit code", async () => {
      const session = alexaSyncService.createOrTouchSession("tv-link-test");
      const req = {
        body: {
          request: {
            type: "IntentRequest",
            intent: {
              name: "LinkDeviceIntent",
              slots: {
                Code: { value: session.pairingCode.split("").join(" ") },
              },
            },
          },
          session: { attributes: {} },
        },
      };
      const res = createMockRes();

      await handleAlexaWebhook(req, res);
      expect(res.body.response.outputSpeech.text).toContain("Connected to your Fire TV");
      expect(res.body.sessionAttributes.pairingCode).toBe(session.pairingCode);
    });

    it("handles HelpIntent and StopIntent", async () => {
      const helpReq = {
        body: {
          request: { type: "IntentRequest", intent: { name: "AMAZON.HelpIntent" } },
        },
      };
      const helpRes = createMockRes();
      await handleAlexaWebhook(helpReq, helpRes);
      expect(helpRes.body.response.outputSpeech.text).toContain("You can say");

      const stopReq = {
        body: {
          request: { type: "IntentRequest", intent: { name: "AMAZON.StopIntent" } },
        },
      };
      const stopRes = createMockRes();
      await handleAlexaWebhook(stopReq, stopRes);
      expect(stopRes.body.response.outputSpeech.text).toContain("Goodnight");
      expect(stopRes.body.response.shouldEndSession).toBe(true);
    });
  });

  describe("Fire TV Client Endpoints (postSession & getEvents)", () => {
    it("registers and polls events", async () => {
      const sessionReq = {
        body: { sessionId: "firetv-client-abc" },
      };
      const sessionRes = createMockRes();
      await postSession(sessionReq, sessionRes);

      expect(sessionRes.body.sessionId).toBe("firetv-client-abc");
      expect(sessionRes.body.pairingCode).toMatch(/^\d{4}$/);

      // Queue a command
      alexaSyncService.queueCommand("firetv-client-abc", {
        type: "SET_NAMES",
        names: "Charlie",
      });

      // Poll events
      const pollReq = {
        query: { sessionId: "firetv-client-abc" },
      };
      const pollRes = createMockRes();
      await getEvents(pollReq, pollRes);

      expect(pollRes.body.events.length).toBe(1);
      expect(pollRes.body.events[0].names).toBe("Charlie");
    });
  });
});
