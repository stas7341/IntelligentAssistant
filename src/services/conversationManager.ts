import type { ConversationContext } from "../types/context";

// In-memory storage for conversation contexts
// In production, this should be replaced with a database or session store

const conversations = new Map<string, ConversationContext>();

function cleanupExpiredConversations() {
  const now = new Date();
  const oneHourMs = 60 * 60 * 1000;
  for (const [userId, context] of conversations.entries()) {
    if (context.createdAt) {
      const created = new Date(context.createdAt);
      if (now.getTime() - created.getTime() > oneHourMs) {
        conversations.delete(userId);
      }
    }
  }
}

function getOrCreateContext(userId: string): ConversationContext {
  cleanupExpiredConversations();
  const now = new Date();
  const oneHourMs = 60 * 60 * 1000;
  const existing = conversations.get(userId);
  if (existing) {
    if (existing.createdAt) {
      const created = new Date(existing.createdAt);
      if (now.getTime() - created.getTime() > oneHourMs) {
        // Expire old conversation
        conversations.set(userId, {
          userId,
          previousQueries: [],
          createdAt: now.toISOString(),
        });
        return conversations.get(userId)!;
      }
    }
    return existing;
  } else {
    conversations.set(userId, {
      userId,
      previousQueries: [],
      createdAt: now.toISOString(),
    });
    return conversations.get(userId)!;
  }
}

export function getContext(userId: string): ConversationContext {
  return getOrCreateContext(userId);
}

export function updateContext(
  userId: string,
  updates: Partial<ConversationContext>
): ConversationContext {
  const context = getOrCreateContext(userId);
  const updated = { ...context, ...updates };
  conversations.set(userId, updated);
  return updated;
}

export function addQueryToHistory(
  userId: string,
  query: string,
  intent?: string
): void {
  const context = getOrCreateContext(userId);
  context.previousQueries.push({
    query,
    timestamp: new Date().toISOString(),
    intent,
  });
  // Keep only last 50 queries
  if (context.previousQueries.length > 50) {
    context.previousQueries = context.previousQueries.slice(-50);
  }
  conversations.set(userId, context);
}

export function setLocation(
  userId: string,
  location: ConversationContext["location"]
): void {
  const context = getOrCreateContext(userId);
  context.location = location;
  conversations.set(userId, context);
}

export function setWaitingForClarification(
  userId: string,
  missingFields: string[],
  originalQuery: string
): void {
  const context = getOrCreateContext(userId);
  context.waitingForClarification = {
    missingFields,
    originalQuery,
  };
  conversations.set(userId, context);
}

export function clearWaitingForClarification(userId: string): void {
  const context = getOrCreateContext(userId);
  context.waitingForClarification = undefined;
  conversations.set(userId, context);
}

export function extractLocationFromText(text: string): {
  city?: string;
  radius?: number;
} | null {
  // Simple extraction patterns
  // In production, this could use NLP or more sophisticated parsing

  // Pattern: "I'm in [city]" or "I'm at [city]" or "[city]"
  const cityPattern = /(?:I'?m\s+(?:in|at)\s+)?([A-Z][a-zA-Z\s]+?)(?:\s*,\s*|\s+within|\s*$)/i;
  const cityMatch = text.match(cityPattern);
  const city = cityMatch ? cityMatch[1].trim() : undefined;

  // Pattern: "within [number] km" or "[number] km"
  const radiusPattern = /(?:within\s+)?(\d+)\s*km/i;
  const radiusMatch = text.match(radiusPattern);
  const radius = radiusMatch ? parseInt(radiusMatch[1], 10) : undefined;

  if (city || radius) {
    return { city, radius };
  }

  return null;
}
