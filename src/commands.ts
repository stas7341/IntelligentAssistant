import { validateAndPrepare } from "./services/queryValidator";
import { generateClarification, formatResponse } from "./services/gemini";
import {
  addQueryToHistory,
  clearWaitingForClarification,
  getContext,
} from "./services/conversationManager";
import { searchPlaces } from "./services/googlePlaces";
import { searchEvents } from "./services/googleEvents";
import { logger } from "./logger";
import type { PlacesEventsData } from "./types/context";

export type CommandResultType = "output" | "system" | "error" | "none";

export interface CommandResult {
  type: CommandResultType;
  lines?: string[];
}

/**
 * Intent → data source routing
 * Prevents unnecessary API calls and hallucinations
 */
const INTENT_HANDLERS: Record<
  string,
  (params: {
    location: string;
    radius: number;
    category?: string;
    date?: string;
  }) => Promise<PlacesEventsData>
> = {
  find_places: async ({ location, radius, category }) => ({
    places: await searchPlaces({ location, radius, type: category }),
    events: [],
  }),

  find_events: async ({ location, radius, date }) => ({
    places: [],
    events: await searchEvents({ location, radius, date }),
  }),

  recommend: async ({ location, radius, category }) => ({
    places: await searchPlaces({ location, radius, type: category }),
    events: [],
  }),
};

const NON_ACTIONABLE_INTENTS = [
  "greeting",
  "introduction",
  "smalltalk",
  "chitchat",
  "user_identification",
];

export async function executeQuery(
  raw: string,
  userId: string
): Promise<CommandResult> {
  const trimmed = raw.trim();
  if (!trimmed) return { type: "none" };

  try {
    const validated = await validateAndPrepare(trimmed, userId);
    const context = getContext(userId);

    // 🟢 Handle smalltalk / greetings
    if (NON_ACTIONABLE_INTENTS.includes(validated.intent)) {
      const name = context.userName ? ` ${context.userName}` : "";
      return {
        type: "output",
        lines: [
          `Hello${name}! 👋 I can help you find places, events, or recommend something nearby.`,
        ],
      };
    }

    // Store history
    addQueryToHistory(userId, trimmed, validated.intent);

    // 🟡 Low confidence → ask clarification
    if (validated.confidence < 0.5) {
      return {
        type: "output",
        lines: [
          "I want to make sure I understood you correctly. Are you looking for places or events?",
        ],
      };
    }

    // 🟠 Missing required data
    if (!validated.isComplete && validated.missingFields.length > 0) {
      const clarification = await generateClarification({
        intent: validated.intent,
        missingFields: validated.missingFields,
      });

      return {
        type: "output",
        lines: [clarification],
      };
    }

    // 🔴 Unsupported intent
    const handler = INTENT_HANDLERS[validated.intent];
    if (!handler) {
      return {
        type: "output",
        lines: [
          "I can help with finding places or events nearby. What would you like to explore?",
        ],
      };
    }

    const location = validated.extractedData?.location;
    const radius = validated.extractedData?.radius || 10;

    logger.log(
      `Executing intent=${validated.intent}, location=${location}, radius=${radius}`,
      "command"
    );

    const data = await handler({
      location,
      radius,
      category: validated.extractedData?.category,
      date: validated.extractedData?.date,
    });

    // 🧯 Hallucination recovery — no fake results
    if (!data.places.length && !data.events.length) {
      return {
        type: "output",
        lines: [
          `I couldn’t find any matching results near ${location} within ${radius} km.`,
          "You can try increasing the distance or choosing another activity.",
        ],
      };
    }

    const formatted = await formatResponse(data, trimmed);

    clearWaitingForClarification(userId);

    return {
      type: "output",
      lines: formatted.split("\n").filter(Boolean),
    };
  } catch (error) {
    logger.error(`Execution failed: ${error}`, "command");
    return {
      type: "error",
      lines: ["Something went wrong. Please try again."],
    };
  }
}
