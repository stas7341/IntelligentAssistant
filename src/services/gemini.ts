import { GoogleGenAI } from "@google/genai";
import { logger } from "../logger";
import type {
  ConversationContext,
  IntentResult,
  PlacesEventsData,
} from "../types/context";

/**
 * Allowed intents – hard guardrail against hallucinations
 */
const ALLOWED_INTENTS = [
  "find_places",
  "find_events",
  "recommend",
  "greeting",
  "introduction",
  "smalltalk",
  "user_identification",
  "unknown",
];

let genAI: GoogleGenAI | null = null;

export function initialize(): void {
  const apiKey = process.env.GOOGLE_AI_API_KEY;

  if (!apiKey) {
    throw new Error("GOOGLE_AI_API_KEY is missing");
  }

  genAI = new GoogleGenAI({ apiKey });
  logger.log("Gemini initialized", "server");
}

/**
 * Low-level generation with model fallback
 */
async function generateContent(prompt: string): Promise<string> {
  if (!genAI) {
    throw new Error("Gemini not initialized");
  }

  const models = ["gemini-2.0-flash-lite", "gemini-2.5-flash-lite", "gemini-2.0-flash", "gemini-2.5-flash"];

  for (const model of models) {
    try {
      const res = await genAI.models.generateContent({
        model,
        contents: prompt,
      });
      return res?.text?.trim() ?? "";
    } catch (err: any) {
      if (err?.status === 429) continue;
      throw err;
    }
  }

  throw new Error("All Gemini models unavailable");
}

/* ------------------------------------------------------------------ */
/* --------------------------- INTENT -------------------------------- */
/* ------------------------------------------------------------------ */

export async function extractIntent(
  userInput: string,
  context: ConversationContext
): Promise<IntentResult> {
  const systemPrompt = `
You are a STRICT intent extraction engine.

Rules:
- DO NOT answer the user
- DO NOT suggest places or events
- DO NOT invent data
- Choose intent ONLY from this list:
${ALLOWED_INTENTS.join(", ")}

Required output:
Valid JSON only. No markdown.

Schema:
{
  "intent": "string",
  "missingFields": ["date", "category", "timeOfDay"],
  "confidence": number (0.0 - 1.0),
  "extractedData": {
    // location and radius removed
    "category": string | null,
    "timeOfDay": string | null,
    "date": string | null,
    "category": string | null,
    "name": string | null
  }
}
`;

  const contextInfo = "City: Tel Aviv";

  const prompt = `
${systemPrompt}

Context:
${contextInfo}

User message:
"${userInput}"
`;

  try {
    const raw = await generateContent(prompt);
    const parsed = safeParseJSON(raw);

    const intent =
      ALLOWED_INTENTS.includes(parsed.intent) ? parsed.intent : "unknown";

    return {
      intent,
      missingFields: Array.isArray(parsed.missingFields)
        ? parsed.missingFields
        : [],
      confidence:
        typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
      extractedData: parsed.extractedData ?? {},
    };
  } catch (err) {
    logger.error(`Intent extraction failed: ${err}`, "gemini");
    return {
      intent: "unknown",
      missingFields: [],
      confidence: 0.0,
      extractedData: {},
    };
  }
}

/* ------------------------------------------------------------------ */
/* ---------------------- CLARIFICATION ------------------------------ */
/* ------------------------------------------------------------------ */

export async function generateClarification(params: {
  intent: string;
  missingFields: string[];
}): Promise<string> {
  const prompt = `
You are asking a clarification question.

Intent: ${params.intent}
Missing information: ${params.missingFields.join(", ")}

Rules:
- Ask ONE short, friendly question
- Do NOT recommend anything
- Do NOT guess missing data
- Be conversational

Example:
"Could you tell me where you are and how far you're willing to travel?"

Output only the question.
`;

  return generateContent(prompt);
}

/* ------------------------------------------------------------------ */
/* ---------------------- RESPONSE FORMAT ---------------------------- */
/* ------------------------------------------------------------------ */

export async function formatResponse(
  data: PlacesEventsData,
  userQuery: string
): Promise<string> {
  const safeData = JSON.stringify(data, null, 2);

  const prompt = `
You are formatting VERIFIED DATA ONLY.

Rules:
- Use ONLY the provided data
  - Do NOT invent names, ratings, or times
- If data is missing, do not mention it
- Be friendly, concise, and clear

User query:
"${userQuery}"

Verified data:
${safeData}

Format the response.
`;

  try {
    return await generateContent(prompt);
  } catch {
    // Deterministic fallback (no LLM)
    const lines: string[] = [];

    if (data.places?.length) {
      lines.push("Places:");
      data.places.forEach((p) =>
        lines.push(`- ${p.name}${p.address ? ` (${p.address})` : ""}`)
      );
    }

    if (data.events?.length) {
      lines.push("Events:");
      data.events.forEach((e) =>
        lines.push(`- ${e.name}${e.date ? ` on ${e.date}` : ""}`)
      );
    }

    return lines.join("\n") || "I found some results.";
  }
}

/* ------------------------------------------------------------------ */
/* ---------------------- UTIL --------------------------------------- */
/* ------------------------------------------------------------------ */

function safeParseJSON(text: string): any {
  const cleaned = text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  return JSON.parse(cleaned);
}
