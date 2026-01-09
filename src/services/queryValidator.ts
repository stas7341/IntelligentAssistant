import { extractIntent } from "./gemini";
import {
  getContext,
  setLocation,
  clearWaitingForClarification,
} from "./conversationManager";
import type { ValidatedQuery } from "../types/context";
import { logger } from "../logger";

/**
 * Strict, clarification-aware validation
 */
export async function validateAndPrepare(
  query: string,
  userId: string
): Promise<ValidatedQuery> {
  const trimmed = query.trim();
  const context = getContext(userId);

  // 🔁 Clarification response handling
  if (context.waitingForClarification) {
    const originalQuery = context.waitingForClarification.originalQuery;

    if (context.waitingForClarification.missingFields.includes("location")) {
      const locationMatch = extractExplicitLocation(trimmed);
      if (locationMatch) {
        setLocation(userId, locationMatch);
        clearWaitingForClarification(userId);
        return validateAndPrepare(originalQuery, userId);
      }
    }
  }

  const intentResult = await extractIntent(trimmed, context);

  // Save user identity
  if (
    intentResult.intent === "user_identification" &&
    intentResult.extractedData?.name
  ) {
    context.userName = String(intentResult.extractedData.name);
  }

  const missingFields = intentResult.missingFields.filter((field) => {
    if (field === "location" && context.location?.city) return false;
    if (field === "radius" && context.location?.radius) return false;
    return true;
  });

  const extractedData = {
    ...intentResult.extractedData,
    location: context.location?.city,
    radius: context.location?.radius,
  };

  const validated: ValidatedQuery = {
    originalQuery: trimmed,
    intent: intentResult.intent,
    confidence: intentResult.confidence,
    missingFields,
    extractedData,
    isComplete: missingFields.length === 0,
  };

  logger.log(
    `Validated intent=${validated.intent}, confidence=${validated.confidence}`,
    "validator"
  );

  return validated;
}

/**
 * Only extracts explicit "I'm in X" statements
 * Prevents false city detection
 */
function extractExplicitLocation(text: string): {
  city?: string;
  radius?: number;
} | null {
  const cityMatch = text.match(/(?:i'?m|am)\s+(?:in|at)\s+([A-Za-z\s]{2,})/i);
  const radiusMatch = text.match(/(\d+)\s*km/i);

  if (!cityMatch && !radiusMatch) return null;

  return {
    city: cityMatch?.[1]?.trim(),
    radius: radiusMatch ? Number(radiusMatch[1]) : undefined,
  };
}
