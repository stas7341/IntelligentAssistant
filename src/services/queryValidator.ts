import { extractIntent } from "./gemini";
import { getContext, extractLocationFromText, setLocation, clearWaitingForClarification } from "./conversationManager";
import type { ValidatedQuery, ConversationContext } from "../types/context";
import { logger } from "../logger";

export async function validateAndPrepare(
  query: string,
  userId: string
): Promise<ValidatedQuery> {
  const trimmed = query.trim();

  if (!trimmed) {
    return {
      originalQuery: "",
      intent: "unknown",
      missingFields: [],
      confidence: 0.0,
      isComplete: false,
    };
  }

  // Get conversation context
  const context = getContext(userId);

  // Check if we're waiting for clarification and this might be a response
  if (context.waitingForClarification) {
    // Store originalQuery BEFORE clearing
    const originalQuery = context.waitingForClarification.originalQuery;

    // Try to extract location information from the response
    const locationInfo = extractLocationFromText(trimmed);

    if (locationInfo) {
      // Update location in context
      setLocation(userId, {
        city: locationInfo.city,
        radius: locationInfo.radius,
      });

      // Clear waiting state
      clearWaitingForClarification(userId);

      // Re-validate with the original query (now using the stored value)
      logger.log(`Location provided: ${locationInfo.city}, ${locationInfo.radius}km`, "command");
      return validateAndPrepare(originalQuery, userId);
    }
  }

  try {
    // Use Gemini to extract intent and missing fields
    const intentResult = await extractIntent(trimmed, context);

    // Handle user-identification intent for personalization
    if (intentResult.intent === "user_identification" && intentResult.extractedData?.name) {
      // Save user's name in context for future personalization
      context.userName = intentResult.extractedData.name.toString();
      logger.log(`User identified: ${context.userName}`, "command");
    }

    // Merge context location into missing fields check
    const missingFields = intentResult.missingFields.filter((field) => {
      if (field === "location" && context.location?.city) {
        return false; // Location is available
      }
      if (field === "radius" && context.location?.radius) {
        return false; // Radius is available
      }
      return true;
    });

    // Check if location was extracted from the query itself
    if (intentResult.extractedData?.location && !context.location?.city) {
      const locationInfo = extractLocationFromText(trimmed);
      if (locationInfo?.city) {
        setLocation(userId, {
          city: locationInfo.city,
          radius: locationInfo.radius || intentResult.extractedData.radius || undefined,
        });
        // Remove location from missing fields if we just found it
        const locationIndex = missingFields.indexOf("location");
        if (locationIndex !== -1) {
          missingFields.splice(locationIndex, 1);
        }
      }
    }

    // Merge extracted data with context
    const mergedData = {
      ...intentResult.extractedData,
      location: context.location?.city || intentResult.extractedData?.location || undefined,
      radius: context.location?.radius || intentResult.extractedData?.radius || undefined,
    };

    const isComplete = missingFields.length === 0;

    const validatedQuery: ValidatedQuery = {
      originalQuery: trimmed,
      intent: intentResult.intent,
      missingFields,
      confidence: intentResult.confidence,
      extractedData: mergedData,
      isComplete,
    };

    logger.log(
      `Query validated: intent=${intentResult.intent}, complete=${isComplete}, missing=${missingFields.join(", ")}`,
      "command"
    );

    return validatedQuery;
  } catch (error) {
    logger.error(`Query validation failed: ${error}`, "command");
    // Return fallback validated query
    return {
      originalQuery: trimmed,
      intent: "unknown",
      missingFields: ["location"],
      confidence: 0.0,
      isComplete: false,
    };
  }
}
