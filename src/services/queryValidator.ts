import { extractIntent } from "./gemini";
import { extractMissingData } from "./gemini";
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
  const context = getContext(userId);

  // First, extract intent of current query
  const intentResult = await extractIntent(query, context); // call gemini #1

  // Handle user_identification
  if (intentResult.intent === "user_identification" && intentResult.extractedData?.name) {
    context.userName = String(intentResult.extractedData.name);
  }

  // Then, check if waiting for clarification
  if (context.waitingForClarification) {
    const missingData = await extractMissingData(query, // call gemini #2
      context.waitingForClarification.missingFields
    );

    if (Object.keys(missingData).length > 0) {
      /** why we need this part:
       * use case: first query "recommend something" + the second query "restaurant"
       * If we used the current query's intent (find_places) instead of re-extracting:
       * would execute as find_places instead of recommend, this breaks the conversation context
       * it helps ensure accuracy and context preservation in the conversation flow, 
       * which is a core part of preventing hallucinations.
       */
      const originalIntentResult = await extractIntent( // call gemini #3 re-extract
        context.waitingForClarification.originalQuery,
        context
      );

      const mergedExtractedData = {
        ...originalIntentResult.extractedData,
        ...missingData,
      };

      const stillMissing = context.waitingForClarification.missingFields.filter(
        (field) => !mergedExtractedData[field]
      );

      const originalQuery = context.waitingForClarification.originalQuery;
      clearWaitingForClarification(userId);

      if (stillMissing.length > 0) {
        // Still missing some fields
        return {
          originalQuery,
          intent: originalIntentResult.intent,
          confidence: 0.5,
          missingFields: stillMissing,
          extractedData: mergedExtractedData,
          isComplete: false,
        };
      } else {
        // All fields filled
        return {
          originalQuery,
          intent: originalIntentResult.intent,
          confidence: 1.0,
          missingFields: [],
          extractedData: mergedExtractedData,
          isComplete: true,
        };
      }
    } else {
      // Not a clarification response, clear waiting and process current query
      clearWaitingForClarification(userId);
      // Fall through to normal processing
    }
  }

  // Normal processing
  const missingFieldsRaw = intentResult.missingFields ?? [];
  const missingFields = Array.isArray(missingFieldsRaw)
    ? missingFieldsRaw.filter((field) => field === "category" || field === "timeOfDay" || field === "date")
    : [];

  const extractedData = {
    ...intentResult.extractedData,
    category: intentResult.extractedData?.category,
    timeOfDay: intentResult.extractedData?.timeOfDay,
    date: intentResult.extractedData?.date,
  };

  const validated: ValidatedQuery = {
    originalQuery: query,
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


