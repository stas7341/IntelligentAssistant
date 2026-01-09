import { extractIntent } from "./gemini";
import {
  getContext,
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

  // 🔁 Clarification response handling (location/radius logic removed)

  const intentResult = await extractIntent(trimmed, context);

  // Save user identity
  if (
    intentResult.intent === "user_identification" &&
    intentResult.extractedData?.name
  ) {
    context.userName = String(intentResult.extractedData.name);
  }

  const missingFieldsRaw = intentResult.missingFields ?? [];
  const missingFields = Array.isArray(missingFieldsRaw)
    ? missingFieldsRaw.filter((field) => field === "category" || field === "timeOfDay")
    : [];

  const extractedData = {
    ...intentResult.extractedData,
    // Ensure category and timeOfDay are present if extracted
    category: intentResult.extractedData?.category,
    timeOfDay: intentResult.extractedData?.timeOfDay,
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


