import alexaSyncService from "../services/alexaSyncService.js";

/**
 * Builds standard Alexa Skills Kit response envelope.
 */
function buildAlexaResponse({ speechText, repromptText, shouldEndSession = false, sessionAttributes = {} }) {
  const response = {
    version: "1.0",
    sessionAttributes,
    response: {
      outputSpeech: {
        type: "PlainText",
        text: speechText,
      },
      shouldEndSession,
    },
  };

  if (repromptText) {
    response.response.reprompt = {
      outputSpeech: {
        type: "PlainText",
        text: repromptText,
      },
    };
  }

  return response;
}

/**
 * Normalizes slot value from Alexa request.
 */
function getSlotValue(intent, slotName) {
  if (!intent?.slots || !intent.slots[slotName]) return "";
  const slot = intent.slots[slotName];
  if (slot.resolutions?.resolutionsPerAuthority?.[0]?.values?.[0]?.value?.name) {
    return slot.resolutions.resolutionsPerAuthority[0].values[0].value.name;
  }
  return slot.value || "";
}

/**
 * Alexa Webhook Handler
 */
export async function handleAlexaWebhook(req, res) {
  try {
    const { request, session = {} } = req.body || {};
    if (!request) {
      return res.status(400).json({ error: "Invalid Alexa request payload" });
    }

    const sessionAttributes = session.attributes || {};
    let pairingCode = sessionAttributes.pairingCode || null;

    if (request.type === "LaunchRequest") {
      const speechText =
        "Welcome to Family Story Night! You can tell me the heroes' names, choose an adventure theme, or say start the story.";
      const repromptText = "Who's in tonight's bedtime story?";
      return res.json(
        buildAlexaResponse({ speechText, repromptText, shouldEndSession: false, sessionAttributes })
      );
    }

    if (request.type === "IntentRequest") {
      const intentName = request.intent?.name;

      switch (intentName) {
        case "SetNamesIntent": {
          const rawNames =
            getSlotValue(request.intent, "Names") ||
            getSlotValue(request.intent, "Name") ||
            getSlotValue(request.intent, "names");

          if (!rawNames) {
            return res.json(
              buildAlexaResponse({
                speechText: "Who would you like in the story? You can say: the heroes are Leo and Maya.",
                repromptText: "Who are the heroes in tonight's story?",
                shouldEndSession: false,
                sessionAttributes,
              })
            );
          }

          const result = alexaSyncService.queueCommand(pairingCode, {
            type: "SET_NAMES",
            names: rawNames,
          });

          if (!pairingCode && result.pairingCode) {
            sessionAttributes.pairingCode = result.pairingCode;
          }

          const speechText = result.success
            ? `Added ${rawNames} to tonight's story on your TV. What adventure should they go on?`
            : `Added ${rawNames}. Please make sure Family Story Night is open on your Fire TV.`;

          return res.json(
            buildAlexaResponse({
              speechText,
              repromptText: "You can choose a theme like Enchanted Forest, or say start the story.",
              shouldEndSession: false,
              sessionAttributes,
            })
          );
        }

        case "ChooseThemeIntent": {
          const rawTheme =
            getSlotValue(request.intent, "Theme") ||
            getSlotValue(request.intent, "theme");

          if (!rawTheme) {
            return res.json(
              buildAlexaResponse({
                speechText: "What theme would you like? You can say: Bedtime Adventures, Bible Stories, or Space Odyssey.",
                repromptText: "What story theme would you like to explore?",
                shouldEndSession: false,
                sessionAttributes,
              })
            );
          }

          const result = alexaSyncService.queueCommand(pairingCode, {
            type: "SET_THEME",
            theme: rawTheme,
          });

          if (!pairingCode && result.pairingCode) {
            sessionAttributes.pairingCode = result.pairingCode;
          }

          const speechText = result.success
            ? `Set theme to ${rawTheme}. Say begin story when you're ready!`
            : `Selected ${rawTheme}. Please check that Family Story Night is open on your Fire TV.`;

          return res.json(
            buildAlexaResponse({
              speechText,
              repromptText: "Say begin story to start reading!",
              shouldEndSession: false,
              sessionAttributes,
            })
          );
        }

        case "StartStoryIntent": {
          const result = alexaSyncService.queueCommand(pairingCode, {
            type: "START_STORY",
          });

          const speechText = result.success
            ? "Beginning tonight's bedtime adventure on your Fire TV now!"
            : "Starting your story. Please make sure Family Story Night is active on your TV.";

          return res.json(
            buildAlexaResponse({
              speechText,
              shouldEndSession: true,
              sessionAttributes,
            })
          );
        }

        case "NextPageIntent": {
          alexaSyncService.queueCommand(pairingCode, {
            type: "NAVIGATE_PAGE",
            direction: "next",
          });

          return res.json(
            buildAlexaResponse({
              speechText: "Turning to the next page.",
              shouldEndSession: true,
              sessionAttributes,
            })
          );
        }

        case "PreviousPageIntent": {
          alexaSyncService.queueCommand(pairingCode, {
            type: "NAVIGATE_PAGE",
            direction: "prev",
          });

          return res.json(
            buildAlexaResponse({
              speechText: "Going back to the previous page.",
              shouldEndSession: true,
              sessionAttributes,
            })
          );
        }

        case "ToggleNarrationIntent": {
          alexaSyncService.queueCommand(pairingCode, {
            type: "TOGGLE_NARRATION",
          });

          return res.json(
            buildAlexaResponse({
              speechText: "Toggling narration.",
              shouldEndSession: true,
              sessionAttributes,
            })
          );
        }

        case "LinkDeviceIntent": {
          const rawCode =
            getSlotValue(request.intent, "Code") ||
            getSlotValue(request.intent, "code");

          const cleanCode = (rawCode || "").replace(/\D/g, "");
          if (cleanCode.length === 4 || cleanCode.length === 6) {
            sessionAttributes.pairingCode = cleanCode;
            alexaSyncService.queueCommand(cleanCode, {
              type: "ALEXA_LINKED",
              code: cleanCode,
            });

            return res.json(
              buildAlexaResponse({
                speechText: `Connected to your Fire TV with code ${cleanCode.split("").join(" ")}. Who's in tonight's story?`,
                repromptText: "Who are the heroes in tonight's bedtime story?",
                shouldEndSession: false,
                sessionAttributes,
              })
            );
          }

          return res.json(
            buildAlexaResponse({
              speechText: "Please say the four digit code shown on your TV screen. For example: link code 1 2 3 4.",
              repromptText: "What is the four digit code shown on your Fire TV?",
              shouldEndSession: false,
              sessionAttributes,
            })
          );
        }

        case "AMAZON.HelpIntent": {
          const speechText =
            "You can say: the heroes are Leo and Maya, or choose a theme like Space Odyssey, or say start story.";
          return res.json(
            buildAlexaResponse({
              speechText,
              repromptText: "Who would you like in tonight's story?",
              shouldEndSession: false,
              sessionAttributes,
            })
          );
        }

        case "AMAZON.StopIntent":
        case "AMAZON.CancelIntent": {
          return res.json(
            buildAlexaResponse({
              speechText: "Goodnight and sweet dreams!",
              shouldEndSession: true,
              sessionAttributes,
            })
          );
        }

        case "AMAZON.FallbackIntent":
        default: {
          const speechText =
            "I didn't quite catch that. You can tell me the heroes' names, choose a theme, or say start story.";
          return res.json(
            buildAlexaResponse({
              speechText,
              repromptText: "Who is in tonight's bedtime story?",
              shouldEndSession: false,
              sessionAttributes,
            })
          );
        }
      }
    }

    if (request.type === "SessionEndedRequest") {
      return res.json({ version: "1.0", response: {} });
    }

    return res.json(
      buildAlexaResponse({
        speechText: "Welcome to Family Story Night. Say begin story when you're ready!",
        shouldEndSession: false,
        sessionAttributes,
      })
    );
  } catch (err) {
    console.error("Error processing Alexa request:", err);
    return res.status(500).json({
      version: "1.0",
      response: {
        outputSpeech: {
          type: "PlainText",
          text: "Sorry, I had trouble connecting to Family Story Night. Please try again.",
        },
        shouldEndSession: true,
      },
    });
  }
}

/**
 * Fire TV Client Endpoints
 */
export async function postSession(req, res) {
  try {
    const { sessionId } = req.body || {};
    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required" });
    }

    const sessionData = alexaSyncService.createOrTouchSession(sessionId);
    return res.json(sessionData);
  } catch (err) {
    console.error("Error creating/refreshing Alexa session:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function getEvents(req, res) {
  try {
    const { sessionId } = req.query || {};
    if (!sessionId) {
      return res.status(400).json({ error: "sessionId query parameter is required" });
    }

    const events = alexaSyncService.consumeCommands(sessionId);
    return res.json({ events });
  } catch (err) {
    console.error("Error consuming Alexa events:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
