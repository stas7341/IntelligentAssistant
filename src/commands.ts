import { validateAndPrepare } from "./services/queryValidator";
import { generateClarification, formatResponse } from "./services/gemini";
import {
  addQueryToHistory,
  clearWaitingForClarification,
  getContext,
  setWaitingForClarification,
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
const INTENT_HANDLERS: Record<string, (params: {
  category?: string;
  date?: string;
}) => Promise<PlacesEventsData>
> = {
  find_places: async ({ category }) => ({
    places: await searchPlaces({ category }),
    events: [],
  }),

  find_events: async ({ date }) => ({
    places: [],
    events: await searchEvents({ date }),
  }),

  recommend: async ({ category }) => ({
    places: await searchPlaces({ category }),
    events: [],
  }),
};

const NON_ACTIONABLE_INTENTS = [
  "greeting",
  "introduction",
  "smalltalk",
  "chitchat",
  "gratitude",
  "user_identification",
];

export async function executeQuery(raw: string,
  userId: string
): Promise<CommandResult> {
  const query = raw.trim();
  if (!query)
    return { type: "none" };

  try {
    const validated = await validateAndPrepare(query, userId);
    const context = getContext(userId);

    // 🟢 Handle smalltalk / greetings
    if (NON_ACTIONABLE_INTENTS.includes(validated.intent)) {
      if (validated.intent === "gratitude" || query.toLowerCase().includes("thank")) {
        return {
          type: "output",
          lines: ["You're welcome!"],
        };
      } else {
        const name = context.userName ? ` ${context.userName}` : "";
        return {
          type: "output",
          lines: [
            `Hello${name}! 👋 I can help you find places, events, or recommend something in Tel Aviv.`,
          ],
        };
      }
    }

    // Store history
    addQueryToHistory(userId, query, validated.intent);

    // 🟡 Low confidence → ask clarification
    if (validated.confidence < 0.5) {
      return {
        type: "output",
        lines: [
          "I want to make sure I understood you correctly. Are you looking for places or events in Tel Aviv? Please specify a category (e.g., restaurant, museum) and time of day (morning, afternoon, evening).",
        ],
      };
    }

    // 🟠 Missing required data
    if (!validated.isComplete && validated.missingFields.length > 0) {
      setWaitingForClarification(userId, validated.missingFields, query);

      const clarification = await generateClarification({
        intent: validated.intent,
        missingFields: validated.missingFields,
      });

      return {
        type: "output",
        lines: [clarification + " Please specify."],
      };
    }

    const handler = INTENT_HANDLERS[validated.intent];
    if (!handler) {
      // 🔴 Unsupported intent
      return {
        type: "output",
        lines: [
          "I can help with finding places or events in Tel Aviv. What would you like to explore?",
        ],
      };
    }

    logger.log(
      `Executing intent=${validated.intent} (Tel Aviv)`,
      "command"
    );

    const data = await handler({
      category: validated.extractedData?.category,
      date: validated.extractedData?.date,
    });

    // 🧯 Hallucination recovery — no fake results
    if (!data.places?.length && !data.events?.length) {
      return {
        type: "output",
        lines: [
          `I couldn’t find any matching results in Tel Aviv.`,
          "You can try another activity.",
        ],
      };
    }

    const formatted = await formatResponse(data, query);

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
