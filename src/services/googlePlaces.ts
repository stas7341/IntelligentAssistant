import { logger } from "../logger";
import type { PlacesEventsData } from "../types/context";
import fs from "fs";
import path from "path";

export interface PlaceSearchParams {
  category?: string;
  timeOfDay?: string;
}

/**
 * Placeholder for Google Places API integration
 * TODO: Implement actual Google Places API calls
 */
export async function searchPlaces(
  params: PlaceSearchParams
): Promise<PlacesEventsData["places"]> {
  logger.log(
    `[DATASET] Searching places in Tel Aviv, category=${params.category ?? "any"}, timeOfDay=${params.timeOfDay ?? "any"}`,
    "command"
  );

  const filePath = path.join(__dirname, "../../data/places.telaviv.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  const places = JSON.parse(raw);

  return places.filter((p: any) => {
    if (params.category && !p.types.includes(params.category)) return false;
    if (params.timeOfDay && p.timeOfDay && p.timeOfDay !== params.timeOfDay) return false;
    return true;
  });
}
