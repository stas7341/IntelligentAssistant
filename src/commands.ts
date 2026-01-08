import { validateAndPrepare } from "./services/queryValidator";
import { generateClarification, formatResponse } from "./services/gemini";
import { addQueryToHistory, setWaitingForClarification, getContext } from "./services/conversationManager";
import { searchPlaces } from "./services/googlePlaces";
import { searchEvents } from "./services/googleEvents";
import { logger } from "./logger";
import type { PlacesEventsData } from "./types/context";

export type CommandResultType = "output" | "system" | "error" | "none";

export interface CommandResult {
  type: CommandResultType;
  lines?: string[];
}

export interface ParsedInput {
  command: string;
  args: string[];
}

export async function executeQuery(raw: string, userId: string): Promise<CommandResult> {
  const trimmed = raw.trim();

  if (!trimmed) {
    return { type: "none" };
  }

  try {
    // Validate and prepare the query using Gemini
    const validatedQuery = await validateAndPrepare(trimmed, userId);

    // Add query to history, use shared memory to support scaling
    addQueryToHistory(userId, trimmed, validatedQuery.intent);

    // Check if query is complete (has all required information)
    if (!validatedQuery.isComplete && validatedQuery.missingFields.length > 0) {
      // Generate clarification question using Gemini
      const clarification = await generateClarification(validatedQuery.missingFields);

      // Set waiting state
      setWaitingForClarification(userId, validatedQuery.missingFields, trimmed);

      logger.log(`Asking for clarification: ${validatedQuery.missingFields.join(", ")}`, "command");

      return {
        type: "output",
        lines: [clarification],
      };
    }

    // Query is complete, proceed with fetching data and formatting response
    const context = getContext(userId);
    const location = context.location?.city || validatedQuery.extractedData?.location || "unknown location";
    const radius = context.location?.radius || validatedQuery.extractedData?.radius || 10;

    logger.log(`Processing complete query: intent=${validatedQuery.intent}, location=${location}, radius=${radius}km`, "command");

    // Fetch data from Google Places and Events APIs
    const placesData = await searchPlaces({
      location,
      radius,
      type: validatedQuery.extractedData?.category || undefined,
    });

    const eventsData = await searchEvents({
      location,
      radius,
      date: validatedQuery.extractedData?.date || undefined,
    });

    // Prepare data for formatting
    const placesEventsData: PlacesEventsData = {
      places: placesData || [],
      events: eventsData || [],
    };

    // If no data found, provide a helpful message
    if ((!placesData || placesData.length === 0) && (!eventsData || eventsData.length === 0)) {
      return {
        type: "output",
        lines: [
          `I couldn't find any results for ${location} within ${radius}km. The Google Places and Events APIs are not yet fully integrated. Please check back later!`,
        ],
      };
    }

    // Format response using Gemini
    const formattedResponse = await formatResponse(placesEventsData, trimmed);

    // Clear waiting state since we've processed the query
    setWaitingForClarification(userId, [], "");

    return {
      type: "output",
      lines: formattedResponse.split("\n").filter((line) => line.trim().length > 0),
    };
  } catch (error) {
    logger.error(`Command execution failed: ${error}`, "command");

    // Fallback response
    return {
      type: "error",
      lines: [
        "I encountered an error processing your request. Please try again or rephrase your question.",
      ],
    };
  }
}

