import { logger } from "../logger";
import type { PlacesEventsData } from "../types/context";
import fs from "fs";
import path from "path";

export interface EventSearchParams {
  date?: string; // ISO date string
  category?: string;
  timeOfDay?: string;
}

/**
 * Placeholder for Google Events API integration
 * TODO: Implement actual Google Events API calls
 */
export async function searchEvents(
  params: EventSearchParams
): Promise<PlacesEventsData["events"]> {
  logger.log(
    `[DATASET] Searching events in Tel Aviv, date=${params.date ?? "any"}, category=${params.category ?? "any"}, timeOfDay=${params.timeOfDay ?? "any"}`,
    "command"
  );

  const filePath = path.join(__dirname, "../../data/events.telaviv.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  const events = JSON.parse(raw);

  return events.filter((e: any) => {
    if (params.date && e.date !== params.date) return false;
    if (params.category && e.category && e.category !== params.category) return false;
    if (params.timeOfDay && e.timeOfDay && e.timeOfDay !== params.timeOfDay) return false;
    return true;
  });
}
