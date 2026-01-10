import type { ConversationContext } from "../types/context";

const conversations = new Map<string, ConversationContext>();
const TTL_MS = 60 * 60 * 1000;

function getContextInternal(userId: string): ConversationContext {
  const now = Date.now();
  const existing = conversations.get(userId);

  if (existing && existing.createdAt) {
    if (now - new Date(existing.createdAt).getTime() > TTL_MS) {
      conversations.delete(userId);
    } else {
      return existing;
    }
  }

  const fresh: ConversationContext = {
    userId,
    previousQueries: [],
    createdAt: new Date().toISOString(),
  };

  conversations.set(userId, fresh);
  return fresh;
}

export function getContext(userId: string): ConversationContext {
  return getContextInternal(userId);
}

export function addQueryToHistory(
  userId: string,
  query: string,
  intent?: string
): void {
  const context = getContextInternal(userId);
  context.previousQueries.push({
    query,
    intent,
    timestamp: new Date().toISOString(),
  });
  context.previousQueries = context.previousQueries.slice(-50);
}

export function setWaitingForClarification(
  userId: string,
  missingFields: string[],
  originalQuery: string
): void {
  const context = getContextInternal(userId);
  context.waitingForClarification = {
    missingFields,
    originalQuery,
  };
}

export function clearWaitingForClarification(userId: string): void {
  const context = getContextInternal(userId);
  context.waitingForClarification = undefined;
}
