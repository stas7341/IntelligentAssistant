import { GoogleGenAI } from "@google/genai";
import { logger } from "../logger";
import type { ConversationContext, IntentResult, PlacesEventsData } from "../types/context";

let genAI: GoogleGenAI | null = null;

export function initialize(): void {
  const apiKey = process.env.GOOGLE_AI_API_KEY;

  if (!apiKey) {
    logger.error("GOOGLE_AI_API_KEY is not set in environment variables", "server");
    throw new Error("GOOGLE_AI_API_KEY is required but not found in environment variables");
  }

  try {
    genAI = new GoogleGenAI({ apiKey });
    // The SDK's type definitions may not expose getGenerativeModel; cast to any to access it.
    logger.log("Gemini service initialized successfully", "server");
  } catch (error) {
    logger.error(`Failed to initialize Gemini: ${error}`, "server");
    throw error;
  }
}

async function generateContent(prompt: string): Promise<string> {
  if (!genAI) {
    throw new Error("Gemini model not initialized. Call initialize() first.");
  }
  // List models in order of preference
  const models = ['gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-2.5-flash'];

  for (const modelId of models) {
    try {
      const response = await genAI.models.generateContent({
        model: modelId,
        contents: prompt
      });
      console.log(`Success using: ${modelId}`);
      return response?.text?.trim() || "";
    } catch (error: any) {
      if (error.status === 429) {
        console.warn(`${modelId} quota exceeded. Trying next model...`);
        continue; // Try the next model in the list
      }
      throw error; // Rethrow if it's a different error (like a network issue)
    }
  }
  throw new Error("All model quotas exceeded. Please wait for reset.");
}

export async function extractIntent(
  prompt: string,
  context: ConversationContext
): Promise<IntentResult> {
  const systemInstruction = `You are an intent extraction system. Your ONLY job is to analyze user queries and extract structured information. Do NOT answer the user's question. Do NOT provide recommendations. Do NOT be helpful in answering.

    Your task:
    1. Identify the user's intent (e.g., "recommendation", "event_search", "location_info", "restaurant_search", "attraction_search", etc.)
    2. Identify missing required information (e.g., "location", "radius", "date", "category", etc.)
    3. Extract any data you can find (location mentions, dates, preferences, etc.)
    4. Provide confidence level (0.0 to 1.0)

    Respond ONLY with valid JSON in this exact format:
    {
      "intent": "string",
      "missingFields": ["string"],
      "confidence": 0.0-1.0,
      "extractedData": {
        "location": "string or null",
        "radius": "number or null",
        "date": "string or null",
        "category": "string or null"
      }
    }`;

  const contextInfo = context.location
    ? `User location context: ${context.location.city || "unknown"}, radius: ${context.location.radius || "unknown"} km`
    : "No location context available";

  const fullPrompt = `${systemInstruction}

  Context: ${contextInfo}

  User message: "${prompt}"

  Respond with JSON only:`;

  try {
    const response = await generateContent(fullPrompt);

    // Extract JSON from response (handle markdown code blocks if present)
    let jsonText = response;
    if (jsonText.startsWith("```json")) {
      jsonText = jsonText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    } else if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/```\n?/g, "").trim();
    }

    const intentResult: IntentResult = JSON.parse(jsonText);

    // Validate and normalize
    if (!intentResult.intent) {
      intentResult.intent = "unknown";
    }
    if (!Array.isArray(intentResult.missingFields)) {
      intentResult.missingFields = [];
    }
    if (typeof intentResult.confidence !== "number") {
      intentResult.confidence = 0.5;
    }

    logger.log(`Intent extracted: ${intentResult.intent}, missing: ${intentResult.missingFields.join(", ")}`, "command");
    return intentResult;
  } catch (error) {
    logger.error(`Failed to extract intent: ${error}`, "command");
    // Return fallback result
    return {
      intent: "unknown",
      missingFields: ["location"],
      confidence: 0.0,
      extractedData: {},
    };
  }
}

export async function generateClarification(missingFields: string[]): Promise<string> {
  const prompt = `Generate a friendly, concise clarification question asking the user for the following missing information: ${missingFields.join(", ")}.

Be conversational and helpful, but brief. Do not provide recommendations or answers yet. Just ask for the missing information.

Example format: "I'd be happy to help! Could you please tell me your location and how far you're willing to travel?"

Respond with only the clarification question, nothing else:`;

  return await generateContent(prompt);
}

export async function formatResponse(
  data: PlacesEventsData,
  query: string
): Promise<string> {
  const dataSummary = JSON.stringify(data, null, 2);

  const prompt = `You are a helpful tourist assistant. Format the following verified data as a friendly, informative response to the user's query.

User's original query: "${query}"

Verified data:
${dataSummary}

Format this data in a tourist-friendly way:
- Be conversational and helpful
- Highlight key information (names, locations, ratings if available)
- Organize information clearly
- Keep it concise but informative
- If there are multiple results, present them in a clear list format

Respond with the formatted response only:`;

  try {
    return await generateContent(prompt);
  } catch (error) {
    logger.error(`Failed to format response: ${error}`, "command");
    // Fallback formatting
    const places = data.places?.map((p) => `- ${p.name} (${p.address})`).join("\n") || "";
    const events = data.events?.map((e) => `- ${e.name} on ${e.date} at ${e.location}`).join("\n") || "";
    return `Here are some results:\n${places}\n${events}`.trim() || "I found some results, but couldn't format them properly.";
  }
}
